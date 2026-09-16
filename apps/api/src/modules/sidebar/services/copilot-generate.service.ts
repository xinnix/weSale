import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CopilotContext, CopilotLlmService } from './copilot-llm.service';
import { SidebarProfileService } from './sidebar-profile.service';

export type CopilotEvent =
  | {
      type: 'intent';
      category: string;
      psychology: { anxiety: number; priceSensitivity: number; trust: number };
    }
  | { type: 'strategy'; strategy: string; delta: string }
  | { type: 'error'; strategy?: string; message: string }
  | { type: 'done'; generationId: string };

const STRATEGIES = ['A_RATIONAL', 'B_EMOTIONAL', 'C_UPSELL'];

const INTENT_LABELS: Record<string, string> = {
  USAGE_CONSULTATION: '使用咨询',
  OBJECTION_PRICE: '价格异议',
  SAFETY_CONCERN: '安全顾虑',
  COMPLAINT: '投诉',
};

@Injectable()
export class CopilotGenerateService {
  private readonly logger = new Logger(CopilotGenerateService.name);

  constructor(
    private readonly llm: CopilotLlmService,
    private readonly profileService: SidebarProfileService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 编排：组装上下文 → 意图分类 → 3 策略并行流式 → 事件流
   * SSE 事件多路复用（type + strategy 标签），controller 逐事件 write
   */
  async *generateStream(
    externalUserId: string,
    member: { userId: string; corpId: string },
    signal?: AbortSignal,
    pastedConversation?: string,
  ): AsyncGenerator<CopilotEvent> {
    const { ctx, generationId, pastedId, contactId } = await this.prepare(
      externalUserId,
      member,
      pastedConversation,
    );

    // 1. 意图分类（先返回，前端先渲染标签）
    const analysis = await this.llm.classifyIntent(ctx);
    yield { type: 'intent', category: analysis.category, psychology: analysis.psychology };

    // 1.5 粘贴对话资产化：回填意图 + 意图自动写入客户标签（身份标签闭环）
    if (pastedId && contactId) {
      await this.finalizePasted(pastedId, contactId, analysis.category);
    }

    // 2. 3 策略并行流：用队列把并行 producer 汇聚到单一 generator
    const queue: CopilotEvent[] = [];
    let waiter: (() => void) | null = null;
    let active = STRATEGIES.length;
    const emit = (e: CopilotEvent) => {
      queue.push(e);
      waiter?.();
      waiter = null;
    };

    for (const strategy of STRATEGIES) {
      void (async () => {
        try {
          for await (const delta of this.llm.streamStrategy(strategy, ctx, signal)) {
            emit({ type: 'strategy', strategy, delta });
          }
        } catch (err: any) {
          this.logger.warn(`策略 ${strategy} 生成失败: ${err.message}`);
          emit({ type: 'error', strategy, message: err?.message || '生成失败' });
        } finally {
          active -= 1;
          emit({ type: '__finished' } as unknown as CopilotEvent);
        }
      })();
    }

    while (active > 0 || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          waiter = resolve;
        });
        continue;
      }
      const event = queue.shift()!;
      if ((event as any).type === '__finished') continue;
      yield event;
    }

    yield { type: 'done', generationId };
  }

  /**
   * 组装生成上下文 + 生成 id（复用画像聚合的数据源）
   * 粘贴对话在此落库（资产化）：进"最近会话" + 供后期统一分析
   */
  private async prepare(
    externalUserId: string,
    member: { userId: string; corpId: string },
    pastedConversation?: string,
  ): Promise<{
    ctx: CopilotContext;
    generationId: string;
    pastedId?: string;
    contactId?: string;
  }> {
    const profile = await this.profileService.getProfile(externalUserId, member);

    const ctx: CopilotContext = {
      contactNickname: profile.contact.nickname,
      intentLevel: profile.contact.intentLevel,
      tags: (profile.tags ?? []).map((t: any) => t.name),
      ordersSummary: this.buildOrdersSummary(profile.stats),
      recentMessages: (profile.recentMessages ?? []).map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      pastedConversation: pastedConversation?.trim() || undefined,
    };

    const generationId = `gen_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    let pastedId: string | undefined;
    if (ctx.pastedConversation) {
      try {
        const row = await this.prisma.pastedConversation.create({
          data: {
            memberUserId: member.userId,
            corpId: member.corpId,
            externalUserId,
            contactId: profile.contact.id,
            content: ctx.pastedConversation.slice(0, 5000),
            generationId,
          },
        });
        pastedId = row.id;
      } catch (err: any) {
        this.logger.warn(`粘贴对话落库失败: ${err.message}`);
      }
    }

    return { ctx, generationId, pastedId, contactId: profile.contact.id };
  }

  /** 意图分类结果回填粘贴记录 + 意图标签自动写入 Contact.tags（去重，GENERAL 不打标） */
  private async finalizePasted(
    pastedId: string,
    contactId: string,
    category: string,
  ): Promise<void> {
    try {
      await this.prisma.pastedConversation.update({
        where: { id: pastedId },
        data: { intentCategory: category },
      });

      const label = INTENT_LABELS[category];
      if (!label) return;

      const contact = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { tags: true },
      });
      const tags = Array.isArray(contact?.tags) ? (contact!.tags as any[]) : [];
      if (tags.some((t) => t.source === 'BEHAVIOR' && t.name === label)) return;

      await this.prisma.contact.update({
        where: { id: contactId },
        data: {
          tags: [...tags, { name: label, source: 'BEHAVIOR', at: new Date().toISOString() }] as any,
        },
      });
    } catch (err: any) {
      this.logger.warn(`粘贴对话意图回填/打标失败: ${err.message}`);
    }
  }

  /**
   * 根据对话生成用户语义标签并写入 Contact.tags（去重）
   * 独立于话术生成的按钮入口：粘贴对话 → 萃取标签 → 客户画像完善
   */
  async generateTags(
    externalUserId: string,
    member: { userId: string; corpId: string },
    pastedConversation?: string,
  ): Promise<{ tags: string[] }> {
    const { ctx, contactId } = await this.prepare(externalUserId, member, pastedConversation);

    const tags = await this.llm.generateUserTags(ctx);
    if (contactId && tags.length) {
      const contact = await this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { tags: true },
      });
      const existing = Array.isArray(contact?.tags) ? (contact!.tags as any[]) : [];
      const now = new Date().toISOString();
      const merged = [...existing];
      for (const name of tags) {
        if (!merged.some((x) => x.source === 'BEHAVIOR' && x.name === name)) {
          merged.push({ name, source: 'BEHAVIOR', at: now } as any);
        }
      }
      await this.prisma.contact.update({
        where: { id: contactId },
        data: { tags: merged as any },
      });
      this.logger.log(`[user-tags] ${externalUserId} 写入标签: ${tags.join('、')}`);
    }
    return { tags };
  }

  private buildOrdersSummary(stats: any): string {
    if (!stats || stats.paidOrders === 0) return '暂无成交记录';
    const yuan = (stats.totalPaidAmountFen / 100).toFixed(0);
    return `已支付 ${stats.paidOrders} 单，累计约 ¥${yuan}`;
  }
}
