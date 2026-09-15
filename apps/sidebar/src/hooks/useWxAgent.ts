import { useCallback, useEffect, useState } from 'react';
import type { JsapiConfig } from '../api/profile';

// 企微 JS-SDK 全局对象：jweixin-1.2.0.js 挂载 window.wx（企业微信沿用微信 SDK）
// 个别环境别名为 ww，做兼容回退；懒取，避免模块加载时尚未就绪
function getSdk(): any {
  const w = window as any;
  return w.wx || w.ww;
}

export interface WxAgent {
  ready: boolean;
  error: string | null;
  /** JS-SDK 初始化阶段（诊断用）：idle/no-sdk/config-called/config-ready/agentconfig-ok/agentconfig-fail/config-error */
  stage: string;
  /** 当前会话客户 external_userid（仅聊天工具栏内可用） */
  getCurExternalContact: () => Promise<{ userId?: string }>;
  /** 向当前会话发送（JS-SDK，销售在客户端内逐条确认） */
  sendChatMessage: (message: {
    msgtype: 'text' | 'miniprogram';
    text?: { content: string };
    miniprogram?: { appid: string; title: string; pagepath: string; thumb_media_id: string };
  }) => Promise<{ errMsg: string }>;
}

export function useWxAgent(config: JsapiConfig | null): WxAgent {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState('idle');

  useEffect(() => {
    if (!config) return;
    const sdk = getSdk();
    if (!sdk) {
      const w = window as any;
      setStage('no-sdk');
      setError(
        `企微 JS-SDK 未加载（typeof wx=${typeof w.wx}, ww=${typeof w.ww}；需在企业微信客户端内打开）`,
      );
      return;
    }

    setStage('config-called');
    sdk.config({
      beta: true, // 侧边栏接口需要 beta 模式
      appId: config.appId, // 企业 corpId（企微 wx.config 的字段名是 appId，非 corpid）
      timestamp: config.timestamp,
      nonceStr: config.nonceStr,
      signature: config.signature,
      jsApiList: ['getCurExternalContact', 'sendChatMessage'],
    });
    sdk.error((err: any) => {
      console.error('wx.config error', err);
      setStage('config-error');
      setError('wx.config 失败：' + (err?.errMsg || JSON.stringify(err)));
    });
    sdk.ready(() => {
      setStage('config-ready');
      // 先用 wx.config（企业身份）放行，避免 agentConfig 单独失败阻断整条链路
      setReady(true);
      setError(null);
      // 应用级接口（getCurExternalContact / sendChatMessage）需 agentConfig（best-effort，
      // 失败不阻断；若 invoke 依赖它，会在调用时返回更精确的错误）
      sdk.agentConfig({
        corpid: config.appId,
        agentid: config.agentid,
        timestamp: config.timestamp,
        nonceStr: config.nonceStr,
        signature: config.signature,
        jsApiList: ['getCurExternalContact', 'sendChatMessage'],
        success: () => setStage('agentconfig-ok'),
        fail: (res: any) => {
          console.warn('wx.agentConfig fail（不阻断）', res);
          setStage('agentconfig-fail');
        },
      });
    });
  }, [config]);

  // 超时保护：JS-SDK 静默时给出可见错误而非无限 loading
  useEffect(() => {
    if (!config || ready) return;
    const timer = setTimeout(() => {
      setError((prev) => prev ?? 'JS-SDK 初始化超时（企微未回调 ready/agentConfig）');
    }, 8000);
    return () => clearTimeout(timer);
  }, [config, ready]);

  const getCurExternalContact = useCallback(async () => {
    const sdk = getSdk();
    if (!sdk) throw new Error('企微 JS-SDK 未加载');
    return new Promise<{ userId?: string }>((resolve, reject) => {
      sdk.invoke('getCurExternalContact', {}, (res: any) => {
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
      const sdk = getSdk();
      if (!sdk) throw new Error('企微 JS-SDK 未加载');
      return new Promise<{ errMsg: string }>((resolve, reject) => {
        sdk.invoke('sendChatMessage', message, (res: any) => {
          if (res?.errMsg?.includes('ok')) resolve({ errMsg: res.errMsg });
          else reject(new Error(res?.errMsg || 'sendChatMessage 失败'));
        });
      });
    },
    [],
  );

  return { ready, error, stage, getCurExternalContact, sendChatMessage };
}
