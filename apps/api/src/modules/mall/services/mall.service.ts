import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderService } from '../../product/services/order.service';
import { WechatPayService } from '../../payment/services/wechat-pay.service';
import {
  CreateAddressSchema,
  CreateMiniappOrderSchema,
  OrderStatusSchema,
  UpdateAddressSchema,
} from '@opencode/shared';

const ORDERS_DEFAULT_PAGE_SIZE = 10;
const ORDERS_MAX_PAGE_SIZE = 50;

const PRODUCT_CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  coverImage: true,
} as const;

/** zod 校验失败 → 400，把第一条 issue 转成可读信息 */
function parseOrBadRequest<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.');
    throw new BadRequestException(
      path ? `${path}: ${issue.message}` : issue?.message || '参数错误',
    );
  }
  return result.data;
}

/**
 * 用户端商城服务：收货地址、订单查询、JSAPI 支付编排。
 * 建单委托 OrderService（地址快照/订单号/过期时间在那里统一处理）。
 * 数据隔离：所有查询以 userId 收敛，用户只能访问自己的地址与订单。
 */
@Injectable()
export class MallService {
  private readonly logger = new Logger(MallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly wechatPayService: WechatPayService,
  ) {}

  // ─── 收货地址 ────────────────────────────────────────────────

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, dto: unknown) {
    const data = parseOrBadRequest(CreateAddressSchema, dto);

    if (data.isDefault) {
      await this.clearDefaultAddress(userId);
    }
    return this.prisma.address.create({ data: { ...data, userId } });
  }

  async updateAddress(userId: string, addressId: string, dto: unknown) {
    const data = parseOrBadRequest(UpdateAddressSchema, dto);
    const address = await this.ownAddressOrThrow(userId, addressId);

    if (data.isDefault) {
      await this.clearDefaultAddress(userId);
    }
    return this.prisma.address.update({ where: { id: address.id }, data });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.ownAddressOrThrow(userId, addressId);

    await this.prisma.address.update({
      where: { id: address.id },
      data: { deletedAt: new Date(), isDefault: false },
    });
    return { id: addressId };
  }

  private async ownAddressOrThrow(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
    });
    if (!address) throw new NotFoundException('收货地址不存在');
    return address;
  }

  /** 换默认地址前先清掉旧的，保证默认地址唯一 */
  private clearDefaultAddress(userId: string) {
    return this.prisma.address.updateMany({
      where: { userId, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  }

  // ─── 订单 ────────────────────────────────────────────────────

  async createOrder(userId: string, dto: unknown) {
    const data = parseOrBadRequest(CreateMiniappOrderSchema, dto);

    try {
      return await this.orderService.createMiniappOrder({ userId, ...data });
    } catch (error: any) {
      // OrderService 抛的是业务校验错误（商品下架/地址无效），以 400 返回供前端提示
      throw new BadRequestException(error.message);
    }
  }

  async listOrders(userId: string, query: { page?: string; limit?: string; status?: string }) {
    const page = Math.max(1, Number.parseInt(query.page || '', 10) || 1);
    const limit = Math.min(
      ORDERS_MAX_PAGE_SIZE,
      Math.max(1, Number.parseInt(query.limit || '', 10) || ORDERS_DEFAULT_PAGE_SIZE),
    );

    const status = query.status ? parseOrBadRequest(OrderStatusSchema, query.status) : undefined;
    const where = { userId, ...(status ? { status } : {}) };
    const [total, list] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { product: { select: PRODUCT_CARD_SELECT } },
      }),
    ]);

    // 带 data 字段 + 分页字段，由 TransformInterceptor 提升为顶层分页结构
    return {
      data: list,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrder(userId: string, orderNo: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNo, userId },
      include: { product: { select: PRODUCT_CARD_SELECT } },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  /**
   * 领取无主订单（KF 卡片落地场景）：KF 会话建的单只有 contactId，
   * 顾客点卡片进小程序登录后，把 PENDING 无主单绑定到当前用户，
   * 后续查单/支付走正常归属校验。已被领取的他人订单返回 403。
   */
  async claimOrder(userId: string, orderNo: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNo },
      include: { product: { select: PRODUCT_CARD_SELECT } },
    });
    if (!order) throw new NotFoundException('订单不存在');

    if (order.userId === userId) return order;
    if (order.userId) throw new ForbiddenException('订单已被其他账号领取');
    if (order.status !== 'PENDING') {
      throw new BadRequestException(`订单状态为 ${order.status}，无法领取`);
    }

    await this.prisma.order.update({ where: { id: order.id }, data: { userId } });
    return { ...order, userId };
  }

  // ─── 支付 ────────────────────────────────────────────────────

  /**
   * JSAPI 预支付：校验订单归属与状态 → 取用户 openid → 微信下单 → 返回
   * uni.requestPayment 所需参数。实际入账由支付回调 markPaidByOrderNo 幂等完成。
   */
  async prepay(userId: string, orderNo: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNo, userId },
      include: { product: { select: { name: true } } },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'PENDING') {
      throw new BadRequestException(`订单状态为 ${order.status}，无法支付`);
    }
    if (order.expireAt && order.expireAt.getTime() < Date.now()) {
      throw new BadRequestException('订单已超时未支付，请重新下单');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.openid) throw new BadRequestException('缺少微信 openid，无法发起支付');

    try {
      const prepayId = await this.wechatPayService.createOrder({
        orderId: order.id,
        orderNo: order.orderNo,
        amount: order.totalAmountFen,
        description: order.product.name,
        openid: user.openid,
      });
      return {
        orderNo: order.orderNo,
        totalAmountFen: order.totalAmountFen,
        ...this.wechatPayService.getPayParams(prepayId),
      };
    } catch (error: any) {
      this.logger.error(`预支付创建失败: ${orderNo}`, error);
      throw new BadRequestException(error.message || '发起支付失败');
    }
  }
}
