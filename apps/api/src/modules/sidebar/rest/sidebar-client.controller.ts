import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentMember } from '../decorators/current-member';
import { MemberJwtGuard } from '../guards/member-jwt.guard';
import { CopilotGenerateService } from '../services/copilot-generate.service';
import { SendEventInput, SendEventService } from '../services/send-event.service';
import { SidebarAuthService } from '../services/sidebar-auth.service';
import { SidebarProfileService } from '../services/sidebar-profile.service';

/**
 * 侧边栏客户数据（Member 数据面：画像 + AI 生成 + 发送上报 + JS-SDK 签名）
 * 全部走 MemberJwtGuard，与 Admin/User 身份面彻底隔离
 */
@Controller('sidebar')
@UseGuards(MemberJwtGuard)
export class SidebarClientController {
  constructor(
    private readonly profileService: SidebarProfileService,
    private readonly authService: SidebarAuthService,
    private readonly copilotGenerateService: CopilotGenerateService,
    private readonly sendEventService: SendEventService,
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

  /**
   * AI 生成（SSE）：意图识别 + 3 策略并行流式话术
   * 事件：intent → strategy(A/B/C) 增量 → done
   * 可选 pastedConversation：销售粘贴的实时对话（私聊记录企微不开放，人工粘贴替代）
   */
  @Post('analyze')
  async analyze(
    @Body() body: { externalUserId?: string; pastedConversation?: string },
    @CurrentMember() member: { userId: string; corpId: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!body?.externalUserId) throw new BadRequestException('缺少 externalUserId');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 客户端断开 → 取消上游 LLM 请求
    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
      for await (const event of this.copilotGenerateService.generateStream(
        body.externalUserId,
        member,
        controller.signal,
        body.pastedConversation,
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    }
    res.end();
  }

  /** 发送事件上报（采纳率 + 合规审计） */
  @Post('send/record')
  sendRecord(
    @Body() body: SendEventInput,
    @CurrentMember() member: { userId: string; corpId: string },
  ) {
    if (!body?.externalUserId || !body?.msgType) {
      throw new BadRequestException('缺少 externalUserId / msgType');
    }
    return this.sendEventService.record(body, member);
  }

  /** JS-SDK 签名（侧边栏 ww.config 前置） */
  @Post('jsapi-config')
  jsapiConfig(@Body('url') url: string) {
    if (!url) throw new BadRequestException('缺少 url');
    return this.authService.getJsapiConfig(url);
  }
}
