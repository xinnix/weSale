import { Module } from '@nestjs/common';
import { WecomController } from './rest/wecom.controller';
import { WecomApiService } from './services/wecom-api.service';
import { WecomCryptoService } from './services/wecom-crypto.service';
import { WecomConfigService } from './services/wecom-config.service';
import { WecomMessageService } from './services/wecom-message.service';
import { WecomEventService } from './services/wecom-event.service';
import { ExternalContactService } from './services/external-contact.service';
import { RedisService } from '../../shared/services/redis.service';

@Module({
  controllers: [WecomController],
  providers: [
    WecomApiService,
    WecomCryptoService,
    WecomConfigService,
    WecomMessageService,
    WecomEventService,
    ExternalContactService,
    RedisService,
  ],
  exports: [WecomApiService, WecomCryptoService, WecomConfigService, ExternalContactService],
})
export class WecomModule {}
