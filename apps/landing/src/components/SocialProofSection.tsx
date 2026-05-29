'use client';

import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const LOGOS = [
  { name: '花西子', abbr: '花' },
  { name: '三顿半', abbr: '三' },
  { name: '完美日记', abbr: '完' },
  { name: '钟薛高', abbr: '钟' },
  { name: '泡泡玛特', abbr: '泡' },
  { name: '蕉内', abbr: '蕉' },
];

const TESTIMONIALS = [
  {
    quote: '接入 weSale 后，客服响应从平均 3 分钟降到 5 秒以内，夜间订单量增长了 40%。',
    author: '张经理',
    company: '某美妆品牌',
    role: '电商负责人',
  },
  {
    quote: 'AI 自动推荐让客单价提升了 28%，我们终于不用再手动给每个客户发商品链接了。',
    author: '李总',
    company: '某食品品牌',
    role: '创始人',
  },
  {
    quote: '最惊喜的是退款和售后也能自动处理，客户满意度反而上升了，因为响应太快了。',
    author: '王总监',
    company: '某服饰品牌',
    role: '运营总监',
  },
];

export default function SocialProofSection() {
  const { ref: logoRef, isVisible: logosVisible } = useScrollAnimation();
  const { ref: testimonialRef, isVisible: testimonialsVisible } = useScrollAnimation();

  return (
    <section className="bg-white py-20 md:py-28">
      {/* Logos */}
      <div ref={logoRef} className="mx-auto max-w-5xl px-5">
        <p
          className={`mb-8 text-center text-sm font-medium uppercase tracking-widest text-gray-400 transition-all duration-500 ${
            logosVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          他们都在用 weSale
        </p>
        <div
          className={`flex flex-wrap items-center justify-center gap-8 transition-all delay-100 duration-700 md:gap-12 ${
            logosVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          {LOGOS.map((logo) => (
            <div
              key={logo.name}
              className="flex h-12 w-24 items-center justify-center rounded-lg bg-gray-50 text-lg font-semibold text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-400"
              title={logo.name}
            >
              {logo.abbr}
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div ref={testimonialRef} className="mx-auto mt-20 max-w-5xl px-5">
        <h2
          className={`mb-12 text-center text-2xl font-bold text-gray-900 transition-all duration-500 md:text-3xl ${
            testimonialsVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          客户怎么说
        </h2>
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className={`rounded-2xl border border-gray-100 bg-gray-50/50 p-6 transition-all duration-700 hover:border-brand-200 hover:bg-brand-50/30 md:p-7 ${
                testimonialsVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ transitionDelay: testimonialsVisible ? `${(i + 1) * 100}ms` : '0ms' }}
            >
              <p className="text-base leading-relaxed text-gray-700">{t.quote}</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600">
                  {t.author[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {t.author}
                    <span className="ml-1 font-normal text-gray-400">/ {t.role}</span>
                  </div>
                  <div className="text-xs text-gray-500">{t.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
