import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'MTG TTS Builder — Commander Deck Builder for Tabletop Simulator',
    template: '%s | MTG TTS Builder',
  },
  description:
    'The ultimate open-source MTG Commander deck builder. Custom art variant prints, proportional cardbacks, and flawless imports from Moxfield/Archidekt. Export to Tabletop Simulator instantly.',
  keywords: [
    'MTG',
    'Commander',
    'EDH',
    'Tabletop Simulator',
    'TTS',
    'Deck Builder',
    'Scryfall',
    'Moxfield',
    'Archidekt',
    'Magic: The Gathering',
  ],
  authors: [{ name: 'MTG TTS Builder Community' }],
  creator: 'MTG TTS Builder Community',
  metadataBase: new URL('https://mtg-tts-builder.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'MTG TTS Builder — Commander Deck Builder for Tabletop Simulator',
    description:
      'The ultimate open-source MTG Commander deck builder. Swap card variants, customize cardbacks, track win rates, and export directly to Tabletop Simulator.',
    siteName: 'MTG TTS Builder',
    images: [
      {
        url: '/mtg.png',
        width: 1200,
        height: 630,
        alt: 'MTG TTS Builder Commander Deck Builder',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MTG TTS Builder — Commander Deck Builder for Tabletop Simulator',
    description:
      'The ultimate open-source MTG Commander deck builder. Swap card variants, customize cardbacks, track win rates, and export directly to Tabletop Simulator.',
    images: ['/mtg.png'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
