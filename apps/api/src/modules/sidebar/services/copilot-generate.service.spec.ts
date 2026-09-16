import { describe, expect, it } from 'vitest';
import { CopilotEvent, CopilotGenerateService } from './copilot-generate.service';

const llm = {
  classifyIntent: async () => ({
    category: 'OBJECTION_PRICE',
    psychology: { anxiety: 0.6, priceSensitivity: 0.8, trust: 0.4 },
  }),
  // 两个 delta 的流式策略
  streamStrategy: async function* (_strategy: string) {
    yield '话术一';
    yield '话术二';
  },
} as any;

const profile = {
  getProfile: async () => ({
    contact: { nickname: '王女士', intentLevel: 'HIGH' },
    tags: [{ name: '复购常客', source: 'BEHAVIOR', at: '2026-09-14' }],
    stats: { paidOrders: 2, totalPaidAmountFen: 13600 },
    recentMessages: [{ role: 'user', content: '怎么买' }],
  }),
} as any;

describe('CopilotGenerateService', () => {
  it('事件序列：intent → 3 策略 delta → done', async () => {
    const service = new CopilotGenerateService(llm, profile, {} as any);
    const events: CopilotEvent[] = [];
    for await (const e of service.generateStream('wm_x', { userId: 'u', corpId: 'c' })) {
      events.push(e);
    }

    expect(events[0].type).toBe('intent');
    expect((events[0] as any).category).toBe('OBJECTION_PRICE');

    const strategyEvents = events.filter((e) => e.type === 'strategy');
    expect(strategyEvents.length).toBe(6); // 3 策略 × 2 delta
    const strategies = new Set(strategyEvents.map((e) => (e as any).strategy));
    expect(strategies).toEqual(new Set(['A_RATIONAL', 'B_EMOTIONAL', 'C_UPSELL']));

    const last = events[events.length - 1];
    expect(last.type).toBe('done');
    expect((last as any).generationId).toMatch(/^gen_/);
  });

  it('单策略失败不影响其余（写 error 事件后仍 done）', async () => {
    const partialLlm = {
      classifyIntent: async () => ({
        category: 'GENERAL',
        psychology: { anxiety: 0.5, priceSensitivity: 0.5, trust: 0.5 },
      }),
      streamStrategy: async function* (strategy: string) {
        if (strategy === 'B_EMOTIONAL') throw new Error('上游超时');
        yield 'ok';
      },
    } as any;

    const service = new CopilotGenerateService(partialLlm, profile, {} as any);
    const events: CopilotEvent[] = [];
    for await (const e of service.generateStream('wm_x', { userId: 'u', corpId: 'c' })) {
      events.push(e);
    }

    const errors = events.filter((e) => e.type === 'error');
    expect(errors.length).toBe(1);
    expect((errors[0] as any).strategy).toBe('B_EMOTIONAL');
    expect(events[events.length - 1].type).toBe('done');
  });
});
