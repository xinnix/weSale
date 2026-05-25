import { Injectable, Logger } from '@nestjs/common';

export interface DifyChatParams {
  apiUrl: string;
  apiKey: string;
  query: string;
  user: string;
  conversationId?: string;
  inputs?: Record<string, any>;
}

export interface DifyConversationParams {
  apiUrl: string;
  apiKey: string;
  user: string;
  limit?: number;
  lastId?: string;
  sortBy?: string;
}

@Injectable()
export class DifyService {
  private readonly logger = new Logger(DifyService.name);

  async *chatStream(params: DifyChatParams): AsyncGenerator<any> {
    const { apiUrl, apiKey, query, user, conversationId, inputs } = params;
    const url = `${apiUrl}/chat-messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputs || {},
        query,
        response_mode: 'streaming',
        conversation_id: conversationId || '',
        user,
        auto_generate_name: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Dify API error: ${response.status} ${errorText}`);
      throw new Error(`Dify API error: ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.event === 'ping') continue;
              yield event;
            } catch {
              // skip malformed JSON
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        const jsonStr = buffer.slice(6).trim();
        if (jsonStr) {
          try {
            const event = JSON.parse(jsonStr);
            if (event.event !== 'ping') yield event;
          } catch {}
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getConversations(params: DifyConversationParams) {
    const { apiUrl, apiKey, user, limit, lastId, sortBy } = params;
    const searchParams = new URLSearchParams({ user: String(user) });
    if (limit) searchParams.set('limit', String(limit));
    if (lastId) searchParams.set('last_id', lastId);
    if (sortBy) searchParams.set('sort_by', sortBy);

    const response = await fetch(`${apiUrl}/conversations?${searchParams}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }
    return response.json();
  }

  async getMessages(
    apiUrl: string,
    apiKey: string,
    conversationId: string,
    user: string,
    limit?: number,
    firstId?: string,
  ) {
    const searchParams = new URLSearchParams({
      conversation_id: conversationId,
      user,
    });
    if (limit) searchParams.set('limit', String(limit));
    if (firstId) searchParams.set('first_id', firstId);

    const response = await fetch(`${apiUrl}/messages?${searchParams}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }
    return response.json();
  }

  async deleteConversation(apiUrl: string, apiKey: string, conversationId: string, user: string) {
    const response = await fetch(`${apiUrl}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user }),
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }
    return response.json();
  }

  async renameConversation(
    apiUrl: string,
    apiKey: string,
    conversationId: string,
    name: string,
    user: string,
  ) {
    const response = await fetch(`${apiUrl}/conversations/${conversationId}/name`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, auto_generate: false, user }),
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }
    return response.json();
  }

  async stopGeneration(apiUrl: string, apiKey: string, taskId: string, user: string) {
    const response = await fetch(`${apiUrl}/chat-messages/${taskId}/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user }),
    });

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status}`);
    }
    return response.json();
  }
}
