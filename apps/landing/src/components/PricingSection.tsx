const TIERS = [
  {
    name: '入门',
    price: '299',
    desc: '刚起步的小团队',
    features: ['1 个 AI 助手', '每月 1,000 次对话', '基础商品推荐', '微信支付接入'],
  },
  {
    name: '成长',
    price: '799',
    desc: '正在扩张的电商团队',
    features: [
      '5 个 AI 助手',
      '每月 10,000 次对话',
      '智能组合推荐',
      '自动退款 · 转化漏斗',
      '优先技术支持',
    ],
    highlight: true,
  },
  {
    name: '企业',
    price: '面议',
    desc: '需要深度定制',
    features: [
      '不限助手数量',
      '不限对话次数',
      '定制话术 · 品牌人设',
      'API 开放接口',
      '专属客户成功经理',
    ],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="border-t border-gray-100 bg-gray-50/40 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-5">
        <div className="mb-14 max-w-2xl">
          <p className="mb-3 text-sm font-medium text-gray-500">定价</p>
          <h2 className="text-3xl font-semibold tracking-tight text-gray-950 md:text-4xl">
            按团队规模付费，无隐藏费用
          </h2>
          <p className="mt-4 text-base text-gray-600">所有方案含 14 天免费试用，无需绑定信用卡</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col rounded-xl border p-6 md:p-7 ${
                tier.highlight ? 'border-gray-950 bg-white shadow-sm' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-base font-semibold text-gray-950">{tier.name}</h3>
                {tier.highlight && <span className="text-xs font-medium text-brand-600">推荐</span>}
              </div>
              <p className="mt-1 text-sm text-gray-500">{tier.desc}</p>

              <div className="mt-6 flex items-baseline gap-1">
                {tier.price === '面议' ? (
                  <span className="text-3xl font-semibold text-gray-950">面议</span>
                ) : (
                  <>
                    <span className="text-sm text-gray-500">¥</span>
                    <span className="text-4xl font-semibold tracking-tight text-gray-950">
                      {tier.price}
                    </span>
                    <span className="text-sm text-gray-500">/月</span>
                  </>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
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

              <a
                href="#contact"
                className={`mt-8 inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  tier.highlight
                    ? 'bg-gray-950 text-white hover:bg-gray-800'
                    : 'border border-gray-200 bg-white text-gray-950 hover:border-gray-300'
                }`}
              >
                {tier.price === '面议' ? '联系销售' : '开始试用'}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
