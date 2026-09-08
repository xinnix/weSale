import { z } from 'zod';
import { CreateOrderSchema, RefundOrderSchema, ShipOrderSchema } from '@opencode/shared';
import { createCrudRouterWithCustom } from '../../../trpc/trpc.helper';
import { permissionProcedure } from '../../../trpc/trpc';
import { getOrderService, getWechatPayService } from '../../../trpc/trpc';
import { NotFoundBusinessException, ErrorCodes } from '../../../core/exceptions';

const orderGetManySchema = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional(),
    search: z.string().optional(),
    where: z.any().optional(),
    orderBy: z.any().optional(),
  })
  .optional();

export const orderRouter = createCrudRouterWithCustom(
  'Order',
  {
    create: CreateOrderSchema,
    update: RefundOrderSchema,
  },
  () => ({
    getMany: permissionProcedure('order', 'read')
      .input(orderGetManySchema)
      .query(async ({ ctx, input }) => {
        const page = input?.page ?? 1;
        const pageSize = input?.limit ?? input?.pageSize ?? 10;
        const skip = (page - 1) * pageSize;

        const where: any =
          input?.where && typeof input.where === 'object' ? { ...input.where } : {};

        if (input?.search) {
          where.OR = [{ orderNo: { contains: input.search, mode: 'insensitive' } }];
        }

        const [items, total] = await Promise.all([
          ctx.prisma.order.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: input?.orderBy || { createdAt: 'desc' },
            include: {
              product: { select: { id: true, name: true, coverImage: true } },
              contact: { select: { id: true, nickname: true, avatarUrl: true } },
            },
          }),
          ctx.prisma.order.count({ where }),
        ]);

        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
      }),

    getOne: permissionProcedure('order', 'read')
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const order = await ctx.prisma.order.findUnique({
          where: { id: input.id },
          include: {
            product: true,
            contact: { select: { id: true, nickname: true, avatarUrl: true, phone: true } },
            session: { select: { id: true, state: true } },
          },
        });
        if (!order)
          throw new NotFoundBusinessException('Order', input.id, ErrorCodes.ORDER_NOT_FOUND);
        return order;
      }),

    createOrder: permissionProcedure('order', 'read')
      .input(CreateOrderSchema)
      .mutation(async ({ ctx, input }) => {
        return getOrderService().createOrder({
          contactId: input.contactId,
          productId: input.productId,
          sessionId: input.sessionId,
          quantity: input.quantity,
          metadata: input.metadata,
          userId: ctx.user?.id,
        });
      }),

    shipOrder: permissionProcedure('order', 'ship')
      .input(z.object({ id: z.string(), data: ShipOrderSchema }))
      .mutation(async ({ ctx, input }) => {
        const { id, data } = input;
        const order = await ctx.prisma.order.findUnique({ where: { id } });
        if (!order) throw new NotFoundBusinessException('Order', id, ErrorCodes.ORDER_NOT_FOUND);
        if (order.status !== 'PAID')
          throw new NotFoundBusinessException('Order', id, ErrorCodes.ORDER_INVALID_STATUS);

        return ctx.prisma.order.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            shipCompany: data.shipCompany,
            shipNo: data.shipNo,
          },
        });
      }),

    refundOrder: permissionProcedure('order', 'refund')
      .input(z.object({ id: z.string(), data: RefundOrderSchema }))
      .mutation(async ({ ctx, input }) => {
        const { id, data } = input;
        const order = await ctx.prisma.order.findUnique({ where: { id } });
        if (!order) throw new NotFoundBusinessException('Order', id, ErrorCodes.ORDER_NOT_FOUND);
        if (order.status !== 'PAID')
          throw new NotFoundBusinessException('Order', id, ErrorCodes.ORDER_INVALID_STATUS);

        // 先落 REFUNDING 状态，再调微信退款 API；API 失败则回滚状态
        const refunding = await getOrderService().markRefunded(
          id,
          order.totalAmountFen,
          data.refundReason,
        );

        const wechatPay = getWechatPayService();
        if (!wechatPay) {
          throw new Error('微信支付未配置，无法发起退款');
        }

        try {
          const refundNo = `WSR${order.orderNo.slice(2)}`;
          await wechatPay.refund({
            orderNo: order.orderNo,
            refundNo,
            totalAmount: order.totalAmountFen, // 分
            refundAmount: order.totalAmountFen, // 全额退款，单位：分
            reason: data.refundReason,
          });
        } catch (err: any) {
          // 微信退款失败，回滚 REFUNDING 状态
          await ctx.prisma.order.update({
            where: { id },
            data: { status: 'PAID', refundAmountFen: null, refundReason: null },
          });
          throw new Error(`微信退款失败: ${err.message}`);
        }

        return refunding;
      }),

    getStats: permissionProcedure('order', 'read').query(async ({ ctx }) => {
      const [totalOrders, paidOrders, totalRevenue, pendingOrders] = await Promise.all([
        ctx.prisma.order.count(),
        ctx.prisma.order.count({ where: { status: 'PAID' } }),
        ctx.prisma.order.aggregate({ _sum: { totalAmountFen: true }, where: { status: 'PAID' } }),
        ctx.prisma.order.count({ where: { status: 'PENDING' } }),
      ]);

      return {
        totalOrders,
        paidOrders,
        pendingOrders,
        totalRevenueFen: totalRevenue._sum.totalAmountFen ?? 0,
      };
    }),
  }),
  {
    includeGetMany: false,
    includeGetOne: false,
    includeCreate: false,
    includeUpdate: false,
    includeDelete: false,
    includeDeleteMany: false,
  },
);
