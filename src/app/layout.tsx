import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aurea — Autonomous AI Website & Store Builder',
  description:
    'Describe your business in one sentence. Aurea autonomously designs, writes, and builds a complete, SEO-ready website or online store.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Aurea — Autonomous AI Website & Store Builder',
    description: 'From a short brief to a complete, production-ready website in one click.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
