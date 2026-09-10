import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MallService } from './mall.service';

/**
 * 构造带 mock 依赖的 MallService。
 * prisma 用手写 vi.fn() 对象；OrderService / WechatPayService 只 mock 用到的方法。
 */
function createMallService() {
  const address = {
    findMany: vi.fn(async () => []),
    create: vi.fn(async (args: any) => ({ id: 'a-new', ...args.data })),
    findFirst: vi.fn(async () => null),
    update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };
  const order = {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    findUnique: vi.fn(async () => null),
    update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
  };
  const user = {
    findUnique: vi.fn(async () => null),
  };
  const prisma: any = {
    address,
    order,
    user,
    $transaction: vi.fn(async (ops: any) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
  };
  const orderService = {
    createMiniappOrder: vi.fn(async (args: any) => ({ orderNo: 'WS20260909AAAAAA', ...args })),
  };
  const wechatPayService = {
    createOrder: vi.fn(async () => 'prepay_id_demo'),
    getPayParams: vi.fn(() => ({
      timeStamp: '1700000000',
      nonceStr: 'nonce',
      package: 'prepay_id=prepay_id_demo',
      signType: 'RSA',
      paySign: 'sign',
    })),
  };

  const service = new MallService(prisma, orderService as any, wechatPayService as any);
  return { service, prisma, address, order, user, orderService, wechatPayService };
}

describe('MallService 收货地址', () => {
  let ctx: ReturnType<typeof createMallService>;

  beforeEach(() => {
    ctx = createMallService();
  });

  it('创建地址时注入 userId，不信任客户端传入', async () => {
    await ctx.service.createAddress('u1', {
      receiver: '张三',
      phone: '13800138000',
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail: '科技园路 1 号',
    });

    expect(ctx.address.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u1', receiver: '张三' }),
      }),
    );
  });

  it('手机号非法时返回 400', async () => {
    await expect(
      ctx.service.createAddress('u1', {
        receiver: '张三',
        phone: '12345',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '科技园路 1 号',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(ctx.address.create).not.toHaveBeenCalled();
  });

  it('设置默认地址时先清掉旧默认，保证唯一', async () => {
    await ctx.service.createAddress('u1', {
      receiver: '张三',
      phone: '13800138000',
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail: '科技园路 1 号',
      isDefault: true,
    });

    expect(ctx.address.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1', isDefault: true }),
        data: { isDefault: false },
      }),
    );
  });

  it('更新/删除他人地址返回 404（数据隔离）', async () => {
    await expect(ctx.service.updateAddress('u1', 'a-other', { detail: '新地址' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(ctx.service.deleteAddress('u1', 'a-other')).rejects.toThrow(NotFoundException);
  });

  it('删除是软删除：写 deletedAt 并摘掉默认标记', async () => {
    ctx.address.findFirst.mockResolvedValue({ id: 'a1', userId: 'u1', isDefault: true });

    await ctx.service.deleteAddress('u1', 'a1');

    expect(ctx.address.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({ isDefault: false }),
      }),
    );
    const data = ctx.address.update.mock.calls[0][0].data;
    expect(data.deletedAt).toBeInstanceOf(Date);
  });
});

describe('MallService 订单', () => {
  let ctx: ReturnType<typeof createMallService>;

  beforeEach(() => {
    ctx = createMallService();
  });

  it('下单委托 OrderService 并注入 userId', async () => {
    const payload = { productId: 'p1', addressId: 'a1', quantity: 2 };

    const result = await ctx.service.createOrder('u1', payload);

    expect(ctx.orderService.createMiniappOrder).toHaveBeenCalledWith({
      userId: 'u1',
      productId: 'p1',
      addressId: 'a1',
      quantity: 2,
    });
    expect(result.orderNo).toMatch(/^WS\d{8}/);
  });

  it('缺 productId 时 400，不触达 OrderService', async () => {
    await expect(ctx.service.createOrder('u1', { addressId: 'a1' })).rejects.toThrow(
      BadRequestException,
    );
    expect(ctx.orderService.createMiniappOrder).not.toHaveBeenCalled();
  });

  it('OrderService 业务校验失败（商品下架等）转为 400', async () => {
    ctx.orderService.createMiniappOrder.mockRejectedValue(
      new Error('Product not found or not active'),
    );

    await expect(
      ctx.service.createOrder('u1', { productId: 'p1', addressId: 'a1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('订单列表分页查询且限定 userId，分页字段顶层返回', async () => {
    ctx.order.count.mockResolvedValue(11);
    ctx.order.findMany.mockResolvedValue([{ orderNo: 'WS1' }]);

    const result: any = await ctx.service.listOrders('u1', { page: '2', limit: '10' });

    expect(ctx.order.count).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(ctx.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' }, skip: 10, take: 10 }),
    );
    expect(result).toMatchObject({
      total: 11,
      page: 2,
      pageSize: 10,
      totalPages: 2,
      data: [{ orderNo: 'WS1' }],
    });
  });

  it('非法 status 过滤参数返回 400', async () => {
    await expect(ctx.service.listOrders('u1', { status: 'HACKED' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('查看他人订单返回 404（数据隔离）', async () => {
    await expect(ctx.service.getOrder('u1', 'WS-OTHER')).rejects.toThrow(NotFoundException);
  });

  it('claim：PENDING 无主单绑定当前用户，重复领取幂等', async () => {
    const unclaimed: any = {
      id: 'o1',
      orderNo: 'WS1',
      userId: null,
      status: 'PENDING',
      product: {},
    };
    ctx.order.findUnique = vi.fn(async () => unclaimed);
    const update = vi.fn(async () => unclaimed);
    ctx.order.update = update;

    await ctx.service.claimOrder('u1', 'WS1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'o1' }, data: { userId: 'u1' } }),
    );

    // 第二次：已是本人订单 → 幂等返回，不再 update
    unclaimed.userId = 'u1';
    await ctx.service.claimOrder('u1', 'WS1');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('claim：已被他人领取的订单返回 403', async () => {
    ctx.order.findUnique = vi.fn(async () => ({
      id: 'o1',
      orderNo: 'WS1',
      userId: 'someone-else',
      status: 'PENDING',
      product: {},
    }));

    await expect(ctx.service.claimOrder('u1', 'WS1')).rejects.toThrow(ForbiddenException);
  });
});

describe('MallService 支付', () => {
  let ctx: ReturnType<typeof createMallService>;

  beforeEach(() => {
    ctx = createMallService();
  });

  it('prepay 返回 uni.requestPayment 所需参数', async () => {
    ctx.order.findFirst.mockResolvedValue({
      id: 'o1',
      orderNo: 'WS20260909AAAAAA',
      status: 'PENDING',
      totalAmountFen: 9900,
      expireAt: new Date(Date.now() + 60_000),
      product: { name: '测试商品' },
    });
    ctx.user.findUnique.mockResolvedValue({ id: 'u1', openid: 'o-x' });

    const result: any = await ctx.service.prepay('u1', 'WS20260909AAAAAA');

    expect(ctx.wechatPayService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'o1',
        orderNo: 'WS20260909AAAAAA',
        amount: 9900,
        openid: 'o-x',
      }),
    );
    expect(result).toMatchObject({
      orderNo: 'WS20260909AAAAAA',
      totalAmountFen: 9900,
      package: 'prepay_id=prepay_id_demo',
    });
  });

  it('非 PENDING 订单拒绝支付', async () => {
    ctx.order.findFirst.mockResolvedValue({
      id: 'o1',
      orderNo: 'WS1',
      status: 'PAID',
      totalAmountFen: 100,
      product: { name: 'x' },
    });

    await expect(ctx.service.prepay('u1', 'WS1')).rejects.toThrow(BadRequestException);
    expect(ctx.wechatPayService.createOrder).not.toHaveBeenCalled();
  });

  it('过期订单拒绝支付', async () => {
    ctx.order.findFirst.mockResolvedValue({
      id: 'o1',
      orderNo: 'WS1',
      status: 'PENDING',
      totalAmountFen: 100,
      expireAt: new Date(Date.now() - 1000),
      product: { name: 'x' },
    });
    ctx.user.findUnique.mockResolvedValue({ id: 'u1', openid: 'o-x' });

    await expect(ctx.service.prepay('u1', 'WS1')).rejects.toThrow('订单已超时未支付');
  });

  it('用户无 openid 时拒绝支付', async () => {
    ctx.order.findFirst.mockResolvedValue({
      id: 'o1',
      orderNo: 'WS1',
      status: 'PENDING',
      totalAmountFen: 100,
      expireAt: new Date(Date.now() + 60_000),
      product: { name: 'x' },
    });
    ctx.user.findUnique.mockResolvedValue({ id: 'u1', openid: '' });

    await expect(ctx.service.prepay('u1', 'WS1')).rejects.toThrow('openid');
  });
});
