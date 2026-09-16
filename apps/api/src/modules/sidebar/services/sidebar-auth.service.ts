import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../shared/services/redis.service';
import { WecomApiService } from '../../wecom/services/wecom-api.service';

const WECOM_OAUTH_AUTHORIZE = 'https://open.weixin.qq.com/connect/oauth2/authorize';

@Injectable()
export class SidebarAuthService {
  private readonly logger = new Logger(SidebarAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wecomApi: WecomApiService,
    private readonly redis: RedisService,
  ) {}

  getCorpId(): string {
    return this.config.get<string>('WX_WORK_CORP_ID', '');
  }

  /**
   * 构造企微网页授权 URL（snsapi_base 静默授权，不弹授权页）
   * state 用于防 CSRF / 携带来源标记
   */
  buildOAuthUrl(redirectUri: string, state: string): string {
    const corpId = this.getCorpId();
    const params = new URLSearchParams({
      appid: corpId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'snsapi_base',
      state,
    });
    return `${WECOM_OAUTH_AUTHORIZE}?${params.toString()}#wechat_redirect`;
  }

  /**
   * OAuth code 换取 Member JWT：
   * getuserinfo(code) → UserId → 白名单校验 → 短期 JWT（type=member）
   */
  async exchangeCodeForMember(code: string): Promise<{
    token: string;
    userId: string;
    corpId: string;
  }> {
    const corpId = this.getCorpId();
    const secret = this.config.get<string>('WX_WORK_SIDEBAR_SECRET', '');
    if (!secret) {
      throw new UnauthorizedException('未配置 WX_WORK_SIDEBAR_SECRET（客户联系应用）');
    }

    const accessToken = await this.wecomApi.getAccessToken(corpId, secret);
    const member = await this.wecomApi.getMemberByCode(accessToken, code);
    this.logger.log(
      `[oauth-callback] getuserinfo → userid="${member.userId ?? '-'}" openid="${member.openId ?? '-'}" (corpId=${corpId})`,
    );
    if (!member.userId) {
      throw new UnauthorizedException('OAuth 未返回成员身份（可能非本企业成员）');
    }

    await this.assertWhitelisted(corpId, member.userId);
    return { token: this.signMemberToken(member.userId, corpId), userId: member.userId, corpId };
  }

  /**
   * 接待成员白名单校验（开放问题 #5：扩展 WecomConfig.memberUserids，任意匹配即放行）
   * 未命中直接抛 Unauthorized
   */
  async assertWhitelisted(corpId: string, userId: string): Promise<void> {
    const allow = await this.isWhitelisted(corpId, userId);
    if (!allow) {
      this.logger.warn(`侧边栏登录被拒：${userId} 不在接待成员白名单 (corpId=${corpId})`);
      throw new UnauthorizedException('您不在接待成员白名单中');
    }
  }

  async isWhitelisted(corpId: string, userId: string): Promise<boolean> {
    const cacheKey = `sidebar:whitelist:${corpId}`;
    let whitelist: string[] | null = null;
    try {
      const cached = await this.redis.get<string>(cacheKey);
      if (cached) whitelist = JSON.parse(cached);
    } catch {
      this.logger.warn('Redis 白名单缓存读取失败，直查 DB');
    }

    if (!whitelist) {
      const configs = await this.prisma.wecomConfig.findMany({
        where: { corpId, isActive: true },
      });
      whitelist = configs.flatMap((c) =>
        Array.isArray(c.memberUserids) ? (c.memberUserids as string[]) : [],
      );
      try {
        await this.redis.set(cacheKey, JSON.stringify(whitelist), 60_000);
      } catch {
        this.logger.warn('Redis 白名单缓存写入失败');
      }
    }

    return whitelist.includes(userId);
  }

  /** 短期 Member JWT（type=member，默认 2h，无 refresh——过期重走 OAuth 静默授权） */
  signMemberToken(userId: string, corpId: string): string {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    const expiresIn = this.config.get<string>('MEMBER_JWT_EXPIRES_IN', '2h');
    const options: jwt.SignOptions = { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] };
    return jwt.sign({ sub: userId, corpId, type: 'member' }, secret, options);
  }

  /**
   * JS-SDK 签名配置（侧边栏 ww.config / ww.agentConfig 用）
   * 必须用「聊天工具栏所属自建应用」的 ticket（与 ww.config 的 agentid 一致），
   * 不能用客户联系应用——否则签名校验失败、JS-SDK 接口不可用
   */
  async getJsapiConfig(url: string): Promise<{
    appId: string;
    agentid: number;
    timestamp: number;
    nonceStr: string;
    signature: string;
    agentSignature: string;
  }> {
    const corpId = this.getCorpId();
    const secret = this.config.get<string>('WX_WORK_SECRET', '');
    if (!secret) {
      throw new UnauthorizedException('未配置 WX_WORK_SECRET（自建应用）');
    }
    const accessToken = await this.wecomApi.getAccessToken(corpId, secret);
    // 两种 ticket 不可混用：wx.config 用企业 jsapi_ticket；wx.agentConfig 用 agent_config ticket
    const jsapiTicket = await this.wecomApi.getJsapiTicket(accessToken);
    const agentTicket = await this.wecomApi.getAgentConfigTicket(accessToken);
    const agentid = Number(this.config.get<string>('WX_WORK_AGENT_ID', '0'));

    const nonceStr = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = (ticket: string) =>
      crypto
        .createHash('sha1')
        .update(`jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`)
        .digest('hex');
    const signature = sign(jsapiTicket); // wx.config 用
    const agentSignature = sign(agentTicket); // wx.agentConfig 用

    // 地面真相：打出参与签名的值，排查 corpid/agentid/url 是否被污染
    this.logger.log(
      `[jsapi-sign] corpid="${corpId}" agentid=${agentid} url="${url}" jsapiTicket=${jsapiTicket.slice(0, 6)}… agentTicket=${agentTicket.slice(0, 6)}…`,
    );

    return {
      appId: corpId,
      agentid,
      timestamp,
      nonceStr,
      signature,
      agentSignature,
    };
  }
}
