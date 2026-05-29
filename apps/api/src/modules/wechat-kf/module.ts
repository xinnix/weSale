import { Module } from '@nestjs/common';
import { WecomModule } from '../wecom/module';
import { WechatKfCryptoService } from './services/kf-crypto.service';
import { WechatKfApiService } from './services/kf-api.service';
import { WechatKfService } from './services/kf.service';
import { KfController } from './rest/kf.controller';

@Module({
  imports: [WecomModule],
  controllers: [KfController],
  providers: [WechatKfCryptoService, WechatKfApiService, WechatKfService],
  exports: [WechatKfApiService, WechatKfCryptoService, WechatKfService],
})
export class WechatKfModule {}
