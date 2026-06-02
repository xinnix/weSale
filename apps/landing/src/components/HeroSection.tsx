'use client';

import { isWechatBrowser, openWechatKf } from '@/lib/wechat';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';

export default function HeroSection() {
  const [inWechat, setInWechat] = useState(false);

  useEffect(() => {
    setInWechat(isWechatBrowser());
  }, []);

  const handleCta = useCallback(() => {
    if (inWechat) openWechatKf();
  }, [inWechat]);

  const kfUrl = process.env.NEXT_PUBLIC_KF_URL || 'https://work.weixin.qq.com/kfid/';

  return (
    <section className="bg-white pb-20 pt-32 md:pt-40">
      <div className="mx-auto max-w-5xl px-5">
        <div className="grid items-center gap-12 md:grid-cols-[1.2fr_1fr] md:gap-16">
          {/* Copy */}
          <div>
            <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-gray-950 md:text-6xl">
              在微信里，
              <br />
              雇一个 <span className="text-brand-600">AI 销售</span>。
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600 md:text-xl">
              7×24 自动接待客户、推荐商品、完成支付。
              <br />
              每条对话都可能变成订单。
            </p>

            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {inWechat ? (
                <button
                  onClick={handleCta}
                  className="inline-flex h-12 items-center rounded-lg bg-gray-950 px-7 text-base font-medium text-white transition-colors hover:bg-gray-800 active:scale-[0.98]"
                >
                  立即体验
                </button>
              ) : (
                <a
                  href="#pricing"
                  className="inline-flex h-12 items-center rounded-lg bg-gray-950 px-7 text-base font-medium text-white transition-colors hover:bg-gray-800 active:scale-[0.98]"
                >
                  查看方案
                </a>
              )}
              <a
                href="#features"
                className="inline-flex h-12 items-center px-2 text-base font-medium text-gray-700 transition-colors hover:text-gray-950"
              >
                了解功能 →
              </a>
            </div>

            <p className="mt-8 text-sm text-gray-500">14 天免费试用 · 无需绑定信用卡</p>
          </div>

          {/* QR card */}
          <div className="mx-auto w-full max-w-sm md:mx-0">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-white">
                <QRCodeSVG
                  value={kfUrl}
                  size={320}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0a0a0a"
                  className="h-full w-full"
                />
              </div>
              <p className="mt-4 text-center text-sm font-medium text-gray-900">
                微信扫码，立即体验
              </p>
              <p className="mt-1 text-center text-xs text-gray-500">添加客服后，5 分钟完成接入</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
