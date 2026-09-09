import { Module } from '@nestjs/common';
import { ProductModule } from '../product/module';
import { PaymentModule } from '../payment/module';
import { MallService } from './services/mall.service';
import { MallController } from './rest/mall.controller';

@Module({
  imports: [ProductModule, PaymentModule],
  controllers: [MallController],
  providers: [MallService],
})
export class MallModule {}
