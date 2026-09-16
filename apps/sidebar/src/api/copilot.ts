import { apiPost } from './http';

export interface CopilotEvent {
  type: 'intent' | 'strategy' | 'error' | 'done';
  category?: string;
  psychology?: { anxiety: number; priceSensitivity: number; trust: number };
  strategy?: string;
  delta?: string;
  message?: string;
  generationId?: string;
}

export const STRATEGY_LABELS: Record<string, string> = {
  A_RATIONAL: 'A · 理性科普',
  B_EMOTIONAL: 'B · 感性逼单',
  C_UPSELL: 'C · 搭售升级',
};

export const STRATEGY_ORDER = ['A_RATIONAL', 'B_EMOTIONAL', 'C_UPSELL'] as const;

export const INTENT_LABELS: Record<string, string> = {
  USAGE_CONSULTATION: '使用咨询',
  OBJECTION_PRICE: '价格异议',
  SAFETY_CONCERN: '安全顾虑',
  COMPLAINT: '投诉',
  GENERAL: '一般',
};

/**
 * SSE 消费：POST /api/sidebar/analyze，逐事件回调
 * 事件序列：intent → strategy(A/B/C delta) → done
 * pastedConversation：销售粘贴的实时对话（可选，作为最高优先级上下文）
 */
export async function analyzeStream(
  token: string,
  externalUserId: string,
  onEvent: (e: CopilotEvent) => void,
  signal?: AbortSignal,
  pastedConversation?: string,
): Promise<void> {
  const res = await fetch('/api/sidebar/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      externalUserId,
      pastedConversation: pastedConversation?.trim() || undefined,
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`分析失败：HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload));
      } catch {
        /* 跳过非法分片 */
      }
    }
  }
}

export interface SendRecordInput {
  externalUserId: string;
  generationId?: string;
  strategy?: string;
  msgType: 'text' | 'miniprogram';
  adopted?: boolean;
  contentSnapshot?: string;
}

/** 发送事件上报（采纳率 + 合规审计） */
export function reportSend(token: string, payload: SendRecordInput) {
  return apiPost<{ id: string; sentAt: string }>('/sidebar/send/record', token, payload);
}
