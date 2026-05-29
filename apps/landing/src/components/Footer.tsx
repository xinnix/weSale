export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50 py-12">
      <div className="mx-auto max-w-5xl px-5">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="text-lg font-bold text-gray-900">weSale</div>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              AI 驱动的微信销售助手，让每一条对话都变成订单
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">产品</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <a href="#features" className="transition-colors hover:text-brand-600">
                  功能介绍
                </a>
              </li>
              <li>
                <a href="#pricing" className="transition-colors hover:text-brand-600">
                  定价方案
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-brand-600">
                  更新日志
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">支持</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <a href="#" className="transition-colors hover:text-brand-600">
                  帮助中心
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-brand-600">
                  API 文档
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-brand-600">
                  联系客服
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">法律</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <a href="#" className="transition-colors hover:text-brand-600">
                  服务协议
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-brand-600">
                  隐私政策
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 md:flex-row">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} weSale. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <a
              href="#"
              aria-label="微信"
              className="text-gray-400 transition-colors hover:text-brand-600"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.594.594 0 0 1 .213.665l-.39 1.48c-.019.074-.024.148.021.207.046.06.12.06.186.036l1.71-.936a.594.594 0 0 1 .496-.04c1.07.358 2.226.546 3.453.546.469 0 .927-.033 1.376-.094a5.8 5.8 0 0 1-.216-1.556c0-3.627 3.412-6.57 7.614-6.57.357 0 .708.024 1.053.068C17.555 4.688 13.492 2.188 8.691 2.188Zm-2.6 4.17a1.06 1.06 0 1 1 0 2.12 1.06 1.06 0 0 1 0-2.12Zm5.2 0a1.06 1.06 0 1 1 0 2.12 1.06 1.06 0 0 1 0-2.12ZM16.25 9.5c-3.627 0-6.57 2.494-6.57 5.57 0 3.076 2.943 5.57 6.57 5.57.93 0 1.814-.158 2.63-.442a.476.476 0 0 1 .397.033l1.26.69c.053.019.112.019.149-.029.036-.047.032-.107.015-.164l-.287-1.093a.476.476 0 0 1 .17-.533C21.9 18.043 22.82 16.45 22.82 15.07c0-3.076-2.943-5.57-6.57-5.57Zm-2.52 3.36a.848.848 0 1 1 0 1.696.848.848 0 0 1 0-1.696Zm5.04 0a.848.848 0 1 1 0 1.696.848.848 0 0 1 0-1.696Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
