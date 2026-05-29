'use client';

import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const FEATURES = [
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-7 w-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.24.67 2.4 1.76 3.06a7.5 7.5 0 0 1 7.98 0c1.09-.66 1.76-1.82 1.76-3.06V6.75a2.25 2.25 0 0 0-2.25-2.25h-7.5A2.25 2.25 0 0 0 3 6.75v5.01Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
        />
      </svg>
    ),
    title: 'AI 自动对话',
    desc: '基于大模型理解客户意图，自动回复咨询、跟进意向、促成转化，无需人工值守',
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-7 w-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904 9 18.75l-.813-2.846a8.25 8.25 0 0 0-5.34-5.34L0 8.75l2.846-.813a8.25 8.25 0 0 0 5.34-5.34L9 .75l.813 2.846a8.25 8.25 0 0 0 5.34 5.34L18 8.75l-2.846.813a8.25 8.25 0 0 0-5.34 5.34ZM18.259 21.404l-.5 1.72-.5-1.72a3.75 3.75 0 0 0-2.47-2.47l-1.72-.5 1.72-.5a3.75 3.75 0 0 0 2.47-2.47l.5-1.72.5 1.72a3.75 3.75 0 0 0 2.47 2.47l1.72.5-1.72.5a3.75 3.75 0 0 0-2.47 2.47Z"
        />
      </svg>
    ),
    title: '智能推荐',
    desc: '根据客户画像和对话上下文，实时推荐最匹配的商品组合，提升客单价',
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-7 w-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 8.25a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM14.25 8.25a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM8.25 18.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75c1.5-.75 3-1.125 4.5-.75" />
      </svg>
    ),
    title: '微信支付',
    desc: '对话中直接发送支付链接，客户一键完成下单，支持 JSAPI 支付和自动退款',
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-7 w-7"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25C6.996 12 7.5 12.504 7.5 13.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
      </svg>
    ),
    title: '数据看板',
    desc: '实时查看对话量、转化率、GMV 等核心指标，用数据驱动销售策略优化',
  },
];

export default function FeaturesSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="features" className="bg-gray-50/70 py-20 md:py-28">
      <div ref={ref} className="mx-auto max-w-5xl px-5">
        {/* Section header */}
        <div
          className={`mx-auto mb-14 max-w-2xl text-center transition-all duration-500 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-600">
            核心能力
          </p>
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            一个 AI 助手，覆盖销售全链路
          </h2>
          <p className="mt-4 text-base text-gray-500">
            从获客到成交到复购，weSale 让每一步都更智能
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-6 sm:grid-cols-2 md:gap-8">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`group rounded-2xl border border-gray-200/80 bg-white p-7 transition-all duration-700 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/40 md:p-8 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ transitionDelay: isVisible ? `${(i + 1) * 80}ms` : '0ms' }}
            >
              <div className="mb-4 inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-600 transition-colors group-hover:bg-brand-100">
                {f.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
