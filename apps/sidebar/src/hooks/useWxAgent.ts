import { useCallback, useEffect, useState } from 'react';
import type { JsapiConfig } from '../api/profile';

// 企微客户端 JS-SDK（jWeixin 扩展为 ww）
export interface WxAgent {
  ready: boolean;
  error: string | null;
  /** 当前会话客户 external_userid（仅聊天工具栏内可用） */
  getCurExternalContact: () => Promise<{ userId?: string }>;
  /** 向当前会话发送（JS-SDK，销售在客户端内逐条确认） */
  sendChatMessage: (message: {
    msgtype: 'text' | 'miniprogram';
    text?: { content: string };
    miniprogram?: { appid: string; title: string; pagepath: string; thumb_media_id: string };
  }) => Promise<{ errMsg: string }>;
}

const ww = (window as any).ww as any;

export function useWxAgent(config: JsapiConfig | null): WxAgent {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    if (!ww) {
      setError('企微 JS-SDK 未加载（需在企业微信客户端内打开）');
      return;
    }
    ww.config({
      beta: true, // 侧边栏接口需要 beta 模式
      corpid: config.appId,
      agentid: config.agentid,
      timestamp: config.timestamp,
      nonceStr: config.nonceStr,
      signature: config.signature,
      jsApiList: ['getCurExternalContact', 'sendChatMessage'],
    });
    ww.error((err: any) => {
      console.error('ww.config error', err);
      setError(err?.errMsg || 'JS-SDK 初始化失败');
    });
    ww.ready(() => {
      setReady(true);
      setError(null);
    });
  }, [config]);

  const getCurExternalContact = useCallback(async () => {
    if (!ww) throw new Error('企微 JS-SDK 未加载');
    return new Promise<{ userId?: string }>((resolve, reject) => {
      ww.invoke('getCurExternalContact', {}, (res: any) => {
        if (res?.userId) resolve({ userId: res.userId });
        else reject(new Error(res?.errMsg || 'getCurExternalContact 失败'));
      });
    });
  }, []);

  const sendChatMessage = useCallback(
    async (message: {
      msgtype: 'text' | 'miniprogram';
      text?: { content: string };
      miniprogram?: { appid: string; title: string; pagepath: string; thumb_media_id: string };
    }) => {
      if (!ww) throw new Error('企微 JS-SDK 未加载');
      return new Promise<{ errMsg: string }>((resolve, reject) => {
        ww.invoke('sendChatMessage', message, (res: any) => {
          if (res?.errMsg?.includes('ok')) resolve({ errMsg: res.errMsg });
          else reject(new Error(res?.errMsg || 'sendChatMessage 失败'));
        });
      });
    },
    [],
  );

  return { ready, error, getCurExternalContact, sendChatMessage };
}
