import { useState } from 'react';
import type { ProfileResponse } from '../api/profile';
import type { WxAgent } from '../hooks/useWxAgent';

/** 基于画像/订单历史的辅助建议（M2 将替换为 AI 三策略流式生成） */
function buildSuggestion(p: ProfileResponse): string {
  const name = p.external?.userName ?? p.contact.nickname ?? '亲';
  if (p.stats.paidOrders >= 2) {
    return `${name}您好，您是我们老顾客啦～最近有一批新品到店，想请您优先了解一下，正好有一位专属回购福利可以一起看下～`;
  }
  if (p.stats.paidOrders === 1) {
    return `${name}您好，感谢上次的信任～上次购买的商品使用还顺利吗？针对老顾客现在有回购福利，我把详情发给您参考～`;
  }
  return `${name}您好，看您之前咨询过我们的产品，现在有一个限时活动，可以给您介绍下具体方案～`;
}

/**
 * 快捷动作：发送话术（ww.sendChatMessage，销售在客户端内逐条确认）
 * + 一键复制兜底。风控红线 P1：全部由销售手动触发，无自动发送。
 */
export default function QuickActions({ wx, profile }: { wx: WxAgent; profile: ProfileResponse }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const suggestion = buildSuggestion(profile);

  const doSend = async (content: string) => {
    setBusy(true);
    setStatus(null);
    try {
      await wx.sendChatMessage({ msgtype: 'text', text: { content } });
      setStatus('已调起发送，请在企微客户端内确认');
    } catch (e: any) {
      setStatus(`发送失败：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion);
      setStatus('话术已复制');
    } catch {
      setStatus('复制失败，请手动选择文本');
    }
  };

  return (
    <section className="section quick-actions">
      <h3>销售辅助建议</h3>
      <p className="suggestion">{suggestion}</p>
      <div className="actions-row">
        <button className="primary" disabled={busy} onClick={() => doSend(suggestion)}>
          {busy ? '发送中…' : '发送话术'}
        </button>
        <button disabled={busy} onClick={copy}>
          一键复制
        </button>
      </div>
      {status && <div className="status">{status}</div>}
      <div className="hint">发送经由企业微信客户端逐条人工确认（P1 红线，系统无自动发送）</div>
    </section>
  );
}
