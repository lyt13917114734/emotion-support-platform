import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '公益心理服务平台 · 心理服务志愿者端',
  description: '在线文字心理支持实验平台，本地研究者试跑版。',
  robots: { index: false, follow: false },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
