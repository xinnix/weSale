import { Module } from '@nestjs/common';
import { WecomModule } from '../wecom/module';
import { RedisService } from '../../shared/services/redis.service';
import { WechatKfCryptoService } from './services/kf-crypto.service';
import { WechatKfApiService } from './services/kf-api.service';
import { WechatKfService } from './services/kf.service';
import { SalesLlmService } from './services/sales-llm.service';
import { KfController } from './rest/kf.controller';

@Module({
  imports: [WecomModule],
  controllers: [KfController],
  providers: [
    WechatKfCryptoService,
    WechatKfApiService,
    WechatKfService,
    SalesLlmService,
    RedisService,
  ],
  exports: [WechatKfApiService, WechatKfCryptoService, WechatKfService],
})
export class WechatKfModule {}
