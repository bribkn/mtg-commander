// Scryfall API Client

export type CardLayout =
  | 'normal'
  | 'split'
  | 'flip'
  | 'transform'
  | 'modal_dfc'
  | 'meld'
  | 'leveler'
  | 'class'
  | 'saga'
  | 'adventure'
  | 'mutate'
  | 'prototype'
  | 'battle'
  | 'planar'
  | 'scheme'
  | 'vanguard'
  | 'token'
  | 'double_faced_token'
  | 'emblem'
  | 'augment'
  | 'host'
  | 'art_series'
  | 'reversible_card';

export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCardFace {
  name: string;
  image_uris?: ScryfallImageUris;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
}

export interface ScryfallRelatedCard {
  id: string;
  object: 'related_card';
  component: 'token' | 'meld_part' | 'meld_result' | 'combo_piece';
  name: string;
  type_line: string;
  uri: string;
}

export interface ScryfallCard {
  id: string;
  name: string;
  layout: CardLayout;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  all_parts?: ScryfallRelatedCard[];
  legalities: Record<string, string>;
  set: string;
  set_name: string;
  rarity: string;
  uri: string;
  scryfall_uri: string;
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    eur?: string | null;
    eur_foil?: string | null;
    tix?: string | null;
  };
}

const SCRYFALL_BASE = 'https://api.scryfall.com';

