import type { Metadata, Viewport } from 'next';
import './globals.css';
import TabBar from '@/components/layout/TabBar';
import ToastHost from '@/components/ui/ToastHost';

export const metadata: Metadata = {
  title: '减脂助手',
  description: 'AI 碳循环计划、体重追踪与饮食记录助手',
  manifest: '/manifest.webmanifest',
  applicationName: '减脂助手',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '减脂助手',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A0F',
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
          {children}
        </main>
        <TabBar />
        <ToastHost />
        <script src="/sw-register.js" defer />
      </body>
    </html>
  );
}
