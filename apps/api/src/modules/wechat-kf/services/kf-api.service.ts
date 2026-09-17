import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { WecomApiService } from '../../wecom/services/wecom-api.service';

@Injectable()
export class WechatKfApiService {
  private readonly logger = new Logger(WechatKfApiService.name);
  constructor(
    private readonly wecomApiService: WecomApiService,
    private readonly configService: ConfigService,
  ) {}

  get corpId(): string {
    return this.configService.get<string>('WX_WORK_CORP_ID', '');
  }

  get kfSecret(): string {
    return this.configService.get<string>('WX_WORK_KF_SECRET', '');
  }

  async getAccessToken(): Promise<string> {
    return this.wecomApiService.getAccessToken(this.corpId, this.kfSecret);
  }

  async getKfAccountList(offset = 0, limit = 100): Promise<any> {
    const accessToken = await this.getAccessToken();
    return this.wecomApiService.getKfAccountList(accessToken, offset, limit);
  }

  async getKfServiceState(openKfId: string, externalUserId: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    return this.wecomApiService.getKfServiceState(accessToken, openKfId, externalUserId);
  }

  async transKfServiceState(
    openKfId: string,
    externalUserId: string,
    serviceState: number,
    servicerUserid?: string,
  ): Promise<any> {
    const accessToken = await this.getAccessToken();
    return this.wecomApiService.transKfServiceState(
      accessToken,
      openKfId,
      externalUserId,
      serviceState,
      servicerUserid,
    );
  }

  async sendKfMessage(params: Record<string, any>): Promise<any> {
    const accessToken = await this.getAccessToken();
    return this.wecomApiService.sendKfMessage(accessToken, params);
  }

  async sendText(openKfId: string, externalUserId: string, content: string): Promise<any> {
    return this.sendKfMessage({
      touser: externalUserId,
      open_kfid: openKfId,
      msgtype: 'text',
      text: { content },
    });
  }

  async sendLink(
    openKfId: string,
    externalUserId: string,
    link: { title: string; desc: string; url: string; thumb_url?: string },
  ): Promise<any> {
    return this.sendKfMessage({
      touser: externalUserId,
      open_kfid: openKfId,
      msgtype: 'link',
      link,
    });
  }

  /**
   * 发送企业联系人名片（F2 引导加企微成员）
   * 客户点击名片即可添加该企微成员
   */
  async sendBusinessCard(openKfId: string, externalUserId: string, userid: string): Promise<any> {
    return this.sendKfMessage({
      touser: externalUserId,
      open_kfid: openKfId,
      msgtype: 'business_card',
      business_card: { userid },
    });
  }

  /**
   * 发送小程序卡片消息
   * 官方文档要求 pagepath 以 .html 为后缀，否则在微信中打开提示找不到页面
   */
  async sendMiniProgram(
    openKfId: string,
    externalUserId: string,
    miniProgram: {
      appid: string;
      title: string;
      thumbMediaId: string;
      pagePath: string;
    },
  ): Promise<any> {
    return this.sendKfMessage({
      touser: externalUserId,
      open_kfid: openKfId,
      msgtype: 'miniprogram',
      miniprogram: {
        appid: miniProgram.appid,
        title: miniProgram.title,
        thumb_media_id: miniProgram.thumbMediaId,
        pagepath: this.ensureHtmlSuffix(miniProgram.pagePath),
      },
    });
  }

  /** 上传临时图片素材（供小程序卡片封面等场景），media_id 3 天有效 */
  async uploadKfTempImage(buffer: Buffer, filename = 'cover.png'): Promise<string> {
    const accessToken = await this.getAccessToken();
    const result = await this.wecomApiService.uploadTempImage(accessToken, buffer, filename);
    return result.media_id;
  }

  /**
   * 上传小程序卡片默认封面图。
   * media/upload 属通用接口，按自建应用校验可信 IP（errcode 60020），
   * kf token 被拒时自动降级用自建应用 token 上传。
   */
  async uploadCardCover(coverPath: string): Promise<string> {
    const buffer = fs.readFileSync(coverPath);
    try {
      return await this.uploadKfTempImage(buffer, 'card-cover.png');
    } catch (err: any) {
      if (!err.message.includes('60020')) throw err;
      this.logger.warn('kf token 上传被 60020 拒绝，降级用自建应用 token');
      const corpId = this.configService.get<string>('WX_WORK_CORP_ID', '');
      const appSecret = this.configService.get<string>('WX_WORK_SECRET', '');
      const appToken = await this.wecomApiService.getAccessToken(corpId, appSecret);
      const result = await this.wecomApiService.uploadTempImage(appToken, buffer, 'card-cover.png');
      return result.media_id;
    }
  }

  /** `pages/a/index?x=1` → `pages/a/index.html?x=1`（企微客服消息的 pagepath 要求） */
  private ensureHtmlSuffix(path: string): string {
    const [pathname, query] = path.split('?');
    const withSuffix = pathname.endsWith('.html') ? pathname : `${pathname}.html`;
    return query ? `${withSuffix}?${query}` : withSuffix;
  }

  async syncKfMessage(
    openKfId: string,
    cursor?: string,
    token?: string,
    limit = 1000,
  ): Promise<any> {
    const accessToken = await this.getAccessToken();
    return this.wecomApiService.syncKfMessage(accessToken, openKfId, cursor, token, limit);
  }
}
