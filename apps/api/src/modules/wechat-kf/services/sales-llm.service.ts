import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── 类型定义 ──────────────────────────────────────────────

export interface SalesLlmContext {
  sessionState: string;
  intentLevel: string;
  turnCount: number;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export interface SalesLlmResponse {
  reply: string;
  newState: string;
  intentLevel: string;
  sendPaymentLink: boolean;
  escalateToHuman: boolean;
  confidence: number;
  recommendedProductId?: string;
  escalationReason?: string;
}

// ─── 状态转换规则 ──────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  GREETING: new Set(['GREETING', 'NEEDS_DISCOVERY', 'ESCALATED']),
  NEEDS_DISCOVERY: new Set(['NEEDS_DISCOVERY', 'PRODUCT_MATCH', 'ESCALATED']),
  PRODUCT_MATCH: new Set(['PRODUCT_MATCH', 'OBJECTION_HANDLING', 'CLOSING', 'ESCALATED']),
  OBJECTION_HANDLING: new Set(['OBJECTION_HANDLING', 'PRODUCT_MATCH', 'CLOSING', 'ESCALATED']),
  CLOSING: new Set(['CLOSING', 'CONVERTED', 'OBJECTION_HANDLING', 'ESCALATED']),
  CONVERTED: new Set(['CONVERTED']),
  ESCALATED: new Set(['ESCALATED']),
  TIMED_OUT: new Set(['TIMED_OUT']),
};

