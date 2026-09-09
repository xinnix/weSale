import { Module } from '@nestjs/common';
import { WechatPayService } from './services/wechat-pay.service';
import { PaymentController } from './rest/payment.controller';
import { RedisService } from '../../shared/services/redis.service';
import { ProductModule } from '../product/module';

@Module({
  imports: [ProductModule], // 支付回调需要 OrderService 做入账编排
  controllers: [PaymentController],
  providers: [WechatPayService, RedisService],
  exports: [WechatPayService],
})
export class PaymentModule {}
