import { apiGet, apiPost } from './http';

export interface TagItem {
  name: string;
  source: 'CHANNEL' | 'LIVECODE' | 'BEHAVIOR';
  refId?: string;
  at: string;
}

export interface OrderBrief {
  id: string;
  orderNo: string;
  status: string;
  totalAmountFen: number;
  productName: string | null;
  category?: string | null;
  source: string;
  createdAt: string;
  paidAt: string | null;
}

export interface ProfileResponse {
  member: { userId: string; corpId: string };
  external: { userName?: string | null; avatarUrl?: string | null; isFollow?: boolean } | null;
  contact: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
    intentLevel: string;
    status: string;
  };
  tags: TagItem[];
  orders: OrderBrief[];
  stats: {
    totalOrders: number;
    paidOrders: number;
    totalPaidAmountFen: number;
    pointsBalance: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
  };
  recentMessages: { role: string; content: string; createdAt: string }[];
}

export interface JsapiConfig {
  appId: string;
  agentid: number;
  timestamp: number;
  nonceStr: string;
  signature: string;
}

export function fetchProfile(token: string, externalUserId: string): Promise<ProfileResponse> {
  return apiGet<ProfileResponse>(
    `/sidebar/profile?externalUserId=${encodeURIComponent(externalUserId)}`,
    token,
  );
}

export function fetchJsapiConfig(token: string, url: string): Promise<JsapiConfig> {
  return apiPost<JsapiConfig>('/sidebar/jsapi-config', token, { url });
}
