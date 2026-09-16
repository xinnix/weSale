const API_BASE = '/api';

async function parseError(res: Response): Promise<never> {
  const text = await res.text();
  let message = text || `HTTP ${res.status}`;
  try {
    const json = JSON.parse(text);
    message = json?.message || json?.error || message;
  } catch {
    /* 非 JSON 错误体 */
  }
  throw new Error(message);
}

/**
 * 后端 TransformInterceptor 把响应包成 {success, statusCode, data, timestamp}，
 * 这里统一解包 data；非包装响应原样返回
 */
async function unpack<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await parseError(res);
  return unpack<T>(res);
}

export async function apiPost<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res);
  return unpack<T>(res);
}
