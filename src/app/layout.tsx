import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider';
import DataInitProvider from '@/components/providers/DataInitProvider';
import TabBar from '@/components/layout/TabBar';
import ToastHost from '@/components/ui/ToastHost';
import PWAInstallSheet from '@/components/pwa/PWAInstallSheet';

export const metadata: Metadata = {
  title: '轻燃AI',
  description: '轻盈明快的 AI 饮食、计划与体重管理助手',
  manifest: '/manifest.webmanifest',
  applicationName: '轻燃AI',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '轻燃AI',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFF9F0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-dvh bg-bg-primary text-text-primary font-sans">
        <main className="max-w-[430px] mx-auto relative min-h-dvh">
          <DataInitProvider />
          <AnalyticsProvider />
          {children}
        </main>
        <TabBar />
        <ToastHost />
        <PWAInstallSheet />
        <Script src="/sw-register.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
