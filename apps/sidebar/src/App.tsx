import { initTokenFromUrl, useToken } from './hooks/useToken';
import ProfilePanel from './pages/ProfilePanel';

// OAuth 回调落地：持久化 token 并清理地址栏（幂等，双调用无害）
void initTokenFromUrl();

const OAUTH_GUARD_KEY = 'wesale_oauth_attempt_at';

/**
 * 静默授权自动跳转（snsapi_base 无感，不弹确认页）
 * 防死循环：30s 内已尝试过则停（OAuth 失败回来时不再无限重定向）
 */
function autoAuthorize(): void {
  const last = Number(sessionStorage.getItem(OAUTH_GUARD_KEY) || 0);
  if (Date.now() - last < 30_000) return;
  sessionStorage.setItem(OAUTH_GUARD_KEY, String(Date.now()));
  window.location.href = '/api/sidebar/oauth/authorize';
}

export default function App() {
  const { token, clear } = useToken();

  if (!token) {
    const retried = Date.now() - Number(sessionStorage.getItem(OAUTH_GUARD_KEY) || 0) < 30_000;
    if (!retried) {
      autoAuthorize();
      return (
        <div className="login-wrap">
          <h1>weSale Copilot</h1>
          <p className="sub">正在自动登录…</p>
        </div>
      );
    }
    return (
      <div className="login-wrap">
        <h1>weSale Copilot</h1>
        <p className="sub">自动登录未完成。请确认你在企业微信内打开本页面，或手动重试。</p>
        <button
          className="primary"
          onClick={() => {
            sessionStorage.removeItem(OAUTH_GUARD_KEY);
            window.location.href = '/api/sidebar/oauth/authorize';
          }}
        >
          重试登录
        </button>
      </div>
    );
  }

  return <ProfilePanel token={token} onLogout={clear} />;
}
