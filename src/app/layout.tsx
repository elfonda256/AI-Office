import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kantor AI — Isometric Multi-Agent Office',
  description:
    'Simulasi kantor isometrik interaktif multi-agent dengan Next.js, TypeScript, dan Phaser.js',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
