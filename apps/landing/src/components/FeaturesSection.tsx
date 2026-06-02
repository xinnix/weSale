const FEATURES = [
  {
    title: 'AI 自动对话',
    desc: '基于大模型理解客户意图，自动接待咨询、跟进意向、促成转化。',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-5 w-5"
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
  },
  {
    title: '智能推荐',
    desc: '根据对话上下文实时推荐最匹配的商品，提升客单价。',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904 9 18.75l-.813-2.846a8.25 8.25 0 0 0-5.34-5.34L0 8.75l2.846-.813a8.25 8.25 0 0 0 5.34-5.34L9 .75l.813 2.846a8.25 8.25 0 0 0 5.34 5.34L18 8.75l-2.846.813a8.25 8.25 0 0 0-5.34 5.34Z"
        />
      </svg>
    ),
  },
  {
    title: '微信支付',
    desc: '对话中直接发送支付链接，客户一键下单，支持自动退款。',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 8.25a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM14.25 8.25a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM8.25 18.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z"
        />
      </svg>
    ),
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="border-t border-gray-100 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-5">
        <div className="mb-14 max-w-2xl">
          <p className="mb-3 text-sm font-medium text-gray-500">核心能力</p>
          <h2 className="text-3xl font-semibold tracking-tight text-gray-950 md:text-4xl">
            一个 AI 助手，覆盖销售全链路
          </h2>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white p-7 md:p-8">
              <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-700">
                {f.icon}
              </div>
              <h3 className="mb-2 text-base font-semibold text-gray-950">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
