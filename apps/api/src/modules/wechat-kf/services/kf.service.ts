import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WechatKfApiService } from './kf-api.service';

/** sync_msg 返回的单条消息 */
interface KfSyncMsg {
  msgid: string;
  open_kfid?: string;
  external_userid?: string;
  send_time: number;
  origin: number; // 3=客户 4=系统 5=接待人员
  servicer_userid?: string;
  msgtype: string;
  [key: string]: any; // 各消息类型的具体内容
}

/** sync_msg 返回结果 */
interface KfSyncResult {
  errcode: number;
  errmsg: string;
  next_cursor: string;
  has_more: number;
  msg_list: KfSyncMsg[];
}

/** KF 回调解析结果 */
export interface KfCallbackEvent {
  token: string;
  openKfId: string;
}

const ORIGIN_MAP: Record<number, 'CUSTOMER' | 'SYSTEM' | 'SERVICER'> = {
  3: 'CUSTOMER',
  4: 'SYSTEM',
  5: 'SERVICER',
};

const MSGTYPE_MAP: Record<string, string> = {
  text: 'TEXT',
  image: 'IMAGE',
  voice: 'VOICE',
  video: 'VIDEO',
  file: 'FILE',
  location: 'LOCATION',
  link: 'LINK_CARD',
  miniprogram: 'MINIPROGRAM',
  msgmenu: 'MENU',
  business_card: 'BUSINESS_CARD',
  event: 'EVENT',
};

@Injectable()
export class WechatKfService {
  private readonly logger = new Logger(WechatKfService.name);

