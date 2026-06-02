import type { Metadata } from 'next';
import LZString from 'lz-string';
import ShareClient from './ShareClient';

// ---------------------------------------------------------------------------
// Minimal payload type — mirrors lib/share.ts SharedDeckPayload
// We only need n, c, cv here to extract commander data for SEO without
// making any external Scryfall API calls at build/request time.
// ---------------------------------------------------------------------------
interface MinimalPayload {
  n?: string;        // deckName
  c?: string;        // cards flat string: scryfallId,qty,isComm,...;...
  cv?: string | null;  // coverCardId
}

function parsePayload(encoded: string): MinimalPayload | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json) as MinimalPayload;
  } catch {
    return null;
  }
}

/** Extract the commander's scryfallId from the compact card string */
function getCommanderId(cardsStr: string): string | null {
  if (!cardsStr) return null;
  const entries = cardsStr.split(';');
  for (const entry of entries) {
    const parts = entry.split(',');
    // parts[2] === '1' means isCommander
    if (parts[2] === '1' && parts[0]) return parts[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// generateMetadata — Server Component only, runs before the page renders
// ---------------------------------------------------------------------------
type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedParams = await searchParams;
  const encoded = typeof resolvedParams.d === 'string' ? resolvedParams.d : null;

  // Fallback metadata if the link is missing or invalid
  const fallback: Metadata = {
    title: 'Shared Commander Deck | MTG TTS Builder',
    description: 'View and clone this Commander deck shared via MTG TTS Builder — no account required.',
    openGraph: {
      title: 'Shared Commander Deck | MTG TTS Builder',
      description: 'View and clone this Commander deck — 100 cards, art variants included, no account required.',
      siteName: 'MTG TTS Builder',
      images: [{ url: '/mtg.png', width: 1200, height: 630, alt: 'MTG TTS Builder' }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Shared Commander Deck | MTG TTS Builder',
      description: 'View and clone this Commander deck — 100 cards, art variants included, no account required.',
      images: ['/mtg.png'],
    },
  };

  if (!encoded) return fallback;

  const payload = parsePayload(encoded);
  if (!payload) return fallback;

  const deckName = payload.n || 'Commander Deck';
  const commanderId = getCommanderId(payload.c || '');

  // Total card count from the cards string
  const cardCount = payload.c ? payload.c.split(';').filter(Boolean).length : 0;

  // Build the Scryfall art_crop image URL using the commander's Scryfall ID
  // This is a direct CDN URL — no fetch needed, no rate limiting.
  // Format: https://cards.scryfall.io/art_crop/front/{c1}/{c2}/{uuid}.jpg
  let ogImageUrl = '/mtg.png';
  if (commanderId && commanderId.length >= 2) {
    const c1 = commanderId[0];
    const c2 = commanderId[1];
    ogImageUrl = `https://cards.scryfall.io/art_crop/front/${c1}/${c2}/${commanderId}.jpg`;
  } else if (payload.cv && payload.cv.length >= 2) {
    const c1 = payload.cv[0];
    const c2 = payload.cv[1];
    ogImageUrl = `https://cards.scryfall.io/art_crop/front/${c1}/${c2}/${payload.cv}.jpg`;
  }

  const title = `${deckName} | MTG TTS Builder`;
  const description = `${cardCount} card Commander deck shared via MTG TTS Builder. View the full decklist, browse card art variants, and clone it to your builder with one click — no account needed.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'MTG TTS Builder',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 626,
          height: 457,
          alt: `${deckName} — Commander deck art`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    robots: {
      index: false, // shared decks are personal links, keep them out of search
      follow: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Page — delegates all interactive rendering to the Client Component
// ---------------------------------------------------------------------------
export default function SharePage() {
  return <ShareClient />;
}
