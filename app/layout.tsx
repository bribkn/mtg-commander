import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MTG TTS Builder — Commander Deck Builder for Tabletop Simulator',
  description:
    'Build MTG Commander decks and export them to Tabletop Simulator. Import from Moxfield or Archidekt, use bulk text import, and auto-generate tokens and double-faced card decks.',
  keywords: ['MTG', 'Commander', 'Tabletop Simulator', 'TTS', 'deck builder', 'Magic the Gathering'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