// Rate-limit: Scryfall asks for 50–100ms between requests
let lastRequestTime = 0;
async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 100) {
    await new Promise((r) => setTimeout(r, 100 - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url);
}

/** Fetch a card by exact name */
export async function getCardByExactName(name: string): Promise<ScryfallCard | null> {
  try {
    const res = await rateLimitedFetch(
      `${SCRYFALL_BASE}/cards/named?exact=${encodeURIComponent(name)}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Fetch a card by fuzzy name match */
export async function getCardByFuzzyName(name: string): Promise<ScryfallCard | null> {
  try {
    const res = await rateLimitedFetch(
      `${SCRYFALL_BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Autocomplete suggestions for a partial card name */
export async function autocompleteCardName(query: string): Promise<string[]> {
  if (query.length < 2) return [];
  try {
    const res = await rateLimitedFetch(
      `${SCRYFALL_BASE}/cards/autocomplete?q=${encodeURIComponent(query)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

/** Fetch a card by its Scryfall ID */
export async function getCardById(id: string): Promise<ScryfallCard | null> {
  try {
    const res = await rateLimitedFetch(`${SCRYFALL_BASE}/cards/${id}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Batch fetch multiple cards by name using Scryfall's /cards/collection endpoint.
 * Returns a map of name -> ScryfallCard (or error entry).
 */
export async function getCardsBatch(
  names: string[]
): Promise<{ found: ScryfallCard[]; notFound: string[] }> {
  const found: ScryfallCard[] = [];
  const notFound: string[] = [];

  // Scryfall collection endpoint accepts up to 75 items per request
  const chunkSize = 75;
  for (let i = 0; i < names.length; i += chunkSize) {
    const chunk = names.slice(i, i + chunkSize);
    // For double-faced cards Scryfall's /cards/collection endpoint finds them
    // reliably only by their front-face name; the full "X // Y" form can fail.
    const identifiers = chunk.map((name) => ({
      name: name.includes('//') ? name.split('//')[0].trim() : name,
    }));
    try {
      const res = await fetch(`${SCRYFALL_BASE}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers }),
      });
      if (!res.ok) {
        notFound.push(...chunk);
        continue;
      }
      const data = await res.json();
      found.push(...(data.data ?? []));
      if (data.not_found) {
        notFound.push(...data.not_found.map((x: { name: string }) => x.name));
      }
    } catch {
      notFound.push(...chunk);
    }
    // Rate limit between chunks
    if (i + chunkSize < names.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return { found, notFound };
}

/** Get the large front image URL from a Scryfall card */
export function getFrontImageUrl(card: ScryfallCard): string {
  if (card.image_uris?.large) return card.image_uris.large;
  if (card.card_faces?.[0]?.image_uris?.large) return card.card_faces[0].image_uris.large;
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
  return '';
}

/** Get the large back image URL from a Scryfall card (for DFCs) */
export function getBackImageUrl(card: ScryfallCard): string | null {
  if (card.card_faces?.[1]?.image_uris?.large) return card.card_faces[1].image_uris.large;
  if (card.card_faces?.[1]?.image_uris?.normal) return card.card_faces[1].image_uris.normal;
  return null;
}

/** Standard MTG card back URL */
export const MTG_CARD_BACK =
  'https://i.imgur.com/Hg8CwwU.jpeg';

/** Returns true if the card is a double-faced card (has its own back art) */
export function isDoubleFaced(card: ScryfallCard): boolean {
  return ['transform', 'modal_dfc', 'double_faced_token', 'reversible_card', 'meld'].includes(
    card.layout
  );
}

/** Returns true if the card is a token */
export function isToken(card: ScryfallCard): boolean {
  return ['token', 'double_faced_token', 'emblem'].includes(card.layout);
}

/** Get the display name of a card (handles split/transform names) */
export function getDisplayName(card: ScryfallCard): string {
  return card.name;
}

/** Get the small thumbnail image URL */
export function getThumbnailUrl(card: ScryfallCard): string {
  if (card.image_uris?.small) return card.image_uris.small;
  if (card.card_faces?.[0]?.image_uris?.small) return card.card_faces[0].image_uris.small;
  if (card.image_uris?.normal) return card.image_uris.normal;
  return '';
}

/** Determine card type category for UI grouping */
export function getCardCategory(card: ScryfallCard): CardCategory {
  const type = card.type_line?.toLowerCase() ?? '';
  if (type.includes('commander') || type.includes('legendary creature')) return 'Creature';
  if (type.includes('creature')) return 'Creature';
  if (type.includes('instant')) return 'Instant';
  if (type.includes('sorcery')) return 'Sorcery';
  if (type.includes('enchantment')) return 'Enchantment';
  if (type.includes('artifact')) return 'Artifact';
  if (type.includes('planeswalker')) return 'Planeswalker';
  if (type.includes('battle')) return 'Battle';
  if (type.includes('land')) return 'Land';
  return 'Other';
}

export type CardCategory =
  | 'Creature'
  | 'Instant'
  | 'Sorcery'
  | 'Enchantment'
  | 'Artifact'
  | 'Planeswalker'
  | 'Battle'
  | 'Land'
  | 'Other';

export const CATEGORY_ORDER: CardCategory[] = [
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Land',
  'Other',
];

// --- Commander Bracket Game Changers (CFP Official list + high power staples) ---
export const GAME_CHANGERS_LIST = new Set<string>([
  "ad nauseam",
  "ancient tomb",
  "aura shards",
  "biorhythm",
  "bolas's citadel",
  "braids, cabal minion",
  "chrome mox",
  "coalition victory",
  "consecrated sphinx",
  "crop rotation",
  "cyclonic rift",
  "deflecting swat",
  "demonic tutor",
  "dockside extortionist",
  "drannith magistrate",
  "enlightened tutor",
  "expropriate",
  "farewell",
  "field of the dead",
  "fierce guardianship",
  "food chain",
  "force of will",
  "gaea's cradle",
  "gamble",
  "gifts ungiven",
  "glacial chasm",
  "grand arbiter augustin iv",
  "grim monolith",
  "humility",
  "imperial seal",
  "intuition",
  "jeska's will",
  "jeweled lotus",
  "jin-gitaxias, core augur",
  "lion's eye diamond",
  "mana crypt",
  "mana vault",
  "mishra's workshop",
  "mox diamond",
  "mystical tutor",
  "narset, parter of veils",
  "natural order",
  "necropotence",
  "notion thief",
  "opposition agent",
  "orcish bowmasters",
  "panoptic mirror",
  "rhystic study",
  "seedborn muse",
  "serra's sanctum",
  "smothering tithe",
  "survival of the fittest",
  "sway of the stars",
  "teferi's protection",
  "tergrid, god of fright",
  "thassa's oracle",
  "the one ring",
  "the tabernacle at pendrell vale",
  "underworld breach",
  "urza, lord high artificer",
  "vampiric tutor",
  "worldly tutor"
]);

/** Checks if a card is an official Game Changer */
export function isGameChangerCard(cardName: string): boolean {
  if (!cardName) return false;
  const normalized = cardName.toLowerCase().trim();
  
  // Exact match
  if (GAME_CHANGERS_LIST.has(normalized)) return true;
  
  // Double faced cards (e.g., Tergrid, God of Fright // Tergrid's Lantern)
  if (normalized.includes('//')) {
    const parts = normalized.split('//').map((p) => p.trim());
    return parts.some((part) => GAME_CHANGERS_LIST.has(part));
  }
  
  // Fuzzy match where list name is prefix of cardName or cardName is prefix of list name
  for (const gc of GAME_CHANGERS_LIST) {
    if (normalized.startsWith(gc) || gc.startsWith(normalized)) {
      return true;
    }
  }
  
  return false;
}

/** Search cards on Scryfall using their powerful query syntax */
export async function searchCards(
  query: string,
  page: number = 1
): Promise<{ data: ScryfallCard[]; has_more: boolean; next_page?: string; total_cards?: number } | null> {
  if (!query.trim()) return null;
  try {
    const res = await rateLimitedFetch(
      `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(query)}&page=${page}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Get Scryfall's official vector SVG mana symbol URL */
export function getManaSymbolUrl(symbol: string): string {
  // Scryfall symbol format is e.g. "W", "U", "B", "R", "G", "C", "X", "0", "1", etc.
  // We remove brackets and handle split symbols like "W/U" or hybrid/phyrexian "G/P" correctly.
  const clean = symbol.replace(/[{}]/g, '').toUpperCase();
  // Double-slashes or specific characters must be URL-encoded, but Scryfall symbol SVGs 
  // directly match standard names like "W", "U", "B", "R", "G" or "10", "X", "W-U" (usually represented as WU or W-U)
  const formatted = clean.replace('/', '');
  return `https://svgs.scryfall.io/card-symbols/${formatted}.svg`;
}

