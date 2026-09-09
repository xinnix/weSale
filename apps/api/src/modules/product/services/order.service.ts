import { Injectable, Logger } from '@nestjs/common';
import { BaseService } from '../../../common/base.service';
import { PrismaService } from '../../../prisma/prisma.service';

/** 订单号日期部分之后的随机串长度（32 进制字符，去除了易混淆的 I/O/0/1） */
const ORDER_NO_RANDOM_LEN = 6;
const ORDER_NO_RETRY_LIMIT = 3;
/** 待支付订单有效期（毫秒） */
const ORDER_EXPIRE_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class OrderService extends BaseService<'order'> {
  private readonly logger = new Logger(OrderService.name);

  constructor(prisma: PrismaService) {
    super(prisma, 'order');
  }

  /**
   * 生成订单号：WS + yyyyMMdd + 6 位随机大写字母数字。
   * 随机化避免并发计数撞号，唯一冲突时重试。
   */
  async generateOrderNo(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    for (let attempt = 0; attempt < ORDER_NO_RETRY_LIMIT; attempt++) {
      let rand = '';
      for (let i = 0; i < ORDER_NO_RANDOM_LEN; i++) {
        rand += chars[Math.floor(Math.random() * chars.length)];
      }
      const orderNo = `WS${dateStr}${rand}`;
      const exists = await this.model.findUnique({ where: { orderNo } });
      if (!exists) {
        return orderNo;
      }
    }
    throw new Error('订单号生成冲突，请重试');
  }

  /**
   * 客服会话建单（AI 逼单时调用）：关联 Contact 与会话
   */
  async createOrder(data: {
    contactId: string;
    productId: string;
    sessionId?: string;
    quantity?: number;
    metadata?: any;
    userId?: string;
  }) {
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId },
    });
    if (!product) throw new Error('Product not found');

    const quantity = data.quantity ?? 1;
    const orderNo = await this.generateOrderNo();

    return this.model.create({
      data: {
        orderNo,
        source: 'KF_SESSION',
        contactId: data.contactId,
        productId: data.productId,
        sessionId: data.sessionId,
        quantity,
        unitPriceFen: product.priceFen,
        totalAmountFen: product.priceFen * quantity,
        status: 'PENDING',
        expireAt: new Date(Date.now() + ORDER_EXPIRE_MS),
        metadata: data.metadata,
        createdById: data.userId,
      },
      include: { product: true, contact: true },
    });
  }

  /**
   * 小程序商城下单：地址快照 + 支付截止时间
   */
  async createMiniappOrder(data: {
    userId: string;
    productId: string;
    quantity?: number;
    addressId: string;
  }) {
    const product = await this.prisma.product.findFirst({
      where: { id: data.productId, status: 'ACTIVE', deletedAt: null },
    });
    if (!product) throw new Error('Product not found or not active');

    const address = await this.prisma.address.findFirst({
      where: { id: data.addressId, userId: data.userId, deletedAt: null },
    });
    if (!address) throw new Error('收货地址不存在');

    const quantity = data.quantity ?? 1;
    const orderNo = await this.generateOrderNo();

    return this.model.create({
      data: {
        orderNo,
        source: 'MINIAPP',
        userId: data.userId,
        productId: data.productId,
        quantity,
        unitPriceFen: product.priceFen,
        totalAmountFen: product.priceFen * quantity,
        status: 'PENDING',
        addressSnapshot: {
          receiver: address.receiver,
          phone: address.phone,
          province: address.province,
          city: address.city,
          district: address.district,
          detail: address.detail,
        },
        expireAt: new Date(Date.now() + ORDER_EXPIRE_MS),
      },
      include: { product: true },
    });
  }

  /**
   * 支付成功编排（支付回调调用）：
   * 事务内 Order→PAID、Contact→CONVERTED、Session→CONVERTED 全链路同步。
   * 已 PAID 的重复回调幂等返回；金额与订单不符时拒绝入账（抛错 → 回调返回 FAIL）。
   */
  async markPaidByOrderNo(orderNo: string, transactionId: string, expectedAmountFen?: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { orderNo } });
      if (!order) throw new Error('Order not found');

      if (expectedAmountFen !== undefined && order.totalAmountFen !== expectedAmountFen) {
        this.logger.error(
          `回调金额不符，拒绝入账: 订单 ${orderNo} 应为 ${order.totalAmountFen} 分，回调 ${expectedAmountFen} 分`,
        );
        throw new Error(
          `Amount mismatch for order ${orderNo}: expected ${order.totalAmountFen}, got ${expectedAmountFen}`,
        );
      }

      if (order.status === 'PAID') {
        this.logger.log(`订单 ${orderNo} 已是 PAID，幂等跳过`);
        return order;
      }
      if (order.status !== 'PENDING') {
        throw new Error(`Order status is ${order.status}, expected PENDING`);
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paidTransactionId: transactionId,
        },
      });

      if (order.contactId) {
        await tx.contact.update({
          where: { id: order.contactId },
          data: {
            status: 'CONVERTED',
            convertedAt: new Date(),
            paidAmountFen: { increment: order.totalAmountFen },
          },
        });
      }

      if (order.sessionId) {
        await tx.conversationSession.update({
          where: { id: order.sessionId },
          data: { state: 'CONVERTED' },
        });
      }

      return updated;
    });
  }

  async markRefunded(orderId: string, amount: number, reason: string) {
    const order = await this.model.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.status !== 'PAID') throw new Error(`Order status is ${order.status}, expected PAID`);

    return this.model.update({
      where: { id: orderId },
      data: {
        status: 'REFUNDING',
        refundAmountFen: amount,
        refundReason: reason,
      },
    });
  }

  async handleRefundCallback(orderNo: string) {
    const order = await this.model.findUnique({ where: { orderNo } });
    if (!order) throw new Error('Order not found');
    if (order.status === 'REFUNDED') {
      this.logger.log(`订单 ${orderNo} 已是 REFUNDED，幂等跳过`);
      return order;
    }
    if (order.status !== 'REFUNDING')
      throw new Error(`Order status is ${order.status}, expected REFUNDING`);

    const updated = await this.model.update({
      where: { orderNo },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
      },
    });

    if (order.refundAmountFen && order.contactId) {
      await this.prisma.contact.update({
        where: { id: order.contactId },
        data: { paidAmountFen: { decrement: order.refundAmountFen } },
      });
    }

    return updated;
  }
}
