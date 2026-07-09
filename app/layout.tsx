import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { TelegramWebAppInit } from '@/components/telegram-webapp-init'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://diao-tg-app.pages.dev'),
  title: {
    default: '赌狗也有春天 | DIAO',
    template: '%s | DIAO',
  },
  description: 'DIAO 是一场机会的测试。上传合约亏损截图，生成翻身目标，用 DIAO 追踪你的战场进度。',
  applicationName: '赌狗也有春天 · DIAO',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' },
      { url: '/diao.png', type: 'image/png' },
    ],
    apple: [{ url: '/icon.png', type: 'image/png' }],
    shortcut: ['/icon.png'],
  },
  openGraph: {
    title: '赌狗也有春天 | DIAO',
    description: '上传合约亏损截图，生成翻身目标，用 DIAO 追踪你的战场进度。',
    siteName: 'DIAO',
    images: [{ url: '/icon.png', width: 709, height: 709, alt: 'DIAO logo' }],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: '赌狗也有春天 | DIAO',
    description: '上传合约亏损截图，生成翻身目标，用 DIAO 追踪你的战场进度。',
    images: ['/icon.png'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0e0e14',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="bg-background" suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="antialiased">
        <TelegramWebAppInit />
        {children}
      </body>
    </html>
  )
}
