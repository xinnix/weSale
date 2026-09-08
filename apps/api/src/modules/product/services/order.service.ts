import { Injectable, Logger } from '@nestjs/common';
import { BaseService } from '../../../common/base.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OrderService extends BaseService<'order'> {
  private readonly logger = new Logger(OrderService.name);

  constructor(prisma: PrismaService) {
    super(prisma, 'order');
  }

  async generateOrderNo(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const count = await this.model.count({
      where: { createdAt: { gte: todayStart } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `WS${dateStr}${seq}`;
  }

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
        contactId: data.contactId,
        productId: data.productId,
        sessionId: data.sessionId,
        quantity,
        unitPriceFen: product.priceFen,
        totalAmountFen: product.priceFen * quantity,
        status: 'PENDING',
        metadata: data.metadata,
        createdById: data.userId,
      },
      include: { product: true, contact: true },
    });
  }

  async markPaid(orderId: string, transactionId: string) {
    const order = await this.model.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.status !== 'PENDING')
      throw new Error(`Order status is ${order.status}, expected PENDING`);

    const updated = await this.model.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidTransactionId: transactionId,
      },
    });

    if (order.totalAmountFen) {
      await this.prisma.contact.update({
        where: { id: order.contactId },
        data: { paidAmountFen: { increment: order.totalAmountFen } },
      });
    }

    return updated;
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
    if (order.status !== 'REFUNDING')
      throw new Error(`Order status is ${order.status}, expected REFUNDING`);

    const updated = await this.model.update({
      where: { orderNo },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
      },
    });

    if (order.refundAmountFen) {
      await this.prisma.contact.update({
        where: { id: order.contactId },
        data: { paidAmountFen: { decrement: order.refundAmountFen } },
      });
    }

    return updated;
  }
}
