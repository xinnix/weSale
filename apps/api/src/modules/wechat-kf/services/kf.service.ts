import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../shared/services/redis.service';
import { WecomApiService } from '../../wecom/services/wecom-api.service';
import { WechatKfApiService } from './kf-api.service';
import { SalesLlmService } from './sales-llm.service';
import { OrderService } from '../../product/services/order.service';

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

/** 预映射的消息行，用于批量插入 */
interface PreMappedMessage {
  kfMsgId: string;
  sessionKey: string;
  externalUserId?: string;
  role: 'user' | 'assistant';
  origin: string;
  type: string;
  content: string;
  sendTime: Date;
  servicerUserId?: string;
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
export class WechatKfService implements OnModuleDestroy {
  private readonly logger = new Logger(WechatKfService.name);
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly kfApiService: WechatKfApiService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly salesLlmService: SalesLlmService,
    private readonly orderService: OrderService,
    private readonly wecomApiService: WecomApiService,
  ) {}

  onModuleDestroy() {
    for (const [, timer] of this.debounceTimers) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  // ─── 公共方法（供 tRPC router 调用）────────────────────────────

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

  // ─── 核心同步流程 ────────────────────────────────────────────

  async handleCallbackAndSync(callbackToken: string, openKfId: string): Promise<void> {
    // 分布式锁：防止同一 openKfId 并发同步
    let lockValue: string | null = null;
    const redisAvailable = this.redisService.isAvailable();

    if (redisAvailable) {
      try {
        lockValue = await this.redisService.acquireLock(`kf:sync:${openKfId}`, 30_000);
      } catch {
        this.logger.warn('获取分布式锁异常，跳过锁');
      }
      if (!lockValue) {
        this.logger.warn(`跳过同步，锁被占用: openKfId=${openKfId}`);
        return;
      }
    }

    try {
      const cursorRow = await this.prisma.kfSyncCursor.findUnique({ where: { openKfId } });
      let currentCursor = cursorRow?.cursor;
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
          const newMsgs = await this.batchPersistMessages(
            result.msg_list,
            openKfId,
            result.next_cursor,
          );

          // 仅对真正新增的客户文本消息入队防抖自动回复
          const customerMsgs = newMsgs.filter(
            (m) => m.origin === 3 && m.external_userid && m.msgtype === 'text',
          );
          for (const msg of customerMsgs) {
            const sessionKey = `${openKfId}:${msg.external_userid}`;
            const content = msg.text?.content || '';
            await this.enqueueForAutoReply(sessionKey, openKfId, msg.external_userid!, content);
          }
        } else if (result.next_cursor) {
          // 空批次也推进 cursor
          await this.prisma.kfSyncCursor.upsert({
            where: { openKfId },
            create: { openKfId, cursor: result.next_cursor },
            update: { cursor: result.next_cursor },
          });
        }

        currentCursor = result.next_cursor;
        hasMore = result.has_more === 1;
      }

      this.logger.log(`KF 消息同步完成: openKfId=${openKfId}`);
    } catch (error: any) {
      this.logger.error(`KF 消息同步异常: openKfId=${openKfId}`, error);
    } finally {
      if (lockValue) {
        try {
          await this.redisService.releaseLock(`kf:sync:${openKfId}`, lockValue);
        } catch {
          // 锁有 TTL 兜底，释放失败不阻塞
        }
      }
    }
  }

  // ─── 批量持久化（事务）─────────────────────────────────────

  /**
   * 在单个事务内：批量 upsert Contact/Session + createMany Message + 更新 cursor
   * 返回真正新插入的 KfSyncMsg[]
   */
  private async batchPersistMessages(
    msgList: KfSyncMsg[],
    openKfId: string,
    nextCursor: string,
  ): Promise<KfSyncMsg[]> {
    return this.prisma.$transaction(async (tx) => {
      // 1. 预映射：收集唯一实体和消息行
      const uniqueUserIds = new Set<string>();
      const sessionKeyToUserMap = new Map<string, string>(); // sessionKey -> externalUserId
      const sessionKeyMaxTime = new Map<string, number>(); // sessionKey -> max send_time
      const preMapped: PreMappedMessage[] = [];

      for (const msg of msgList) {
        const externalUserId = msg.external_userid;
        const msgOpenKfId = msg.open_kfid || openKfId;

        if (!externalUserId) continue;

        const sessionKey = `${msgOpenKfId}:${externalUserId}`;
        uniqueUserIds.add(externalUserId);
        sessionKeyToUserMap.set(sessionKey, externalUserId);

        const prevMax = sessionKeyMaxTime.get(sessionKey) || 0;
        if (msg.send_time > prevMax) sessionKeyMaxTime.set(sessionKey, msg.send_time);

        preMapped.push({
          kfMsgId: msg.msgid,
          sessionKey,
          externalUserId,
          role: msg.origin === 5 ? 'assistant' : 'user',
          origin: ORIGIN_MAP[msg.origin] || 'CUSTOMER',
          type: MSGTYPE_MAP[msg.msgtype] || 'TEXT',
          content: this.extractContent(msg),
          sendTime: new Date(msg.send_time * 1000),
          servicerUserId: msg.servicer_userid,
        });
      }

      if (preMapped.length === 0) {
        // 仅有事件消息，只更新 cursor
        if (nextCursor) {
          await tx.kfSyncCursor.upsert({
            where: { openKfId },
            create: { openKfId, cursor: nextCursor },
            update: { cursor: nextCursor },
          });
        }
        return [];
      }

      // 2. 批量 upsert Contacts
      const contactMap = new Map<string, string>(); // openId -> contact.id
      for (const uid of uniqueUserIds) {
        const c = await tx.contact.upsert({
          where: { openId: uid },
          create: { openId: uid },
          update: { lastActiveAt: new Date() },
        });
        contactMap.set(uid, c.id);
      }

      // 3. 批量 upsert Sessions（不 increment turnCount）
      const sessionMap = new Map<string, string>(); // sessionKey -> session.id
      for (const [sessionKey, uid] of sessionKeyToUserMap) {
        const contactId = contactMap.get(uid);
        if (!contactId) continue;
        const maxTime = sessionKeyMaxTime.get(sessionKey) || Date.now() / 1000;
        const s = await tx.conversationSession.upsert({
          where: { sessionKey },
          create: {
            contactId,
            openKfId,
            sessionKey,
            lastActiveAt: new Date(maxTime * 1000),
          },
          update: {
            lastActiveAt: new Date(maxTime * 1000),
          },
        });
        sessionMap.set(sessionKey, s.id);
      }

      // 4. createMany Messages + skipDuplicates（利用 kfMsgId 唯一索引）
      const messageRows = preMapped
        .map((m) => {
          const sessionId = sessionMap.get(m.sessionKey);
          if (!sessionId) return null;
          return {
            sessionId,
            role: m.role,
            type: m.type as any,
            origin: m.origin as any,
            content: m.content,
            kfMsgId: m.kfMsgId,
            openKfId,
            externalUserId: m.externalUserId,
            servicerUserId: m.servicerUserId,
            sendTime: m.sendTime,
          };
        })
        .filter(Boolean) as any[];

      if (messageRows.length > 0) {
        await tx.conversationMessage.createMany({
          data: messageRows,
          skipDuplicates: true,
        });
      }

      // 5. 查回实际插入的消息，按 session 计数更新 turnCount
      const insertedMsgs = await tx.conversationMessage.findMany({
        where: { kfMsgId: { in: messageRows.map((m: any) => m.kfMsgId) } },
        select: { kfMsgId: true, sessionId: true },
      });

      const newCountPerSession = new Map<string, number>();
      for (const msg of insertedMsgs) {
        newCountPerSession.set(msg.sessionId, (newCountPerSession.get(msg.sessionId) || 0) + 1);
      }
      for (const [sessionId, count] of newCountPerSession) {
        await tx.conversationSession.update({
          where: { id: sessionId },
          data: { turnCount: { increment: count } },
        });
      }

      // 6. 更新 cursor
      if (nextCursor) {
        await tx.kfSyncCursor.upsert({
          where: { openKfId },
          create: { openKfId, cursor: nextCursor },
          update: { cursor: nextCursor },
        });
      }

      // 7. 返回真正新插入的原始消息
      const insertedIds = new Set(insertedMsgs.map((m) => m.kfMsgId));
      const newSyncMsgs = msgList.filter((m) => insertedIds.has(m.msgid));
      this.logger.log(`批量持久化完成: ${msgList.length} 条中 ${newSyncMsgs.length} 条为新消息`);
      return newSyncMsgs;
    });
  }

  // ─── Redis 防抖自动回复 ────────────────────────────────────

  private async enqueueForAutoReply(
    sessionKey: string,
    openKfId: string,
    externalUserId: string,
    content: string,
  ): Promise<void> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) {
      // Redis 不可用时降级为立即回复
      this.logger.warn('Redis 不可用，立即发送自动回复');
      await this.executeAutoReply(openKfId, externalUserId);
      return;
    }

    try {
      await redisClient.rpush(`kf:debounce:${sessionKey}`, content);
    } catch {
      this.logger.warn('Redis RPUSH 失败，降级为立即回复');
      await this.executeAutoReply(openKfId, externalUserId);
      return;
    }

    this.scheduleDebouncedAutoReply(sessionKey, openKfId, externalUserId);
  }

  private scheduleDebouncedAutoReply(
    sessionKey: string,
    openKfId: string,
    externalUserId: string,
  ): void {
    const debounceMs = Number(this.configService.get('KF_DEBOUNCE_MS', '3000'));

    // 重置已有 timer
    const existing = this.debounceTimers.get(sessionKey);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(sessionKey);
      this.flushAutoReply(sessionKey, openKfId, externalUserId).catch((err) =>
        this.logger.error(`防抖自动回复失败: sessionKey=${sessionKey}`, err),
      );
    }, debounceMs);

    this.debounceTimers.set(sessionKey, timer);
  }

  private async flushAutoReply(
    sessionKey: string,
    openKfId: string,
    externalUserId: string,
  ): Promise<void> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) {
      this.logger.warn('Redis 不可用，跳过防抖刷新');
      return;
    }

    try {
      const results = await redisClient
        .multi()
        .lrange(`kf:debounce:${sessionKey}`, 0, -1)
        .del(`kf:debounce:${sessionKey}`)
        .exec();

      const contents: string[] = results?.[0]?.[1] || [];
      if (contents.length === 0) return;

      this.logger.log(`防抖刷新: sessionKey=${sessionKey}, ${contents.length} 条消息已合并`);
      await this.executeAutoReply(openKfId, externalUserId);
    } catch (error: any) {
      this.logger.error(`flushAutoReply 失败: sessionKey=${sessionKey}`, error);
    }
  }

  private async executeAutoReply(openKfId: string, externalUserId: string): Promise<void> {
    const sessionKey = `${openKfId}:${externalUserId}`;
    try {
      // 1. 检查企微服务状态
      const stateRes = await this.kfApiService.getKfServiceState(openKfId, externalUserId);
      const serviceState = stateRes.service_state;

      if (serviceState === 3) {
        this.logger.log(`会话已人工接待，跳过自动回复: externalUserId=${externalUserId}`);
        return;
      }

      if (serviceState === 0) {
        // 转智能助手失败不阻断回复（send_msg 独立于会话状态）
        try {
          await this.kfApiService.transKfServiceState(openKfId, externalUserId, 1);
          this.logger.log(`会话已转为智能助手: externalUserId=${externalUserId}`);
        } catch (err: any) {
          this.logger.warn(`转智能助手失败（不阻断回复）: ${err.message}`);
        }
      }

      // 2. 加载会话上下文
      const session = await this.prisma.conversationSession.findUnique({
        where: { sessionKey },
      });
      if (!session) {
        this.logger.warn(`自动回复跳过: 未找到会话 sessionKey=${sessionKey}`);
        return;
      }

      const maxHistory = Number(this.configService.get('LLM_MAX_HISTORY_MESSAGES', '20'));
      const recentMessages = await this.prisma.conversationMessage.findMany({
        where: {
          sessionId: session.id,
          role: { in: ['user', 'assistant'] },
          type: 'TEXT',
        },
        orderBy: { sendTime: 'asc' },
        take: maxHistory,
        select: { role: true, content: true },
      });

      // 3. 调用 LLM
      let response: import('./sales-llm.service').SalesLlmResponse;
      try {
        response = await this.salesLlmService.generateReply({
          sessionState: session.state as string,
          intentLevel: session.intentLevel as string,
          turnCount: session.turnCount,
          messages: recentMessages as { role: 'user' | 'assistant'; content: string }[],
        });
      } catch (err: any) {
        this.logger.error(`LLM 调用失败，使用降级回复: ${err.message}`);
        response = this.salesLlmService.getFallbackResponse();
      }

      // 4. 校验状态转换
      const validatedState = this.salesLlmService.validateTransition(
        session.state as string,
        response.newState,
      );

      // 5. 发送回复
      if (response.escalateToHuman) {
        // 转人工状态变更失败不阻断回复发送
        try {
          await this.kfApiService.transKfServiceState(openKfId, externalUserId, 3);
        } catch (err: any) {
          this.logger.warn(`转人工状态变更失败（继续发消息）: ${err.message}`);
        }
        await this.kfApiService.sendText(openKfId, externalUserId, response.reply);
        this.logger.log(`已转人工: externalUserId=${externalUserId}`);
        // 呼叫人工 → 推联系人名片引导添加企微（单会话一次）
        await this.maybeSendContactCard(openKfId, externalUserId, session);
      } else {
        await this.kfApiService.sendText(openKfId, externalUserId, response.reply);
        this.logger.log(
          `AI 回复已发送: to=${externalUserId}, state=${validatedState}, confidence=${response.confidence}`,
        );
        // 超三轮 → 推联系人名片引导加企微（单会话一次）
        if (session.turnCount >= 3) {
          await this.maybeSendContactCard(openKfId, externalUserId, session);
        }
      }

      // 6. 逼单转化：AI 建单（PENDING）→ 发小程序卡片 → 顾客进小程序支付
      if (response.sendPaymentLink) {
        await this.sendOrderCard(
          openKfId,
          externalUserId,
          session.id,
          response.recommendedProductId,
        );
      }

      // 7. 持久化 AI 回复（写入所有 AI 字段）
      await this.prisma.conversationMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          type: response.sendPaymentLink ? 'LINK_CARD' : 'TEXT',
          origin: 'SERVICER',
          content: response.reply,
          openKfId,
          externalUserId,
          sendTime: new Date(),
          aiIntentLevel: response.intentLevel as any,
          aiConfidence: response.confidence,
          sendPaymentCard: response.sendPaymentLink,
          recommendedProductId: response.recommendedProductId || null,
          escalationReason: response.escalationReason || null,
        },
      });

      // 8. 更新会话状态
      await this.prisma.conversationSession.update({
        where: { id: session.id },
        data: {
          state: validatedState as any,
          intentLevel: response.intentLevel as any,
          turnCount: { increment: 1 },
          lastActiveAt: new Date(),
        },
      });

      // 9. 更新联系人状态
      if (response.escalateToHuman) {
        await this.prisma.contact.update({
          where: { id: session.contactId },
          data: { status: 'ESCALATED' },
        });
      } else if (validatedState === 'CONVERTED') {
        await this.prisma.contact.update({
          where: { id: session.contactId },
          data: { status: 'CONVERTED', convertedAt: new Date() },
        });
      }
    } catch (error: any) {
      this.logger.error(`自动回复执行失败: to=${externalUserId}`, error);
    }
  }

  /**
   * F2 引导加企微：推送员工的「联系我」二维码图片（单会话一次，幂等）
   * 触发：识别到呼叫人工（escalateToHuman）或对话超过三轮
   * 客户长按识别二维码 → 添加企微成员（state 归因到该成员）
   *
   * 注：微信客服 send_msg 不支持 business_card 类型（40008），
   * 故采用 PRD F2 方案 B——活码二维码图片消息
   */
  private async maybeSendContactCard(
    openKfId: string,
    externalUserId: string,
    session: { id: string; contactId: string; turnCount: number },
  ): Promise<void> {
    try {
      // 幂等：该会话已发过名片/二维码引导则跳过（宁少勿扰，PRD F2 单会话 ≤1 次）
      const sent = await this.prisma.conversationMessage.findFirst({
        where: {
          sessionId: session.id,
          origin: 'SERVICER',
          content: '已推送企微联系人二维码',
        },
        select: { id: true },
      });
      if (sent) return;

      // 名片指向的企微成员（ WX_WORK_CONTACT_CARD_USERID，默认 xinnix）
      const cardUserid =
        this.configService.get<string>('WX_WORK_CONTACT_CARD_USERID', '') || 'xinnix';

      // 1. 取员工的「联系我」二维码（LiveCode 复用：按成员查活跃活码，无则创建）
      const { qrUrl, state } = await this.resolveEmployeeContactWay(cardUserid);

      // 2. 下载二维码 → 企微临时素材
      const qrRes = await fetch(qrUrl);
      if (!qrRes.ok) throw new Error(`二维码下载失败: HTTP ${qrRes.status}`);
      const buffer = Buffer.from(await qrRes.arrayBuffer());
      const mediaId = await this.kfApiService.uploadKfTempImage(buffer, 'contact-qr.png');

      // 3. 发送图片消息（客户长按识别添加）
      await this.kfApiService.sendKfMessage({
        touser: externalUserId,
        open_kfid: openKfId,
        msgtype: 'image',
        image: { media_id: mediaId },
      });

      // 持久化引导动作（幂等标记 + 会话审计）
      await this.prisma.conversationMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          type: 'IMAGE',
          origin: 'SERVICER',
          content: '已推送企微联系人二维码',
          openKfId,
          externalUserId,
          sendTime: new Date(),
          internalNote: `引导添加企微成员: ${cardUserid} (state=${state})`,
        },
      });
      this.logger.log(
        `联系人二维码已发送: to=${externalUserId}, member=${cardUserid}, state=${state}`,
      );
    } catch (err: any) {
      this.logger.warn(`联系人二维码发送失败: ${err.message}`);
    }
  }

  /**
   * 解析员工的「联系我」二维码 URL（LiveCode 复用：无活跃活码则调企微创建单人活码）
   */
  private async resolveEmployeeContactWay(memberUserid: string): Promise<{
    qrUrl: string;
    state: string;
  }> {
    // 查活跃活码（接待成员含该 userid）
    const existing = await this.prisma.liveCode.findFirst({
      where: {
        status: 'ACTIVE',
        memberUserids: { array_contains: [memberUserid] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.qrUrl) {
      return { qrUrl: existing.qrUrl, state: existing.state };
    }

    // 无活跃活码 → 调企微创建单人活码
    // 注意：add_contact_way 只返回 config_id，二维码需再调 get_contact_way 查询
    const state = `kf_${memberUserid.slice(0, 20)}`;
    const corpId = this.configService.get<string>('WX_WORK_CORP_ID', '');
    const secret = this.configService.get<string>('WX_WORK_SECRET', '');
    const accessToken = await this.wecomApiService.getAccessToken(corpId, secret);
    const created = await this.wecomApiService.addContactWay(accessToken, {
      type: 1, // 单人
      scene: 2, // 二维码
      user: [memberUserid],
      state,
      remark: '客服名片引导（自动创建）',
    });
    const detail = await this.wecomApiService.getContactWay(accessToken, created.config_id);
    const qrUrl = detail?.contact_way?.[0]?.qr_code;
    if (!qrUrl) throw new Error(`未获取到二维码 URL: ${JSON.stringify(detail).slice(0, 120)}`);

    await this.prisma.liveCode.create({
      data: {
        name: `客服名片-${memberUserid}`,
        state,
        contactWayConfigId: created.config_id,
        qrUrl,
        memberUserids: [memberUserid],
        autoTags: [],
        status: 'ACTIVE',
      },
    });

    return { qrUrl, state };
  }

  // ─── 工具方法 ───────────────────────────────────────────────

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
   * 逼单转化：为推荐商品创建 PENDING 订单并发送小程序卡片。
   * 顾客点卡片进小程序订单确认页完成 JSAPI 支付；
   * 建单或发卡失败时降级发文本兜底话术。
   */
  private async sendOrderCard(
    openKfId: string,
    externalUserId: string,
    sessionId: string,
    recommendedProductId?: string,
  ): Promise<void> {
    try {
      if (!recommendedProductId) {
        await this.kfApiService.sendText(
          openKfId,
          externalUserId,
          '请回复您感兴趣的商品名称，我来为您下单～',
        );
        return;
      }

      // 1. 建单（PENDING，关联会话，归因 Contact）
      const contact = await this.prisma.contact.findUnique({ where: { openId: externalUserId } });
      if (!contact) throw new Error(`未找到访客档案: ${externalUserId}`);

      const order = await this.orderService.createOrder({
        contactId: contact.id,
        productId: recommendedProductId,
        sessionId,
      });

      // 2. 发小程序卡片（封面 media_id 缓存 2.5 天，media_id 本身 3 天有效）
      const appid = this.configService.get<string>('MINIAPP_APPID', '');
      if (!appid) throw new Error('缺少 MINIAPP_APPID 配置');

      const thumbMediaId = await this.resolveCardThumbMediaId();
      await this.kfApiService.sendMiniProgram(openKfId, externalUserId, {
        appid,
        title: `「${order.product.name}」点击完成购买`,
        thumbMediaId,
        pagePath: `pages/order/confirm/index?orderNo=${order.orderNo}`,
      });

      this.logger.log(
        `订单卡片已发送: orderNo=${order.orderNo}, productId=${recommendedProductId}, to=${externalUserId}`,
      );
    } catch (err: any) {
      this.logger.error(`订单卡片发送失败，降级发文本: ${err.message}`);
      try {
        await this.kfApiService.sendText(
          openKfId,
          externalUserId,
          '购买链接生成失败，请稍后重试或直接联系我们～',
        );
      } catch (sendErr: any) {
        this.logger.error(`降级文本发送也失败: ${sendErr.message}`);
      }
    }
  }

  /** 小程序卡片默认封面 media_id（media/upload 通用接口，内部自动降级自建应用 token） */
  private async resolveCardThumbMediaId(): Promise<string> {
    const cacheKey = 'kf:card:thumb_media_id';
    const CACHE_TTL_MS = 2.5 * 24 * 60 * 60 * 1000;

    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) return cached;
    } catch {
      // Redis 不可用则每次重新上传（成本可接受）
    }

    const coverPath = path.resolve(process.cwd(), 'assets/default-card-cover.png');
    const mediaId = await this.kfApiService.uploadCardCover(coverPath);

    try {
      await this.redisService.set(cacheKey, mediaId, CACHE_TTL_MS);
    } catch {
      // 忽略缓存写入失败
    }
    return mediaId;
  }

  async generateJssdkSignature(url: string): Promise<{
    appId: string;
    timestamp: number;
    nonceStr: string;
    signature: string;
  }> {
    const crypto = await import('crypto');
    const appId = this.configService.get<string>('WX_WORK_CORP_ID', '');

    const accessToken = await this.kfApiService.getAccessToken();

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
