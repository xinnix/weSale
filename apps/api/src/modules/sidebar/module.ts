import { Module } from '@nestjs/common';
import { RedisService } from '../../shared/services/redis.service';
import { ProductModule } from '../product/module';
import { WecomModule } from '../wecom/module';
import { SidebarClientController } from './rest/sidebar-client.controller';
import { SidebarOauthController } from './rest/sidebar-oauth.controller';
import { CopilotGenerateService } from './services/copilot-generate.service';
import { CopilotLlmService } from './services/copilot-llm.service';
import { SendEventService } from './services/send-event.service';
import { SidebarAuthService } from './services/sidebar-auth.service';
import { SidebarProductsService } from './services/sidebar-products.service';
import { SidebarProfileService } from './services/sidebar-profile.service';
import { SidebarTagsService } from './services/sidebar-tags.service';

/**
 * 侧边栏域（Member 第三身份，纯 REST，独立于 Admin/User）
 * - OAuth2（企微 employees）→ 白名单 → Member JWT
 * - 客户画像聚合（Contact + User 订单历史 + 语义标签）+ JS-SDK 签名
 * - AI Copilot 生成（意图识别 + 3 策略流式）+ 发送事件上报
 * 依赖 WecomModule（企微 API）、ProductModule（产品目录供 prompt）
 */
@Module({
  imports: [WecomModule, ProductModule],
  controllers: [SidebarOauthController, SidebarClientController],
  providers: [
    SidebarAuthService,
    SidebarProfileService,
    SidebarTagsService,
    CopilotLlmService,
    CopilotGenerateService,
    SendEventService,
    SidebarProductsService,
    RedisService,
  ],
})
export class SidebarModule {}
