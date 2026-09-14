import { initTokenFromUrl, useToken } from './hooks/useToken';
import ProfilePanel from './pages/ProfilePanel';

// OAuth 回调落地：持久化 token 并清理地址栏（幂等，双调用无害）
void initTokenFromUrl();

export default function App() {
  const { token, clear } = useToken();

  if (!token) {
    return (
      <div className="login-wrap">
        <h1>weSale Copilot</h1>
        <p className="sub">销售侧边栏 · 请在企业微信聊天工具栏中打开，并完成成员授权。</p>
        <button
          className="primary"
          onClick={() => {
            window.location.href = '/api/sidebar/oauth/authorize';
          }}
        >
          企微授权登录
        </button>
      </div>
    );
  }

  return <ProfilePanel token={token} onLogout={clear} />;
}
