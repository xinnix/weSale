import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#172554',
};

export const metadata: Metadata = {
  title: 'weSale — AI 销售助手，7×24 自动成交',
  description:
    'weSale 是 AI 驱动的微信销售助手，自动接待客户、智能推荐商品、即时完成支付，让你的每一条对话都变成订单。',
  keywords: [
    'AI销售',
    '微信销售',
    '智能客服',
    '自动成交',
    '微信支付',
    '电商AI',
    '销售助手',
    '私域运营',
  ],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'weSale',
    title: 'weSale — AI 销售助手，7×24 自动成交',
    description: 'AI 驱动的微信销售助手，自动接待客户、智能推荐商品、即时完成支付。',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'weSale — AI 销售助手，7×24 自动成交',
    description: 'AI 驱动的微信销售助手，自动接待客户、智能推荐商品、即时完成支付。',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
