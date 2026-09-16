import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
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

@Injectable()
export class CopilotGenerateService {
  private readonly logger = new Logger(CopilotGenerateService.name);

  constructor(
    private readonly llm: CopilotLlmService,
    private readonly profileService: SidebarProfileService,
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
    const { ctx, generationId } = await this.prepare(externalUserId, member, pastedConversation);

    // 1. 意图分类（先返回，前端先渲染标签）
    const analysis = await this.llm.classifyIntent(ctx);
    yield { type: 'intent', category: analysis.category, psychology: analysis.psychology };

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

  /** 组装生成上下文 + 生成 id（复用画像聚合的数据源） */
  private async prepare(
    externalUserId: string,
    member: { userId: string; corpId: string },
    pastedConversation?: string,
  ): Promise<{ ctx: CopilotContext; generationId: string }> {
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

    return { ctx, generationId: `gen_${randomUUID().replace(/-/g, '').slice(0, 16)}` };
  }

  private buildOrdersSummary(stats: any): string {
    if (!stats || stats.paidOrders === 0) return '暂无成交记录';
    const yuan = (stats.totalPaidAmountFen / 100).toFixed(0);
    return `已支付 ${stats.paidOrders} 单，累计约 ¥${yuan}`;
  }
}
