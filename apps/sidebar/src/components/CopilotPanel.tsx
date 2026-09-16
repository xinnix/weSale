import { useEffect, useState } from 'react';
import { INTENT_LABELS, reportSend, STRATEGY_LABELS, STRATEGY_ORDER } from '../api/copilot';
import { fetchProductCard, fetchProducts, ProductBrief } from '../api/products';
import { useCopilotStream } from '../hooks/useCopilotStream';
import type { WxAgent } from '../hooks/useWxAgent';

interface Props {
  token: string;
  wx: WxAgent;
  externalUserId: string;
}

function fmt(v?: number): string {
  return typeof v === 'number' ? v.toFixed(1) : '—';
}

/**
 * AI Copilot 面板：意图识别 + 3 策略流式话术 + 一键发送/复制
 * 发送走 ww.sendChatMessage，销售在企微客户端逐条确认（P1 红线）
 */
export default function CopilotPanel({ token, wx, externalUserId }: Props) {
  const { intent, strategies, generationId, running, error, start } = useCopilotStream(token);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [products, setProducts] = useState<ProductBrief[]>([]);

  // 在售商品列表（产品卡片选择用）
  useEffect(() => {
    fetchProducts(token)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [token]);

  const hasContent = STRATEGY_ORDER.some((s) => strategies[s]);
  const psychology = intent?.psychology;

  /** 发送产品小程序卡片（thumb_media_id 由后端组装） */
  const sendCard = async (p: ProductBrief) => {
    setBusy(`card-${p.id}`);
    setStatus(null);
    try {
      const card = await fetchProductCard(token, p.id);
      await wx.sendChatMessage({
        msgtype: 'miniprogram',
        miniprogram: {
          appid: card.appid,
          title: card.title,
          img_url: card.imgUrl,
          page: card.page,
        },
      });
      setStatus(`已调起发送（${p.name} 卡片），请在企微客户端内确认`);
      void reportSend(token, {
        externalUserId,
        generationId: generationId ?? undefined,
        msgType: 'miniprogram',
        adopted: true,
        contentSnapshot: p.name,
      }).catch(() => {});
    } catch (e: any) {
      setStatus(`卡片发送失败：${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const send = async (strategy: string, content: string) => {
    if (!content) return;
    setBusy(strategy);
    setStatus(null);
    try {
      await wx.sendChatMessage({ msgtype: 'text', text: { content } });
      setStatus(`已调起发送（${STRATEGY_LABELS[strategy]}），请在企微客户端内确认`);
      void reportSend(token, {
        externalUserId,
        generationId: generationId ?? undefined,
        strategy,
        msgType: 'text',
        adopted: true,
        contentSnapshot: content,
      }).catch(() => {});
    } catch (e: any) {
      setStatus(`发送失败：${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const copy = async (strategy: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setStatus(`已复制（${STRATEGY_LABELS[strategy]}）`);
      void reportSend(token, {
        externalUserId,
        generationId: generationId ?? undefined,
        strategy,
        msgType: 'text',
        adopted: false,
        contentSnapshot: content,
      }).catch(() => {});
    } catch {
      setStatus('复制失败，请手动选择文本');
    }
  };

  return (
    <section className="section copilot">
      <div className="copilot-head">
        <h3>AI 辅助话术</h3>
        <button
          className="primary"
          disabled={running}
          onClick={() => start(externalUserId, pasted.trim() || undefined)}
        >
          {running ? '生成中…' : hasContent ? '重新生成' : '分析并生成'}
        </button>
      </div>

      <textarea
        className="paste-box"
        rows={3}
        placeholder="可选：粘贴当前与客户的对话，AI 将据此判断意图并生成更贴的回复"
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
      />

      {intent && (
        <div className="intent-bar">
          <span className="intent-tag">
            意图：{INTENT_LABELS[intent.category] ?? intent.category}
          </span>
          {psychology && (
            <span className="psych">
              焦虑 {fmt(psychology.anxiety)} · 价格敏感 {fmt(psychology.priceSensitivity)} · 信任{' '}
              {fmt(psychology.trust)}
            </span>
          )}
        </div>
      )}

      {error && <div className="error-text">{error}</div>}

      {STRATEGY_ORDER.map((s) => (
        <div key={s} className="strategy-card">
          <div className="strategy-title">
            <span>{STRATEGY_LABELS[s]}</span>
            <div className="strategy-actions">
              <button
                className="mini primary"
                disabled={!strategies[s] || busy === s}
                onClick={() => send(s, strategies[s])}
              >
                发送
              </button>
              <button
                className="mini"
                disabled={!strategies[s]}
                onClick={() => copy(s, strategies[s])}
              >
                复制
              </button>
            </div>
          </div>
          <div className="strategy-body">
            {strategies[s] || <span className="ghost">{running ? '生成中…' : '待生成'}</span>}
          </div>
        </div>
      ))}

      {products.length > 0 && (
        <div className="products">
          <div className="products-title">产品卡片</div>
          {products.map((p) => (
            <div key={p.id} className="product-row">
              <span className="product-name">
                {p.name} · ¥{(p.priceFen / 100).toFixed(0)}
              </span>
              <button
                className="mini"
                disabled={busy === `card-${p.id}`}
                onClick={() => sendCard(p)}
              >
                {busy === `card-${p.id}` ? '…' : '发卡片'}
              </button>
            </div>
          ))}
        </div>
      )}

      {status && <div className="status">{status}</div>}
      <div className="hint">发送经企业微信客户端逐条人工确认（P1 红线，系统无自动发送）</div>
    </section>
  );
}
