import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ironbound — Incremental RPG',
  description: 'Train your power, challenge the dungeon, and climb floor by floor.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#090b12' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
