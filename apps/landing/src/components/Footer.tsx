export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-5 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-gray-950">weSale</span>
          <span className="text-xs text-gray-400">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <a href="#features" className="transition-colors hover:text-gray-950">
            功能
          </a>
          <a href="#pricing" className="transition-colors hover:text-gray-950">
            定价
          </a>
          <a href="#" className="transition-colors hover:text-gray-950">
            服务协议
          </a>
          <a href="#" className="transition-colors hover:text-gray-950">
            隐私政策
          </a>
        </div>
      </div>
    </footer>
  );
}
