export default function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-brand-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 md:h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
            W
          </div>
          <span className="text-lg font-bold text-white">weSale</span>
        </a>

        {/* Nav links */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="主导航">
          <a
            href="#features"
            className="text-sm font-medium text-brand-200/80 transition-colors hover:text-white"
          >
            功能
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-brand-200/80 transition-colors hover:text-white"
          >
            定价
          </a>
          <a
            href="#"
            className="text-sm font-medium text-brand-200/80 transition-colors hover:text-white"
          >
            文档
          </a>
        </nav>

        {/* CTA */}
        <a
          href="#pricing"
          className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-white/20 active:scale-95 md:px-5"
        >
          免费试用
        </a>
      </div>
    </header>
  );
}
