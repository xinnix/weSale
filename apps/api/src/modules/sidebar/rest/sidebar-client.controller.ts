import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentMember } from '../decorators/current-member';
import { MemberJwtGuard } from '../guards/member-jwt.guard';
import { SidebarAuthService } from '../services/sidebar-auth.service';
import { SidebarProfileService } from '../services/sidebar-profile.service';

/**
 * 侧边栏客户数据（Member 数据面：画像 + JS-SDK 签名）
 * 全部走 MemberJwtGuard，与 Admin/User 身份面彻底隔离
 */
@Controller('sidebar')
@UseGuards(MemberJwtGuard)
export class SidebarClientController {
  constructor(
    private readonly profileService: SidebarProfileService,
    private readonly authService: SidebarAuthService,
  ) {}

  /** 客户画像聚合（标签/积分/订单历史/最近 KF 会话摘要） */
  @Get('profile')
  profile(
    @Query('externalUserId') externalUserId: string,
    @CurrentMember() member: { userId: string; corpId: string },
  ) {
    if (!externalUserId) throw new BadRequestException('缺少 externalUserId');
    return this.profileService.getProfile(externalUserId, member);
  }

  /** JS-SDK 签名（侧边栏 ww.config 前置） */
  @Post('jsapi-config')
  jsapiConfig(@Body('url') url: string) {
    if (!url) throw new BadRequestException('缺少 url');
    return this.authService.getJsapiConfig(url);
  }
}