  constructor(
    private readonly kfApiService: WechatKfApiService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 发送文本消息
   */
  async sendText(openKfId: string, externalUserId: string, content: string): Promise<any> {
    try {
      const result = await this.kfApiService.sendText(openKfId, externalUserId, content);
      this.logger.log(`发送文本消息成功: to=${externalUserId}`);
      return result;
    } catch (error: any) {
      this.logger.error(`发送文本消息失败: to=${externalUserId}`, error);
      throw error;
    }
  }

  /**
   * 发送链接消息（用于支付卡片等）
   */
  async sendLink(
    openKfId: string,
    externalUserId: string,
    link: { title: string; desc: string; url: string; thumb_url?: string },
  ): Promise<any> {
    try {
      const result = await this.kfApiService.sendLink(openKfId, externalUserId, link);
      this.logger.log(`发送链接消息成功: to=${externalUserId}, title=${link.title}`);
      return result;
    } catch (error: any) {
      this.logger.error(`发送链接消息失败: to=${externalUserId}`, error);
      throw error;
    }
  }

  /**
   * 解析 KF 回调 XML，提取 Token + OpenKfId
   * 回调只推送事件通知，不含消息内容
   */
  parseKfCallback(xmlData: Record<string, string>): KfCallbackEvent | null {
    const event = xmlData.Event;
    if (event !== 'kf_msg_or_event') {
      return null;
    }

    const token = xmlData.Token || '';
    const openKfId = xmlData.open_kfid || xmlData.OpenKfId || '';

    if (!openKfId) {
      this.logger.warn(`KF 回调缺少 OpenKfId, 已知字段: ${Object.keys(xmlData).join(',')}`);
      return null;
    }

    return { token, openKfId };
  }

  /**
   * 收到回调后：拉取消息 + 持久化
   * 1. 从 DB 读取 cursor
   * 2. 调 sync_msg 拉取消息列表
   * 3. 逐条写入 ConversationMessage
   * 4. 更新 cursor
   * 5. has_more 时继续拉取
   */
  async handleCallbackAndSync(callbackToken: string, openKfId: string): Promise<void> {
    try {
      // 读取上次游标
      const cursorRow = await this.prisma.kfSyncCursor.findUnique({
        where: { openKfId },
      });
      const cursor = cursorRow?.cursor;

      let currentCursor = cursor;
      let hasMore = true;

      while (hasMore) {
        const result: KfSyncResult = await this.kfApiService.syncKfMessage(
          openKfId,
          currentCursor,
          callbackToken,
          1000,
        );

        if (result.errcode !== 0) {
          this.logger.error(`sync_msg 失败: ${result.errmsg} (errcode: ${result.errcode})`);
          return;
        }

        if (result.msg_list?.length > 0) {
          this.logger.log(`sync_msg 返回 ${result.msg_list.length} 条消息`);
          await this.persistMessages(result.msg_list);
          // 对客户消息自动回复
          await this.autoReply(result.msg_list, openKfId);
        }

        currentCursor = result.next_cursor;
        hasMore = result.has_more === 1;

        // 每轮都更新 cursor，避免丢失
        if (currentCursor) {
          await this.prisma.kfSyncCursor.upsert({
            where: { openKfId },
            create: { openKfId, cursor: currentCursor },
            update: { cursor: currentCursor },
          });
        }
      }

      this.logger.log(`KF 消息同步完成: openKfId=${openKfId}`);
    } catch (error: any) {
      this.logger.error(`KF 消息同步异常: openKfId=${openKfId}`, error);
    }
  }

  /**
   * 批量持久化消息到数据库
   * 对每条消息：确保 Contact + Session 存在，然后写入 Message
   */
  private async persistMessages(msgList: KfSyncMsg[]): Promise<void> {
    for (const msg of msgList) {
      try {
        // 事件消息可能没有 external_userid
        const externalUserId = msg.external_userid;
        const openKfId = msg.open_kfid || '';

        // 确保 Contact 存在（仅非事件消息）
        let contactId: string | undefined;
        if (externalUserId) {
          const contact = await this.prisma.contact.upsert({
            where: { openId: externalUserId },
            create: { openId: externalUserId },
            update: { lastActiveAt: new Date() },
          });
          contactId = contact.id;
        }

        // 确保 ConversationSession 存在
        let sessionId: string | undefined;
        if (contactId && openKfId) {
          const sessionKey = `${openKfId}:${externalUserId}`;
          const session = await this.prisma.conversationSession.upsert({
            where: { sessionKey },
            create: {
              contactId,
              openKfId,
              sessionKey,
              lastActiveAt: new Date(msg.send_time * 1000),
            },
            update: {
              lastActiveAt: new Date(msg.send_time * 1000),
              turnCount: { increment: 1 },
            },
          });
          sessionId = session.id;
        }

        // 跳过没有 session 的消息（无法关联）
        if (!sessionId) {
          this.logger.warn(`消息缺少 session 信息，跳过: msgid=${msg.msgid}`);
          continue;
        }

        // 去重：kfMsgId 唯一
        const existing = await this.prisma.conversationMessage.findUnique({
          where: { kfMsgId: msg.msgid },
        });
        if (existing) continue;

        // 映射字段
        const role = msg.origin === 5 ? 'assistant' : 'user';
        const origin = ORIGIN_MAP[msg.origin] || 'CUSTOMER';
        const type = MSGTYPE_MAP[msg.msgtype] || 'TEXT';
        const content = this.extractContent(msg);
        const sendTime = new Date(msg.send_time * 1000);

        await this.prisma.conversationMessage.create({
          data: {
            sessionId,
            role: role as 'user' | 'assistant',
            type: type as any,
            origin: origin as any,
            content,
            kfMsgId: msg.msgid,
            openKfId,
            externalUserId,
            servicerUserId: msg.servicer_userid,
            sendTime,
          },
        });
      } catch (error: any) {
        this.logger.error(`消息持久化失败: msgid=${msg.msgid}`, error);
      }
    }
  }

  /**
   * 自动回复：客户消息到达后发送默认欢迎语
   * 会话状态 0（未处理）时需先转为 1（智能助手）才能发消息
   */
  private async autoReply(msgList: KfSyncMsg[], openKfId: string): Promise<void> {
    const customerMsgs = msgList.filter(
      (m) => m.origin === 3 && m.external_userid && m.msgtype === 'text',
    );
    this.logger.log(`autoReply: ${msgList.length} 条消息, ${customerMsgs.length} 条客户文本消息`);
    for (const msg of customerMsgs) {
      try {
        // 检查会话状态：0=未处理→转智能助手, 3=人工接待中→跳过自动回复
        const stateRes = await this.kfApiService.getKfServiceState(openKfId, msg.external_userid);
        this.logger.log(`会话状态: ${JSON.stringify(stateRes)}`);
        if (stateRes.service_state === 3) {
          this.logger.log(`会话已人工接待，跳过自动回复: externalUserId=${msg.external_userid}`);
          continue;
        }
        if (stateRes.service_state === 0) {
          const transRes = await this.kfApiService.transKfServiceState(
            openKfId,
            msg.external_userid,
            1,
          );
          this.logger.log(
            `会话已转为智能助手: externalUserId=${msg.external_userid}, transRes=${JSON.stringify(transRes)}`,
          );
        }

        const replyText = this.configService.get<string>(
          'WX_WORK_KF_AUTO_REPLY',
          '您好，感谢您的咨询！我们正在为您安排专属顾问，请稍候～',
        );
        await this.kfApiService.sendText(openKfId, msg.external_userid, replyText);
        this.logger.log(`自动回复已发送: to=${msg.external_userid}`);
      } catch (error: any) {
        this.logger.error(`自动回复失败: to=${msg.external_userid}`, error);
      }
    }
  }

  /**
   * 从 sync_msg 消息中提取内容文本
   * 复杂消息类型序列化为 JSON
   */
  private extractContent(msg: KfSyncMsg): string {
    const type = msg.msgtype;
    const body = msg[type];

    if (!body) return '';

    switch (type) {
      case 'text':
        return body.content || '';
      case 'image':
      case 'voice':
      case 'video':
      case 'file':
        return JSON.stringify({ media_id: body.media_id });
      case 'location':
        return JSON.stringify({
          latitude: body.latitude,
          longitude: body.longitude,
          name: body.name,
          address: body.address,
        });
      case 'link':
        return JSON.stringify({
          title: body.title,
          desc: body.desc,
          url: body.url,
          pic_url: body.pic_url,
        });
      case 'event':
        return JSON.stringify(body);
      default:
        return JSON.stringify(body);
    }
  }

  /**
   * 生成 JSSDK 签名
   * 用于前端页面调用微信 JS-SDK
   */
  async generateJssdkSignature(url: string): Promise<{
    appId: string;
    timestamp: number;
    nonceStr: string;
    signature: string;
  }> {
    const crypto = await import('crypto');
    const appId = this.configService.get<string>('WX_WORK_CORP_ID', '');

    const accessToken = await this.kfApiService.getAccessToken();

    // 获取 jsapi_ticket
    const ticketUrl = `https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket?access_token=${accessToken}`;
    const ticketRes = await fetch(ticketUrl);
    const ticketData = await ticketRes.json();

    if (ticketData.errcode !== 0) {
      throw new Error(`获取 jsapi_ticket 失败: ${ticketData.errmsg}`);
    }

    const nonceStr = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);

    const signStr = `jsapi_ticket=${ticketData.ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
    const signature = crypto.createHash('sha1').update(signStr).digest('hex');

    return { appId, timestamp, nonceStr, signature };
  }
}
