'use client';

import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useState } from 'react';

const TIERS = [
  {
    name: '入门版',
    price: 299,
    desc: '适合刚开始探索 AI 销售的小团队',
    features: [
      '1 个 AI 销售助手',
      '每月 1,000 次对话',
      '基础商品推荐',
      '微信支付接入',
      '基础数据看板',
    ],
    cta: '开始试用',
    highlight: false,
  },
  {
    name: '成长版',
    price: 799,
    desc: '适合正在扩张的电商团队',
    features: [
      '5 个 AI 销售助手',
      '每月 10,000 次对话',
      '智能商品推荐 + 组合搭配',
      '微信支付 + 自动退款',
      '高级数据看板 + 转化漏斗',
      '优先技术支持',
    ],
    cta: '立即开通',
    highlight: true,
  },
  {
    name: '企业版',
    price: 1999,
    desc: '适合需要深度定制的大型品牌',
    features: [
      '无限 AI 销售助手',
      '无限对话次数',
      '全功能智能推荐引擎',
      '定制话术 + 品牌人设',
      'API 开放接口',
      '专属客户成功经理',
      'SLA 保障',
    ],
    cta: '联系销售',
    highlight: false,
  },
];

export default function PricingSection() {
  const { ref, isVisible } = useScrollAnimation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section id="pricing" className="bg-white py-20 md:py-28">
      <div ref={ref} className="mx-auto max-w-5xl px-5">
        {/* Section header */}
        <div
          className={`mx-auto mb-14 max-w-2xl text-center transition-all duration-500 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-600">
            简单定价
          </p>
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">选择适合你的方案</h2>
          <p className="mt-4 text-base text-gray-500">所有方案均含 14 天免费试用，无需绑定信用卡</p>
        </div>

        {/* Pricing cards */}
        <div className="grid gap-6 md:grid-cols-3 md:gap-5">
          {TIERS.map((tier, i) => (
            <div
              key={tier.name}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`relative flex flex-col rounded-2xl border p-7 transition-all duration-500 md:p-8 ${
                tier.highlight
                  ? 'border-brand-400 bg-brand-50/30 shadow-xl shadow-brand-200/30 md:scale-[1.03]'
                  : 'border-gray-200/80 bg-white hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/20'
              } ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
              style={{ transitionDelay: isVisible ? `${(i + 1) * 100}ms` : '0ms' }}
            >
              {/* Popular badge */}
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white shadow-md">
                  最受欢迎
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{tier.desc}</p>
              </div>

              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-gray-900">&yen;{tier.price}</span>
                <span className="text-sm text-gray-400">/月</span>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                        tier.highlight ? 'text-brand-500' : 'text-brand-400'
                      }`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.578-9.946a.75.75 0 0 1 1.052-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                  tier.highlight
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20 hover:bg-brand-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
