import { Module } from '@nestjs/common';
import { ProductService } from './services/product.service';
import { OrderService } from './services/order.service';
import { ProductController } from './rest/product.controller';

@Module({
  controllers: [ProductController],
  providers: [ProductService, OrderService],
  exports: [ProductService, OrderService],
})
export class ProductModule {}
