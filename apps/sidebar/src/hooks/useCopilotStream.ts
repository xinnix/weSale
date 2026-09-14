import { useCallback, useState } from 'react';
import { analyzeStream, CopilotEvent, STRATEGY_ORDER } from '../api/copilot';

export interface StrategyText {
  A_RATIONAL: string;
  B_EMOTIONAL: string;
  C_UPSELL: string;
}

const EMPTY: StrategyText = { A_RATIONAL: '', B_EMOTIONAL: '', C_UPSELL: '' };

export interface CopilotState {
  intent: { category: string; psychology: CopilotEvent['psychology'] } | null;
  strategies: StrategyText;
  generationId: string | null;
  running: boolean;
  error: string | null;
  start: (externalUserId: string) => Promise<void>;
  reset: () => void;
}

/** 侧边栏 AI 生成流式状态：意图 + 3 策略增量 */
export function useCopilotStream(token: string): CopilotState {
  const [intent, setIntent] = useState<CopilotState['intent']>(null);
  const [strategies, setStrategies] = useState<StrategyText>(EMPTY);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIntent(null);
    setStrategies(EMPTY);
    setGenerationId(null);
    setError(null);
  }, []);

  const start = useCallback(
    async (externalUserId: string) => {
      setRunning(true);
      setError(null);
      setIntent(null);
      setStrategies(EMPTY);
      setGenerationId(null);
      try {
        await analyzeStream(token, externalUserId, (e) => {
          if (e.type === 'intent') {
            setIntent({ category: e.category || 'GENERAL', psychology: e.psychology });
          } else if (e.type === 'strategy' && e.strategy && e.delta) {
            const key = e.strategy as keyof StrategyText;
            if (STRATEGY_ORDER.includes(key as any)) {
              setStrategies((prev) => ({ ...prev, [key]: prev[key] + e.delta }));
            }
          } else if (e.type === 'done') {
            setGenerationId(e.generationId || null);
          } else if (e.type === 'error' && !e.strategy) {
            setError(e.message || '生成失败');
          }
        });
      } catch (err: any) {
        setError(err.message || '生成失败');
      } finally {
        setRunning(false);
      }
    },
    [token],
  );

  return { intent, strategies, generationId, running, error, start, reset };
}
