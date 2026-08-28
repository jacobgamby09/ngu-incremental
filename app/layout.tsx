import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://ironbound-incremental.jacob-gamby.chatgpt.site'),
  title: 'Ironbound — Incremental RPG',
  description: 'Train your power, challenge the dungeon, and climb floor by floor.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Ironbound — Incremental RPG',
    description: 'Train your power, challenge the dungeon, and climb floor by floor.',
    type: 'website',
    url: '/',
    images: [{ url: '/og.png', width: 1672, height: 909, alt: 'Ironbound — Train. Descend. Ascend.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ironbound — Incremental RPG',
    description: 'Train your power, challenge the dungeon, and climb floor by floor.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#090b12' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
