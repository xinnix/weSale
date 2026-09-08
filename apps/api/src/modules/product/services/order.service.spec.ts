import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OrderService } from './order.service';

/**
 * 构造带 mock Prisma 的 OrderService。
 * findUnique 默认返回 null（订单号无冲突），可用 findUniqueImpl 覆盖。
 */
function createOrderService(findUniqueImpl?: (args: any) => Promise<any>) {
  const order = {
    findUnique: vi.fn(findUniqueImpl ?? (async () => null)),
  };
  const prisma: any = { order, $transaction: vi.fn() };
  const service = new OrderService(prisma);
  return { service, order, prisma };
}

describe('OrderService.generateOrderNo', () => {
  let service: OrderService;

  beforeEach(() => {
    ({ service } = createOrderService());
  });

  it('生成 WS + yyyyMMdd + 6 位随机字符的订单号', async () => {
    const orderNo = await service.generateOrderNo();

    expect(orderNo).toMatch(/^WS\d{8}[A-HJ-NP-Z2-9]{6}$/);
  });

  it('并发批量生成 50 个订单号无重复', async () => {
    const orderNos = await Promise.all(Array.from({ length: 50 }, () => service.generateOrderNo()));

    expect(new Set(orderNos).size).toBe(50);
  });

  it('唯一冲突时重试，重试成功后返回', async () => {
    let calls = 0;
    const { service: conflictService } = createOrderService(async () => {
      calls++;
      // 前两次返回已存在的订单号（冲突），第三次放行
      return calls <= 2 ? { id: 'existing' } : null;
    });

    const orderNo = await conflictService.generateOrderNo();

    expect(orderNo).toMatch(/^WS\d{8}/);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('连续冲突超过重试上限则抛错', async () => {
    const { service: alwaysConflict } = createOrderService(async () => ({ id: 'existing' }));

    await expect(alwaysConflict.generateOrderNo()).rejects.toThrow('订单号生成冲突');
  });
});

describe('OrderService.markPaidByOrderNo', () => {
  it('重复回调（订单已 PAID）幂等返回，不重复更新', async () => {
    const paidOrder = { id: 'o1', orderNo: 'WS20260908AAAAAA', status: 'PAID' };
    const tx = {
      order: { findUnique: vi.fn(async () => paidOrder), update: vi.fn() },
      contact: { update: vi.fn() },
      conversationSession: { update: vi.fn() },
    };
    const prisma: any = {
      order,
      $transaction: vi.fn(async (fn: any) => fn(tx)),
    };
    function order(): any {
      return {};
    }
    const service = new OrderService(prisma);

    const result = await service.markPaidByOrderNo('WS20260908AAAAAA', 'tx123');

    expect(result).toBe(paidOrder);
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.contact.update).not.toHaveBeenCalled();
  });

  it('PENDING 订单支付成功后同步 Contact 与 Session 状态', async () => {
    const pendingOrder = {
      id: 'o1',
      orderNo: 'WS20260908BBBBBB',
      status: 'PENDING',
      contactId: 'c1',
      sessionId: 's1',
      totalAmountFen: 9900,
    };
    const updated = { ...pendingOrder, status: 'PAID' };
    const tx = {
      order: {
        findUnique: vi.fn(async () => pendingOrder),
        update: vi.fn(async () => updated),
      },
      contact: { update: vi.fn() },
      conversationSession: { update: vi.fn() },
    };
    const prisma: any = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
    const service = new OrderService(prisma);

    const result = await service.markPaidByOrderNo('WS20260908BBBBBB', 'tx456');

    expect(result).toEqual(updated);
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({ status: 'PAID', paidTransactionId: 'tx456' }),
      }),
    );
    expect(tx.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({ status: 'CONVERTED' }),
      }),
    );
    expect(tx.conversationSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: { state: 'CONVERTED' },
      }),
    );
  });

  it('无关联 Contact/Session 的小程序订单仅更新订单本身', async () => {
    const pendingOrder = {
      id: 'o2',
      orderNo: 'WS20260908CCCCCC',
      status: 'PENDING',
      contactId: null,
      sessionId: null,
      totalAmountFen: 100,
    };
    const tx = {
      order: {
        findUnique: vi.fn(async () => pendingOrder),
        update: vi.fn(async () => ({ ...pendingOrder, status: 'PAID' })),
      },
      contact: { update: vi.fn() },
      conversationSession: { update: vi.fn() },
    };
    const prisma: any = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
    const service = new OrderService(prisma);

    await service.markPaidByOrderNo('WS20260908CCCCCC', 'tx789');

    expect(tx.contact.update).not.toHaveBeenCalled();
    expect(tx.conversationSession.update).not.toHaveBeenCalled();
  });
});
