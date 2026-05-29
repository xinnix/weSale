'use client';

import { useScrollAnimation } from '@/hooks/useScrollAnimation';

export default function HeroSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 pt-24 pb-20 md:pt-36 md:pb-32"
    >
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-brand-400/8 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/5 blur-2xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative mx-auto max-w-5xl px-5 text-center">
        {/* Badge */}
        <div
          className={`mb-6 inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-200 transition-all duration-500 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-300" />
          </span>
          AI 驱动，已服务 10,000+ 商家
        </div>

        {/* Headline */}
        <h1
          className={`text-4xl font-extrabold leading-tight tracking-tight text-white transition-all delay-100 duration-700 md:text-6xl md:leading-[1.1] ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          AI 销售助手
          <br className="hidden md:block" />
          <span className="mt-2 inline-block bg-gradient-to-r from-brand-300 via-brand-200 to-brand-400 bg-clip-text text-transparent">
            7&times;24 自动成交
          </span>
        </h1>

        {/* Subheadline */}
        <p
          className={`mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-100/80 transition-all delay-200 duration-700 md:text-xl ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          在微信里部署你的 AI 销售团队——自动接待客户、智能推荐商品、
          <br className="hidden md:block" />
          即时完成支付，让每一条对话都变成订单
        </p>

        {/* CTA buttons */}
        <div
          className={`mt-10 flex flex-col items-center justify-center gap-4 transition-all delay-300 duration-700 sm:flex-row ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          <a
            href="#pricing"
            className="inline-flex h-12 items-center rounded-xl bg-white px-8 text-base font-semibold text-brand-700 shadow-lg shadow-brand-900/20 transition-all hover:bg-brand-50 hover:shadow-xl hover:shadow-brand-900/30 active:scale-[0.98]"
          >
            立即体验
          </a>
          <a
            href="#features"
            className="inline-flex h-12 items-center rounded-xl border border-brand-400/30 px-8 text-base font-medium text-brand-200 transition-all hover:border-brand-400/50 hover:bg-brand-800/40 hover:text-white active:scale-[0.98]"
          >
            了解详情
          </a>
        </div>

        {/* Stats row */}
        <div
          className={`mt-16 grid grid-cols-3 gap-6 border-t border-brand-500/15 pt-10 transition-all delay-500 duration-700 md:gap-12 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
        >
          {[
            { value: '7×24', label: '全天候在线' },
            { value: '3×', label: '转化率提升' },
            { value: '<5s', label: '响应速度' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold text-white md:text-3xl">{stat.value}</div>
              <div className="mt-1 text-sm text-brand-300/70">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
