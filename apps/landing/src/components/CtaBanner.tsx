'use client';

import { useScrollAnimation } from '@/hooks/useScrollAnimation';

export default function CtaBanner() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="bg-brand-950 py-20 md:py-24">
      <div
        ref={ref}
        className={`mx-auto max-w-3xl px-5 text-center transition-all duration-700 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        <h2 className="text-2xl font-bold text-white md:text-3xl">准备好让 AI 帮你卖货了吗？</h2>
        <p className="mt-4 text-base text-brand-200/70">
          14 天免费试用，无需绑定信用卡，5 分钟完成接入
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#pricing"
            className="inline-flex h-12 items-center rounded-xl bg-white px-8 text-base font-semibold text-brand-700 shadow-lg transition-all hover:bg-brand-50 hover:shadow-xl active:scale-[0.98]"
          >
            免费开始
          </a>
          <a
            href="#"
            className="inline-flex h-12 items-center rounded-xl border border-brand-400/30 px-8 text-base font-medium text-brand-200 transition-all hover:border-brand-400/50 hover:bg-brand-800/40 hover:text-white active:scale-[0.98]"
          >
            预约演示
          </a>
        </div>
      </div>
    </section>
  );
}
