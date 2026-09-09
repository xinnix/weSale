import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/guards/jwt.guard';
import { CurrentUser } from '../../auth/decorators/decorators';
import { MallService } from '../services/mall.service';

/**
 * 用户端商城 REST（小程序专用，user JWT）。
 * 商品列表/详情复用现有公开端点 /api/products/active 与 /api/products/:slug，
 * 这里只承载需要登录的部分：地址、订单、支付。
 */
@Controller('mall')
@UseGuards(JwtAuthGuard)
export class MallController {
  constructor(private readonly mallService: MallService) {}

  // ─── 收货地址 ────────────────────────────────────────────────

  @Get('addresses')
  listAddresses(@CurrentUser('id') userId: string) {
    return this.mallService.listAddresses(userId);
  }

  @Post('addresses')
  createAddress(@CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.mallService.createAddress(userId, body);
  }

  @Put('addresses/:id')
  updateAddress(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: unknown) {
    return this.mallService.updateAddress(userId, id, body);
  }

  @Delete('addresses/:id')
  deleteAddress(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.mallService.deleteAddress(userId, id);
  }

  // ─── 订单 ────────────────────────────────────────────────────

  @Post('orders')
  createOrder(@CurrentUser('id') userId: string, @Body() body: unknown) {
    return this.mallService.createOrder(userId, body);
  }

  @Get('orders')
  listOrders(
    @CurrentUser('id') userId: string,
    @Query() query: { page?: string; limit?: string; status?: string },
  ) {
    return this.mallService.listOrders(userId, query);
  }

  @Get('orders/:orderNo')
  getOrder(@CurrentUser('id') userId: string, @Param('orderNo') orderNo: string) {
    return this.mallService.getOrder(userId, orderNo);
  }

  // ─── 支付 ────────────────────────────────────────────────────

  @Post('orders/:orderNo/prepay')
  prepay(@CurrentUser('id') userId: string, @Param('orderNo') orderNo: string) {
    return this.mallService.prepay(userId, orderNo);
  }
}
