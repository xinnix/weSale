import { useEffect, useState } from 'react';
import OrderHistory from '../components/OrderHistory';
import CopilotPanel from '../components/CopilotPanel';
import RecentSession from '../components/RecentSession';
import TagChips from '../components/TagChips';
import { fetchJsapiConfig, fetchProfile, JsapiConfig, ProfileResponse } from '../api/profile';
import { useWxAgent } from '../hooks/useWxAgent';

const INTENT_LABEL: Record<string, string> = {
  UNKNOWN: '未知',
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  CLOSING: '迫单',
};

interface Props {
  token: string;
  onLogout: () => void;
}

/** 客户画像主面板：JS-SDK 签名 → 定位当前客户 → 拉画像 → 渲染 */
export default function ProfilePanel({ token, onLogout }: Props) {
  const url = window.location.href.split('#')[0];
  const [jsapi, setJsapi] = useState<JsapiConfig | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [externalUserId, setExternalUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wx = useWxAgent(jsapi);

  // 1. 先拿 JS-SDK 签名（ww.config 前置）
  useEffect(() => {
    fetchJsapiConfig(token, url)
      .then(setJsapi)
      .catch((e) => setError(e.message));
  }, [token, url]);

  // 2. 聊天工具栏内定位当前客户
  useEffect(() => {
    if (!wx.ready) return;
    wx.getCurExternalContact()
      .then((r) => {
        if (!r.userId) throw new Error('未获取到当前会话客户');
        setExternalUserId(r.userId);
      })
      .catch((e) => setError(e.message));
  }, [wx.ready, wx]);

  // 3. 拉取客户画像
  useEffect(() => {
    if (!externalUserId) return;
    setLoading(true);
    fetchProfile(token, externalUserId)
      .then(setProfile)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [externalUserId, token]);

  if (error) {
    return (
      <div className="center feedback">
        <p className="error-text">{error}</p>
        <button onClick={() => window.location.reload()}>重试</button>
        <button onClick={onLogout}>重新登录</button>
      </div>
    );
  }

  if (loading || !profile) {
    const diag = wx.error || error;
    return (
      <div className="center feedback loading">
        <p>正在加载客户画像…</p>
        <p className="diag">JS-SDK 阶段：{wx.stage}</p>
        {diag && <p className="error-text diag">{diag}</p>}
        {diag && <button onClick={() => window.location.reload()}>重试</button>}
      </div>
    );
  }

  const stats = [
    { label: '累计订单', value: String(profile.stats.totalOrders) },
    { label: '已支付', value: String(profile.stats.paidOrders) },
    { label: '累计金额', value: `¥${(profile.stats.totalPaidAmountFen / 100).toFixed(2)}` },
    { label: '积分', value: String(profile.stats.pointsBalance) },
  ];

  return (
    <div className="panel">
      <header className="contact-header">
        <div className="avatar">
          {profile.external?.avatarUrl ? (
            <img src={profile.external.avatarUrl} alt="" />
          ) : (
            (profile.contact.nickname?.[0] ?? '客')
          )}
        </div>
        <div className="meta">
          <div className="name">
            {profile.external?.userName ?? profile.contact.nickname ?? '未命名客户'}
          </div>
          <div className="sub">
            意向度：{INTENT_LABEL[profile.contact.intentLevel] ?? profile.contact.intentLevel}
          </div>
        </div>
        <button className="link" onClick={onLogout}>
          退出
        </button>
      </header>

      <TagChips tags={profile.tags} />

      <section className="stats">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="value">{s.value}</div>
            <div className="label">{s.label}</div>
          </div>
        ))}
      </section>

      <CopilotPanel token={token} wx={wx} externalUserId={externalUserId!} />

      <OrderHistory orders={profile.orders} />
      <RecentSession messages={profile.recentMessages} />
    </div>
  );
}
