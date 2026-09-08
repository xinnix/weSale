import { z } from 'zod';
import { CreateOrderSchema, RefundOrderSchema } from '@opencode/shared';
import { createCrudRouterWithCustom } from '../../../trpc/trpc.helper';
import { permissionProcedure } from '../../../trpc/trpc';
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
        const product = await ctx.prisma.product.findUnique({
          where: { id: input.productId, deletedAt: null },
        });
        if (!product)
          throw new NotFoundBusinessException(
            'Product',
            input.productId,
            ErrorCodes.PRODUCT_NOT_FOUND,
          );

        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const count = await ctx.prisma.order.count({
          where: { createdAt: { gte: todayStart } },
        });
        const orderNo = `WS${dateStr}${String(count + 1).padStart(4, '0')}`;

        const quantity = input.quantity ?? 1;

        return ctx.prisma.order.create({
          data: {
            orderNo,
            contactId: input.contactId,
            productId: input.productId,
            sessionId: input.sessionId,
            quantity,
            unitPriceFen: product.priceFen,
            totalAmountFen: product.priceFen * quantity,
            status: 'PENDING',
            metadata: input.metadata,
            createdById: ctx.user?.id,
          },
          include: { product: true, contact: true },
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

        return ctx.prisma.order.update({
          where: { id },
          data: {
            status: 'REFUNDING',
            refundAmountFen: order.totalAmountFen,
            refundReason: data.refundReason,
          },
        });
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
