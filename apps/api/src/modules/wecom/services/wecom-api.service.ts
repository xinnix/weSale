import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../../../shared/services/redis.service';

const WECOM_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin';

@Injectable()
export class WecomApiService {
  private readonly logger = new Logger(WecomApiService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * 获取 access_token（带 Redis 缓存）
   * 缓存 key: wecom:access_token:{corpId}:{secretFp}（含 secret 指纹，避免多应用共用串用）
   * TTL: expires_in * 0.9（90% 安全裕度）
   */
  async getAccessToken(corpId: string, secret: string): Promise<string> {
    const secretFp = crypto.createHash('md5').update(secret).digest('hex').slice(0, 8);
    const cacheKey = `wecom:access_token:${corpId}:${secretFp}`;

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
   * OAuth2 静默授权换取成员身份
   * GET /cgi-bin/auth/getuserinfo?code=CODE
   * 用「客户联系」应用 token（需开通客户联系权限）
   */
  async getMemberByCode(
    accessToken: string,
    code: string,
  ): Promise<{ userId?: string; openId?: string; errcode?: number }> {
    const url = `${WECOM_API_BASE}/auth/getuserinfo?access_token=${accessToken}&code=${encodeURIComponent(code)}`;
    const data = await this.get(url);
    return {
      userId: data.userid,
      openId: data.openid,
      errcode: data.errcode,
    };
  }

  /**
   * 获取客户详情（企微好友/客服访客，客户联系权限）
   * GET /cgi-bin/externalcontact/get?external_userid=XXX
   */
  async getExternalContact(accessToken: string, externalUserId: string): Promise<any> {
    const url = `${WECOM_API_BASE}/externalcontact/get?access_token=${accessToken}&external_userid=${encodeURIComponent(externalUserId)}`;
    return this.get(url);
  }

  /**
   * 客户标签勾选/移除（双写企微原生标签，销售聊天界面可见）
   * POST /cgi-bin/externalcontact/mark_tag
   */
  async markTags(
    accessToken: string,
    params: {
      externalUserId: string;
      addTag?: string[];
      removeTag?: string[];
    },
  ): Promise<any> {
    const body: Record<string, any> = {
      userid: params.externalUserId,
    };
    if (params.addTag?.length) body.add_tag = params.addTag;
    if (params.removeTag?.length) body.remove_tag = params.removeTag;
    return this.post(
      `${WECOM_API_BASE}/externalcontact/mark_tag?access_token=${accessToken}`,
      body,
    );
  }

  /**
   * 生成/更新「联系我」活码配置（F8 站外获客）
   * POST /cgi-bin/externalcontact/add_contact_way
   */
  async addContactWay(
    accessToken: string,
    params: {
      type: number; // 1 单人 / 2 多人
      scene: number; // 1 在小程序中联系 / 2 通过二维码联系
      user?: string[];
      party?: string[];
      state?: string;
      remark?: string;
      autoAddCustomerTag?: number;
      customerType?: number;
    },
  ): Promise<any> {
    return this.post(
      `${WECOM_API_BASE}/externalcontact/add_contact_way?access_token=${accessToken}`,
      params,
    );
  }

  /**
   * 删除「联系我」活码配置（活码停用）
   * POST /cgi-bin/externalcontact/del_contact_way
   */
  async delContactWay(accessToken: string, configId: string): Promise<any> {
    return this.post(
      `${WECOM_API_BASE}/externalcontact/del_contact_way?access_token=${accessToken}`,
      {
        config_id: configId,
      },
    );
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

  /**
   * 获取 jsapi_ticket（侧边栏 JS-SDK 签名用）
   * GET /cgi-bin/get_jsapi_ticket?access_token=TOKEN
   */
  async getJsapiTicket(accessToken: string): Promise<string> {
    const url = `${WECOM_API_BASE}/get_jsapi_ticket?access_token=${accessToken}`;
    const data = await this.get(url);
    return data.ticket;
  }

  private async get(url: string): Promise<any> {
    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode && data.errcode !== 0) {
      this.logger.error(`企业微信 API 调用失败: ${data.errmsg} (errcode: ${data.errcode})`);
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
