import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as crypto from 'crypto';
import { Public } from '../../auth/decorators/decorators';
import { CurrentMember } from '../decorators/current-member';
import { MemberJwtGuard } from '../guards/member-jwt.guard';
import { SidebarAuthService } from '../services/sidebar-auth.service';

/**
 * 侧边栏企微 OAuth2（Member 身份，静默授权）
 * authorize → 企微授权页(code) → callback → 白名单校验 → 302 带 token 回前端
 */
@Controller('sidebar/oauth')
export class SidebarOauthController {
  constructor(
    private readonly authService: SidebarAuthService,
    private readonly config: ConfigService,
  ) {}

  /** 跳转企微网页授权（snsapi_base 静默），state 防 CSRF */
  @Public()
  @Get('authorize')
  authorize(@Res() res: Response) {
    const callbackUrl = this.config.get<string>('SIDEBAR_CALLBACK_URL', '');
    if (!callbackUrl) {
      throw new BadRequestException('未配置 SIDEBAR_CALLBACK_URL（OAuth 回调地址）');
    }
    const state = crypto.randomBytes(8).toString('hex');
    return res.redirect(this.authService.buildOAuthUrl(callbackUrl, state));
  }

  /** OAuth 回调：code 换 Member JWT → 302 携 token 回侧边栏前端（前端 replaceState 清地址栏） */
  @Public()
  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    const { token } = await this.authService.exchangeCodeForMember(code);
    const frontUrl = this.config.get<string>('SIDEBAR_EXTERNAL_URL', '');
    if (!frontUrl) {
      throw new BadRequestException('未配置 SIDEBAR_EXTERNAL_URL（侧边栏前端地址）');
    }
    return res.redirect(`${frontUrl}?token=${encodeURIComponent(token)}`);
  }

  /** 当前成员身份 */
  @UseGuards(MemberJwtGuard)
  @Get('me')
  me(@CurrentMember() member: { userId: string; corpId: string }) {
    return { member };
  }
}
