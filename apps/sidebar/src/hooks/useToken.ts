const TOKEN_KEY = 'wesale_member_token';

/** 从地址栏解析 OAuth 回调带回的 token（兼容 query 与 hash 内 query） */
export function readTokenFromUrl(): string | null {
  const url = window.location;
  let params = new URLSearchParams(url.search);
  let token = params.get('token');
  if (token) return token;
  const hashQuery = url.hash.split('?')[1];
  if (hashQuery) {
    params = new URLSearchParams(hashQuery);
    token = params.get('token');
  }
  return token;
}

export interface TokenState {
  token: string | null;
  clear: () => void;
}

/** Member JWT 管理：sessionStorage 持久 + 落地后清理地址栏 token */
export function useToken(): TokenState {
  // 简单实现：模块级读 token（无 reactive state），由调用方在变化时 reload
  const token = sessionStorage.getItem(TOKEN_KEY);
  const clear = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  };
  return { token, clear };
}

/**
 * 初始化 token：若 OAuth 回调携 token 则持久化并清理地址栏（防泄露）。
 * 返回 true 表示本次是回调落地，需刷新后进入主面板。
 */
export function initTokenFromUrl(): boolean {
  const urlToken = readTokenFromUrl();
  if (!urlToken) return false;
  sessionStorage.setItem(TOKEN_KEY, urlToken);
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);
  return true;
}
