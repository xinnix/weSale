import { useCallback, useEffect, useState } from 'react';
import {
  register,
  getCurExternalContact as sdkGetCurExternalContact,
  sendChatMessage as sdkSendChatMessage,
} from '@wecom/jssdk';
import { fetchJsapiConfig } from '../api/profile';

export interface WxAgent {
  ready: boolean;
  error: string | null;
  /** JS-SDK 初始化阶段（诊断用）：idle/fetch-config/registering/config-ok/agentconfig-ok/... */
  stage: string;
  /** 当前会话客户 external_userid（仅聊天工具栏内可用） */
  getCurExternalContact: () => Promise<{ userId?: string }>;
  /** 向当前会话发送（JS-SDK，销售在客户端内逐条确认） */
  sendChatMessage: (message: {
    msgtype: 'text' | 'miniprogram';
    text?: { content: string };
    miniprogram?: { appid: string; title: string; img_url: string; page: string };
  }) => Promise<{ errMsg: string }>;
}

/**
 * 企微新版官方 JS-SDK（@wecom/jssdk，ww.register）：
 * 不再手动 wx.config/wx.agentConfig——register 内部按需拉取双签名（企业 + 应用），
 * SDK 自动完成两级鉴权；getCurExternalContact 等 Promise 化接口注册后直接可用。
 */
export function useWxAgent(token: string): WxAgent {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState('idle');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        setStage('fetch-config');
        const url = window.location.href.split('#')[0];
        const cfg = await fetchJsapiConfig(token, url);
        if (cancelled) return;

        setStage('registering');
        register({
          corpId: cfg.appId,
          agentId: cfg.agentid,
          jsApiList: ['getCurExternalContact', 'sendChatMessage'],
          // 企业身份签名（wx.config 层）
          async getConfigSignature(signUrl: string) {
            const c = await fetchJsapiConfig(token, signUrl);
            return { timestamp: c.timestamp, nonceStr: c.nonceStr, signature: c.signature };
          },
          // 应用身份签名（wx.agentConfig 层）
          async getAgentConfigSignature(signUrl: string) {
            const c = await fetchJsapiConfig(token, signUrl);
            return { timestamp: c.timestamp, nonceStr: c.nonceStr, signature: c.agentSignature };
          },
          onConfigSuccess: () => setStage('config-ok'),
          onConfigFail: (res) => {
            setStage(`config-fail: ${JSON.stringify(res)}`);
            setError('企微 config 失败：' + JSON.stringify(res));
          },
          onAgentConfigSuccess: () => {
            setStage('agentconfig-ok');
            setReady(true);
            setError(null);
          },
          onAgentConfigFail: (res) => {
            setStage(`agentconfig-fail: ${JSON.stringify(res)}`);
            setError('企微 agentConfig 失败：' + JSON.stringify(res));
          },
        });
      } catch (e: any) {
        setStage('register-fail');
        setError('企微 SDK 注册失败：' + e.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // 超时保护：鉴权回调静默时给出可见错误而非无限 loading
  useEffect(() => {
    if (!token || ready) return;
    const timer = setTimeout(() => {
      setError((prev) => prev ?? `JS-SDK 初始化超时（stage=${stage}）`);
    }, 12000);
    return () => clearTimeout(timer);
  }, [token, ready, stage]);

  const getCurExternalContact = useCallback(async () => {
    try {
      const r = await sdkGetCurExternalContact();
      if (r.userId) return { userId: r.userId };
      throw new Error(r.errMsg || `errCode=${(r as any).errCode ?? '?'}`);
    } catch (e: any) {
      // 新版 SDK 失败时 reject 普通对象（{errCode,errMsg}），规范化为带信息的 Error
      throw new Error(e?.errMsg || e?.message || JSON.stringify(e));
    }
  }, []);

  const sendChatMessage = useCallback(
    async (message: {
      msgtype: 'text' | 'miniprogram';
      text?: { content: string };
      miniprogram?: { appid: string; title: string; img_url: string; page: string };
    }) => {
      try {
        const r = await sdkSendChatMessage(message as any);
        if (r.errMsg?.includes('ok')) return { errMsg: r.errMsg };
        throw new Error(r.errMsg || `errCode=${(r as any).errCode ?? '?'}`);
      } catch (e: any) {
        throw new Error(e?.errMsg || e?.message || JSON.stringify(e));
      }
    },
    [],
  );

  return { ready, error, stage, getCurExternalContact, sendChatMessage };
}
