import { Module } from '@nestjs/common';
import { RedisService } from '../../shared/services/redis.service';
import { WecomModule } from '../wecom/module';
import { SidebarClientController } from './rest/sidebar-client.controller';
import { SidebarOauthController } from './rest/sidebar-oauth.controller';
import { SidebarAuthService } from './services/sidebar-auth.service';
import { SidebarProfileService } from './services/sidebar-profile.service';
import { SidebarTagsService } from './services/sidebar-tags.service';

/**
 * 侧边栏域（Member 第三身份，纯 REST，独立于 Admin/User）
 * - OAuth2（企微 employees）→ 白名单 → Member JWT
 * - 客户画像聚合（Contact + User 订单历史 + 语义标签）+ JS-SDK 签名
 * 依赖 WecomModule（WecomApiService 做 getuserinfo/getExternalContact/mark_tags/jsapi ticket）
 */
@Module({
  imports: [WecomModule],
  controllers: [SidebarOauthController, SidebarClientController],
  providers: [SidebarAuthService, SidebarProfileService, SidebarTagsService, RedisService],
})
export class SidebarModule {}
