'use client';

import { isWechatBrowser, openWechatKf } from '@/lib/wechat';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';

export default function FloatingCTA() {
  const [show, setShow] = useState(false);
  const [inWechat, setInWechat] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    // Show CTA after user scrolls a bit
    const onScroll = () => {
      setShow(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    setInWechat(isWechatBrowser());
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = useCallback(() => {
    if (inWechat) {
      openWechatKf();
    } else {
      setShowQr(true);
    }
  }, [inWechat]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleClick}
        aria-label="立即咨询"
        className={`fixed bottom-6 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition-all duration-300 hover:bg-brand-700 hover:shadow-2xl hover:shadow-brand-600/40 active:scale-95 md:h-auto md:w-auto md:rounded-xl md:px-6 md:py-3.5 ${
          show
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-4 scale-90 opacity-0 pointer-events-none'
        }`}
      >
        {/* Chat icon (mobile) */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-6 w-6 md:hidden"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.355-.348l-3.395.914A1 1 0 0 1 4.8 19.95l.514-2.914C3.5 15.429 3 13.786 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
        {/* Text label (desktop) */}
        <span className="hidden md:inline-flex md:items-center md:gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.355-.348l-3.395.914A1 1 0 0 1 4.8 19.95l.514-2.914C3.5 15.429 3 13.786 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
            />
          </svg>
          立即咨询
        </span>
      </button>

      {/* QR Code popup (non-WeChat browser) */}
      {showQr && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowQr(false)}
          role="dialog"
          aria-modal="true"
          aria-label="扫码体验 weSale"
        >
          <div
            className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQr(false)}
              aria-label="关闭"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L8.94 10l-5.72 5.72a.75.75 0 1 0 1.06 1.06L10 11.06l5.72 5.72a.75.75 0 1 0 1.06-1.06L11.06 10l5.72-5.72a.75.75 0 0 0-1.06-1.06L10 8.94 4.28 3.22Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">扫码体验 weSale</h3>
              <p className="mt-2 text-sm text-gray-500">
                使用微信扫描下方二维码，即刻开始体验 AI 销售助手
              </p>

              {/* QR code */}
              <div className="mx-auto mt-6 flex h-48 w-48 items-center justify-center rounded-xl bg-white p-2">
                <QRCodeSVG
                  value={process.env.NEXT_PUBLIC_KF_URL || 'https://work.weixin.qq.com/kfid/'}
                  size={160}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#1a1a1a"
                />
              </div>

              <p className="mt-5 text-xs text-gray-400">
                或添加微信号 <span className="font-mono font-medium text-gray-600">weSale_AI</span>{' '}
                咨询
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
