import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductService } from '../../product/services/product.service';

// ─── 类型 ──────────────────────────────────────────────────

export interface CopilotContext {
  contactNickname?: string | null;
  intentLevel: string;
  tags: string[];
  ordersSummary?: string;
  recentMessages: { role: string; content: string }[];
  /** 销售实时粘贴的对话片段（最高优先级上下文，替代拿不到的私聊记录） */
  pastedConversation?: string;
}

export interface IntentAnalysis {
  category: string; // IntentCategory 枚举值
  psychology: { anxiety: number; priceSensitivity: number; trust: number };
}

const INTENT_CATEGORIES = new Set([
  'USAGE_CONSULTATION',
  'OBJECTION_PRICE',
  'SAFETY_CONCERN',
  'COMPLAINT',
  'GENERAL',
]);

const STRATEGY_PERSONA: Record<string, string> = {
  A_RATIONAL:
    '策略 A（理性/科普）：以专业、可信的口吻讲清产品成分、原理、适用人群与功效依据，用事实消除疑虑，不夸张不煽情。',
  B_EMOTIONAL:
    '策略 B（感性/逼单）：以温暖、有感染力的口吻唤起情感共鸣，结合限时优惠与稀缺性营造适度紧迫感，推动临门一脚，但不过度施压。',
  C_UPSELL:
    '策略 C（搭售/升级）：在满足当前需求的基础上，自然引入搭配使用效果更好的关联产品，或引导升级到更合适的方案/套餐。',
};

const FALLBACK_PRODUCTS = '（暂无在售商品目录）';

@Injectable()
export class CopilotLlmService {
  private readonly logger = new Logger(CopilotLlmService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly productService: ProductService,
  ) {}

  private getLlmConfig() {
    return {
      apiUrl: this.configService.get<string>('LLM_API_URL'),
      apiKey: this.configService.get<string>('LLM_API_KEY'),
      model: this.configService.get<string>('LLM_MODEL', 'deepseek-chat'),
    };
  }

  /** 是否已配置 LLM（未配置时上层走降级话术） */
  isConfigured(): boolean {
    const { apiUrl, apiKey } = this.getLlmConfig();
    return Boolean(apiUrl && apiKey);
  }

  /**
   * 意图分类 + 心理状态（非流式小调用，JSON 输出）
   * 与 3 策略流式生成解耦：先返回，前端先渲染意图标签
   */
  async classifyIntent(ctx: CopilotContext): Promise<IntentAnalysis> {
    const fallback: IntentAnalysis = {
      category: 'GENERAL',
      psychology: { anxiety: 0.5, priceSensitivity: 0.5, trust: 0.5 },
    };
    const { apiUrl, apiKey, model } = this.getLlmConfig();
    if (!apiUrl || !apiKey) return fallback;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: this.buildIntentPrompt() },
            { role: 'user', content: this.describeContext(ctx) },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 200,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`LLM ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('空响应');
      return this.parseIntent(content);
    } catch (err: any) {
      this.logger.warn(`意图分类失败，走默认: ${err.message}`);
      return fallback;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 单策略流式生成（纯文本，逐 delta yield）
   * 不用 response_format:json_object——与流式组合会拖垮 TTFT
   */
  async *streamStrategy(
    strategy: string,
    ctx: CopilotContext,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const { apiUrl, apiKey, model } = this.getLlmConfig();
    if (!apiUrl || !apiKey) throw new Error('LLM 未配置');

    const productsText = await this.loadProductsText();
    const res = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: this.buildStrategyPrompt(strategy, productsText) },
          { role: 'user', content: this.describeContext(ctx) },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 400,
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM ${res.status} ${text.slice(0, 120)}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') return;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            /* 跳过非法分片 */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ─── prompt 构造 ───────────────────────────────────────

  private async loadProductsText(): Promise<string> {
    try {
      const products = await this.productService.findActive();
      return this.productService.formatForPrompt(products);
    } catch {
      return FALLBACK_PRODUCTS;
    }
  }

  private describeContext(ctx: CopilotContext): string {
    const parts: string[] = [];
    parts.push(`客户昵称：${ctx.contactNickname || '未知'}`);
    parts.push(`意向强度：${ctx.intentLevel}`);
    if (ctx.tags?.length) parts.push(`已有标签：${ctx.tags.join('、')}`);
    if (ctx.ordersSummary) parts.push(`消费画像：${ctx.ordersSummary}`);

    if (ctx.pastedConversation) {
      // 实时粘贴的对话是最高优先级上下文（私聊记录企微不开放，由销售手动粘贴）
      parts.push(
        `当前实时对话（销售刚从聊天窗口粘贴）：\n${ctx.pastedConversation.slice(0, 2000)}`,
      );
    } else if (ctx.recentMessages?.length) {
      const convo = ctx.recentMessages
        .slice(-6)
        .map((m) => `${m.role === 'assistant' ? '客服' : '客户'}：${m.content}`)
        .join('\n');
      parts.push(`最近会话：\n${convo}`);
    } else {
      parts.push('最近会话：（无会话记录，请仅依据画像生成）');
    }
    return parts.join('\n');
  }

  private buildIntentPrompt(): string {
    return `你是销售对话分析助手。根据给定的客户画像与会话，判断客户当前的意图分类与心理状态。

## 意图分类（category，单选）
- USAGE_CONSULTATION: 询问产品用法、成分、适用人群
- OBJECTION_PRICE: 对价格犹豫、嫌贵、要优惠
- SAFETY_CONCERN: 担心安全、副作用、质量、售后
- COMPLAINT: 投诉、抱怨、要求退换
- GENERAL: 一般寒暄或无法判断

## 心理状态（psychology，0-1 浮点）
- anxiety: 焦虑度
- priceSensitivity: 价格敏感度
- trust: 信任度

只返回 JSON，不要其他内容：
{"category":"GENERAL","psychology":{"anxiety":0.5,"priceSensitivity":0.5,"trust":0.5}}`;
  }

  private buildStrategyPrompt(strategy: string, productsText: string): string {
    const persona = STRATEGY_PERSONA[strategy] || STRATEGY_PERSONA.A_RATIONAL;
    return `你是企业微信里的销售助手，正在为销售生成一条发给客户的辅助话术。

## 你的策略
${persona}

## 可推荐的产品
${productsText}

## 要求
- 只输出发给客户的话术正文（纯文本，不要 JSON、不要解释、不要引号包裹）
- 2-4 句话，适合微信聊天，友好专业
- 只推荐上方目录中的产品，不编造产品或价格
- 直接输出话术，不要任何前缀`;
  }

  private parseIntent(raw: string): IntentAnalysis {
    const parsed = JSON.parse(raw);
    const category = INTENT_CATEGORIES.has(parsed.category) ? parsed.category : 'GENERAL';
    const clamp = (v: unknown) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5);
    return {
      category,
      psychology: {
        anxiety: clamp(parsed.psychology?.anxiety),
        priceSensitivity: clamp(parsed.psychology?.priceSensitivity),
        trust: clamp(parsed.psychology?.trust),
      },
    };
  }
}
