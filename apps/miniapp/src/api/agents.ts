/**
 * Agent 相关 API
 */
import { http } from '@/utils/http';
import { API_ENDPOINTS } from '@/config/api';

export interface Agent {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  difyAppType: string;
  sort: number;
}

export interface Conversation {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export const agentsApi = {
  getActiveAgents: () => http.get<Agent[]>(API_ENDPOINTS.agentsActive),

  getConversations: (agentId: string, limit = 20) =>
    http.get<any>(API_ENDPOINTS.agentConversations(agentId), { limit, user: 'me' }),

  getMessages: (agentId: string, conversationId: string, limit = 20) =>
    http.get<any>(API_ENDPOINTS.agentMessages(agentId, conversationId), { limit }),
};