const VALID_STATES = new Set(Object.keys(VALID_TRANSITIONS));
const VALID_INTENT_LEVELS = new Set(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CLOSING']);

// ─── Demo 产品（MVP） ─────────────────────────────────────

const DEMO_PRODUCTS = `
- SKU001: "智能净水器 Pro" - 六级过滤，直饮级净水，适用于家庭厨房。价格：1299元。特点：RO反渗透、智能TDS检测、滤芯寿命提醒。
- SKU002: "便携式空气净化器" - 桌面级净化，静音运行，适用于办公室/卧室。价格：599元。特点：HEPA滤网、负离子模式、USB供电。
- SKU003: "智能体脂秤" - 14项身体指标监测，家庭共享，适用于健康管理。价格：299元。特点：高精度传感器、APP数据同步、支持16人档案。
`;

// ─── Service ──────────────────────────────────────────────

@Injectable()
export class SalesLlmService {
  private readonly logger = new Logger(SalesLlmService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateReply(ctx: SalesLlmContext): Promise<SalesLlmResponse> {
    const apiUrl = this.configService.get<string>('LLM_API_URL');
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    const model = this.configService.get<string>('LLM_MODEL', 'deepseek-chat');
    const maxHistory = Number(this.configService.get('LLM_MAX_HISTORY_MESSAGES', '20'));

    if (!apiUrl || !apiKey) {
      throw new Error('LLM_API_URL 或 LLM_API_KEY 未配置');
    }

    const systemPrompt = this.buildSystemPrompt(ctx);
    const messages = this.buildChatMessages(systemPrompt, ctx.messages, maxHistory);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('LLM 返回空内容');
      }

      return this.parseResponse(content);
    } finally {
      clearTimeout(timeout);
    }
  }

  buildSystemPrompt(ctx: SalesLlmContext): string {
    const override = this.configService.get<string>('LLM_SYSTEM_PROMPT_OVERRIDE');
    if (override) return override;

    return `你是一个专业的 AI 销售助手，通过企业微信为客户提供产品咨询和购买引导。

## 可推荐的产品
${DEMO_PRODUCTS}

## 当前会话状态
- 状态: ${ctx.sessionState}
- 客户意向: ${ctx.intentLevel}
- 对话轮次: ${ctx.turnCount}

## 销售流程状态机
你必须根据对话进展推进状态：
- GREETING: 欢迎客户。客户首次表达需求后推进到 NEEDS_DISCOVERY。
- NEEDS_DISCOVERY: 通过开放性问题了解客户需求（预算、使用场景、偏好）。了解足够后推进到 PRODUCT_MATCH。
- PRODUCT_MATCH: 推荐 1-2 个匹配产品，说明优势。客户有异议推进到 OBJECTION_HANDLING，客户有意购买推进到 CLOSING。
- OBJECTION_HANDLING: 倾听并回应客户顾虑（价格、品质、替代品）。异议解决后推进到 CLOSING。
- CLOSING: 营造紧迫感或提供优惠，设置 sendPaymentLink=true 发送支付链接。客户确认购买后推进到 CONVERTED。
- CONVERTED: 感谢客户购买，确认订单信息。
- 当客户明确要求人工服务，或你连续 3 次无法有效回应时，设置 escalateToHuman=true。

## 对话准则
- 回复简洁（2-4句话），适合微信聊天
- 友好专业，不强行推销
- 只推荐列表中的产品，不编造产品或价格
- 对话超出你的知识范围时，转人工

## 输出格式
你必须返回一个 JSON 对象，不要输出任何其他内容：
{
  "reply": "你的回复内容",
  "newState": "状态名称",
  "intentLevel": "意向等级",
  "sendPaymentLink": false,
  "escalateToHuman": false,
  "confidence": 0.85,
  "recommendedProductId": null,
  "escalationReason": null
}

字段说明：
- reply: 发送给客户的文本（必填）
- newState: 建议的下一状态，可选值: GREETING, NEEDS_DISCOVERY, PRODUCT_MATCH, OBJECTION_HANDLING, CLOSING, CONVERTED, ESCALATED
- intentLevel: 客户意向等级，可选值: UNKNOWN, LOW, MEDIUM, HIGH, CLOSING
- sendPaymentLink: 是否发送支付链接（仅 CLOSING 阶段可为 true）
- escalateToHuman: 是否转人工服务
- confidence: 你的判断置信度（0-1）
- recommendedProductId: 推荐的产品 ID（如 SKU001），无推荐则为 null
- escalationReason: 转人工原因，无则为 null`;
  }

  buildChatMessages(
    systemPrompt: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    maxHistory: number,
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    const windowed = history.slice(-maxHistory);
    for (const msg of windowed) {
      messages.push({ role: msg.role, content: msg.content });
    }

    return messages;
  }

  parseResponse(raw: string): SalesLlmResponse {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`LLM 响应 JSON 解析失败: ${raw.slice(0, 200)}`);
    }

    if (!parsed.reply || typeof parsed.reply !== 'string') {
      throw new Error(`LLM 响应缺少 reply 字段: ${raw.slice(0, 200)}`);
    }

    const newState = VALID_STATES.has(parsed.newState) ? parsed.newState : 'GREETING';
    const intentLevel = VALID_INTENT_LEVELS.has(parsed.intentLevel)
      ? parsed.intentLevel
      : 'UNKNOWN';
    const confidence =
      typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    const sendPaymentLink = parsed.sendPaymentLink === true;
    const escalateToHuman = parsed.escalateToHuman === true;

    return {
      reply: parsed.reply,
      newState,
      intentLevel,
      sendPaymentLink,
      escalateToHuman,
      confidence,
      recommendedProductId: parsed.recommendedProductId || undefined,
      escalationReason: parsed.escalationReason || undefined,
    };
  }

  validateTransition(current: string, suggested: string): string {
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed) return current;
    return allowed.has(suggested) ? suggested : current;
  }

  getFallbackResponse(): SalesLlmResponse {
    return {
      reply: this.configService.get<string>(
        'WX_WORK_KF_AUTO_REPLY',
        '您好，感谢您的咨询！我们正在为您安排专属顾问，请稍候～',
      ),
      newState: 'GREETING',
      intentLevel: 'UNKNOWN',
      sendPaymentLink: false,
      escalateToHuman: false,
      confidence: 0,
    };
  }
}
