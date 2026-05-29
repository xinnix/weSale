import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WecomApiService } from '../../wecom/services/wecom-api.service';

@Injectable()
export class WechatKfApiService {
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
