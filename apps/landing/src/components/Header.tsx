export default function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-gray-100/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 md:h-16">
        <a href="/" className="flex items-center gap-2">
          <span className="text-base font-semibold tracking-tight text-gray-950">weSale</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="主导航">
          <a
            href="#features"
            className="text-sm text-gray-600 transition-colors hover:text-gray-950"
          >
            功能
          </a>
          <a
            href="#pricing"
            className="text-sm text-gray-600 transition-colors hover:text-gray-950"
          >
            定价
          </a>
        </nav>

        <a
          href="#pricing"
          className="rounded-lg bg-gray-950 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 active:scale-95"
        >
          免费试用
        </a>
      </div>
    </header>
  );
}
