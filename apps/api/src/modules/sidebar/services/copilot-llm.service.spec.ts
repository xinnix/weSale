import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopilotContext, CopilotLlmService } from './copilot-llm.service';

function sseStream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

const config = {
  get: (key: string, def?: string) =>
    ({ LLM_API_URL: 'http://llm', LLM_API_KEY: 'key', LLM_MODEL: 'm' })[key] ?? def,
} as any;

const productService = {
  findActive: async () => [],
  formatForPrompt: () => '（无）',
} as any;

const ctx: CopilotContext = {
  contactNickname: '王女士',
  intentLevel: 'HIGH',
  tags: ['复购常客'],
  recentMessages: [{ role: 'user', content: '怎么买' }],
};

describe('CopilotLlmService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('streamStrategy 解析 SSE delta 并拼接', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      body: sseStream([
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"，世界"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    })) as any;

    const service = new CopilotLlmService(config, productService);
    const out: string[] = [];
    for await (const delta of service.streamStrategy('A_RATIONAL', ctx)) out.push(delta);
    expect(out.join('')).toBe('你好，世界');
  });

  it('streamStrategy 遇非 2xx 抛错', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    })) as any;
    const service = new CopilotLlmService(config, productService);
    await expect(async () => {
      for await (const _ of service.streamStrategy('A_RATIONAL', ctx)) void _;
    }).rejects.toThrow(/401/);
  });

  it('classifyIntent 解析 JSON 且校准越界值', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"category":"OBJECTION_PRICE","psychology":{"anxiety":1.5,"priceSensitivity":0.8,"trust":-0.2}}',
            },
          },
        ],
      }),
    })) as any;

    const service = new CopilotLlmService(config, productService);
    const result = await service.classifyIntent(ctx);
    expect(result.category).toBe('OBJECTION_PRICE');
    expect(result.psychology.anxiety).toBe(1); // clamp 上界
    expect(result.psychology.trust).toBe(0); // clamp 下界
    expect(result.psychology.priceSensitivity).toBe(0.8);
  });

  it('classifyIntent 非法 category 回退 GENERAL', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"category":"NONSENSE","psychology":{}}' } }],
      }),
    })) as any;
    const service = new CopilotLlmService(config, productService);
    const result = await service.classifyIntent(ctx);
    expect(result.category).toBe('GENERAL');
  });

  it('未配置 LLM 时 classifyIntent 返回默认、streamStrategy 抛错', async () => {
    const noCfg = { get: (_k: string, def?: string) => def } as any;
    const service = new CopilotLlmService(noCfg, productService);
    expect(service.isConfigured()).toBe(false);
    const result = await service.classifyIntent(ctx);
    expect(result.category).toBe('GENERAL');
    await expect(async () => {
      for await (const _ of service.streamStrategy('A_RATIONAL', ctx)) void _;
    }).rejects.toThrow(/未配置/);
  });
});
