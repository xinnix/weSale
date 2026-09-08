import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../shared/services/redis.service';

const WECOM_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin';

@Injectable()
export class WecomApiService {
  private readonly logger = new Logger(WecomApiService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * 获取 access_token（带 Redis 缓存）
   * 缓存 key: wecom:access_token:{corpId}
   * TTL: expires_in * 0.9（90% 安全裕度）
   */
  async getAccessToken(corpId: string, secret: string): Promise<string> {
    const cacheKey = `wecom:access_token:${corpId}`;

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch {
      this.logger.warn('Redis 缓存读取失败，将直接请求 API');
    }

    const url = `${WECOM_API_BASE}/gettoken?corpid=${corpId}&corpsecret=${secret}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode !== 0) {
      throw new Error(`获取企业微信 access_token 失败: ${data.errmsg} (errcode: ${data.errcode})`);
    }

    const ttlMs = Math.floor(data.expires_in * 0.9) * 1000;
    try {
      await this.redisService.set(cacheKey, data.access_token, ttlMs);
    } catch {
      this.logger.warn('Redis 缓存写入失败');
    }

    return data.access_token;
  }

  /**
   * 发送应用消息
   * POST /cgi-bin/message/send?access_token=TOKEN
   */
  async sendMessage(accessToken: string, params: Record<string, any>): Promise<any> {
    return this.post(`${WECOM_API_BASE}/message/send?access_token=${accessToken}`, params);
  }

  /**
   * 获取客服账号列表
   * POST /cgi-bin/kf/account/list
   */
  async getKfAccountList(accessToken: string, offset = 0, limit = 100): Promise<any> {
    return this.post(`${WECOM_API_BASE}/kf/account/list?access_token=${accessToken}`, {
      offset,
      limit,
    });
  }

  /**
   * 获取客服会话状态
   * POST /cgi-bin/kf/service_state/get
   */
  async getKfServiceState(
    accessToken: string,
    openKfId: string,
    externalUserId: string,
  ): Promise<any> {
    return this.post(`${WECOM_API_BASE}/kf/service_state/get?access_token=${accessToken}`, {
      open_kfid: openKfId,
      external_userid: externalUserId,
    });
  }

  /**
   * 变更客服会话状态
   * POST /cgi-bin/kf/service_state/trans
   */
  async transKfServiceState(
    accessToken: string,
    openKfId: string,
    externalUserId: string,
    serviceState: number,
    servicerUserid?: string,
  ): Promise<any> {
    const params: Record<string, any> = {
      open_kfid: openKfId,
      external_userid: externalUserId,
      service_state: serviceState,
    };
    if (servicerUserid) {
      params.servicer_userid = servicerUserid;
    }
    return this.post(
      `${WECOM_API_BASE}/kf/service_state/trans?access_token=${accessToken}`,
      params,
    );
  }

  /**
   * 发送客服消息
   * POST /cgi-bin/kf/send_msg
   */
  async sendKfMessage(accessToken: string, params: Record<string, any>): Promise<any> {
    return this.post(`${WECOM_API_BASE}/kf/send_msg?access_token=${accessToken}`, params);
  }

  /**
   * 同步客服消息
   * POST /cgi-bin/kf/sync_msg
   */
  async syncKfMessage(
    accessToken: string,
    openKfId: string,
    cursor?: string,
    token?: string,
    limit = 1000,
  ): Promise<any> {
    const params: Record<string, any> = {
      open_kfid: openKfId,
      limit,
    };
    if (cursor) {
      params.cursor = cursor;
    }
    if (token) {
      params.token = token;
    }
    return this.post(`${WECOM_API_BASE}/kf/sync_msg?access_token=${accessToken}`, params);
  }

  /**
   * 上传临时素材（图片），返回 media_id（3 天有效）
   * POST /cgi-bin/media/upload?access_token=TOKEN&type=image
   */
  async uploadTempImage(
    accessToken: string,
    buffer: Buffer,
    filename = 'image.png',
  ): Promise<{ media_id: string; created_at?: string; type?: string }> {
    const form = new FormData();
    form.append('media', new Blob([new Uint8Array(buffer)], { type: 'image/png' }), filename);

    const response = await fetch(
      `${WECOM_API_BASE}/media/upload?access_token=${accessToken}&type=image`,
      { method: 'POST', body: form },
    );
    const data = await response.json();

    if (data.errcode && data.errcode !== 0) {
      this.logger.error(`上传临时素材失败: ${data.errmsg} (errcode: ${data.errcode})`);
      throw new Error(`企业微信 API 错误: ${data.errmsg} (errcode: ${data.errcode})`);
    }

    return data;
  }

  private async post(url: string, body: Record<string, any>): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (data.errcode && data.errcode !== 0) {
      this.logger.error(`企业微信 API 调用失败: ${data.errmsg} (errcode: ${data.errcode})`);
      throw new Error(`企业微信 API 错误: ${data.errmsg} (errcode: ${data.errcode})`);
    }

    return data;
  }
}
