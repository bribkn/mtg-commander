/**
 * Moxfield deck import
 *
 * Moxfield has a public API at https://api2.moxfield.com/v3/decks/all/{deckId}
 * The deck ID is extracted from URLs like:
 *   https://www.moxfield.com/decks/abc123
 */

import type { SavedDeck } from './deck-store';
import { getCardsBatch, getCardsBatchByIds, isToken } from './scryfall';

export interface ParsedDeckEntry {
  name: string;
  quantity: number;
  isCommander?: boolean;
  artUrl?: string;
}

/** Extract deck ID from a Moxfield URL */
function extractMoxfieldId(url: string): string | null {
  const match = url.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/** Import a deck from Moxfield via Next.js server proxy (bypasses CORS restrictions) */
export async function importFromMoxfield(url: string): Promise<ParsedDeckEntry[]> {
  const deckId = extractMoxfieldId(url);
  if (!deckId) throw new Error('Invalid Moxfield URL. Expected: https://www.moxfield.com/decks/...');

  const apiUrl = `/api/import?source=moxfield&id=${deckId}`;
  const res = await fetch(apiUrl);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Moxfield deck (${res.status}). The deck may be private or the URL is incorrect.`
    );
  }

  const data = await res.json();
  const entries: ParsedDeckEntry[] = [];

  // Track commander names to avoid double-adding them from mainboard
  const commanderNames = new Set<string>();
  const normalize = (n: string) => n.split('//')[0].trim().toLowerCase();

  // Moxfield v3 format:
  // - data.main = the commander (single card object with .name)
  // - data.boards.commanders.cards = commanders board (handles partners/multiple)
  // - data.boards.mainboard.cards = the 99 (or 98 for partners)

  // 1. Try data.boards.commanders first (handles partners)
  if (data.boards?.commanders?.cards && Object.keys(data.boards.commanders.cards).length > 0) {
    for (const [, entry] of Object.entries(
      data.boards.commanders.cards as Record<string, { quantity: number; card: { name: string } }>
    )) {
      commanderNames.add(normalize(entry.card.name));
      entries.push({
        name: entry.card.name,
        quantity: entry.quantity,
        isCommander: true,
      });
    }
  } else if (data.main?.name) {
    // Fall back to data.main for single commanders
    commanderNames.add(normalize(data.main.name));
    entries.push({
      name: data.main.name,
      quantity: 1,
      isCommander: true,
    });
  }

  // 2. Main deck (exclude any cards already identified as commander)
  if (data.boards?.mainboard?.cards) {
    for (const [, entry] of Object.entries(
      data.boards.mainboard.cards as Record<string, { quantity: number; card: { name: string } }>
    )) {
      const cardName: string = entry.card.name;
      if (commanderNames.has(normalize(cardName))) continue; // skip if already added as commander
      entries.push({
        name: cardName,
        quantity: entry.quantity,
        isCommander: false,
      });
    }
  }

  if (entries.length === 0) {
    throw new Error('No cards found in this deck. The deck may be empty or the format has changed.');
  }

  return entries;
}

// ─── Archidekt ───────────────────────────────────────────────────────────────

/** Extract deck ID from an Archidekt URL */
function extractArchidektId(url: string): string | null {
  const match = url.match(/archidekt\.com\/decks\/(\d+)/);
  return match ? match[1] : null;
}

/** Import a deck from Archidekt via Next.js server proxy (bypasses CORS restrictions) */
export async function importFromArchidekt(url: string): Promise<ParsedDeckEntry[]> {
  const deckId = extractArchidektId(url);
  if (!deckId) throw new Error('Invalid Archidekt URL. Expected: https://archidekt.com/decks/...');

  const apiUrl = `/api/import?source=archidekt&id=${deckId}`;
  const res = await fetch(apiUrl);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Archidekt deck (${res.status}). The deck may be private.`
    );
  }

  const data = await res.json();
  const entries: ParsedDeckEntry[] = [];

  if (data.cards) {
    for (const card of data.cards) {
      const isArchidektCommander = card.categories?.some((cat: string) => cat.toLowerCase().includes('commander')) ?? false;
      entries.push({
        name: card.card?.oracleCard?.name ?? card.card?.name ?? 'Unknown',
        quantity: card.quantity ?? 1,
        isCommander: isArchidektCommander,
      });
    }
  }

  if (entries.length === 0) {
    throw new Error('No cards found in this Archidekt deck.');
  }

  return entries;
}

// ─── Bulk Text Parser ─────────────────────────────────────────────────────────

/**
 * Parse bulk text in common MTG formats:
 *   1 Sol Ring
 *   1x Sol Ring
 *   Sol Ring x1
 *   Sol Ring (4 lines = 4 copies implied)
 *
 * Also handles MTGO/Arena format with set codes:
 *   1 Sol Ring (NEO) 278
 */
export function parseBulkText(text: string): ParsedDeckEntry[] {
  // 1. Split text into blocks by one or more blank lines
  const rawBlocks = text.split(/\r?\n\s*\r?\n/);
 
  // 2. Parse each block's lines
  const blocks = rawBlocks
    .map((block) => {
      return block
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('#'));
    })
    .filter((block) => block.length > 0);
 
  if (blocks.length === 0) return [];
 
  // 3. Detect commander blocks using headers or heuristics
  const blockIsCommander = new Array(blocks.length).fill(false);
  const cleanBlocks: Array<string[]> = [];
 
  for (let b = 0; b < blocks.length; b++) {
    const lines = blocks[b];
    let hasHeader = false;
    const filteredLines: string[] = [];
 
    for (const line of lines) {
      // Check for explicit commander section header line
      if (/^(Commander|Commanders|Comandante|Comandantes|Lider|Lideres|Líder|Líderes):?\s*$/i.test(line)) {
        hasHeader = true;
        continue;
      }
      filteredLines.push(line);
    }
 
    if (hasHeader) {
      blockIsCommander[b] = true;
    }
    cleanBlocks.push(filteredLines);
  }
 
  // 4. If no explicit commander headers were found, apply heuristics for blank-line separated blocks
  const anyExplicitCommander = blockIsCommander.some((x) => x);
  if (!anyExplicitCommander && cleanBlocks.length >= 2) {
    const lengths = cleanBlocks.map((b) => b.length);
 
    // Heuristic 1: 2 blocks (e.g. Mainboard [N > 5] and Commander [N <= 2] at the end, or vice-versa)
    if (cleanBlocks.length === 2) {
      if (lengths[0] <= 2 && lengths[1] > 5) {
        blockIsCommander[0] = true;
      } else if (lengths[1] <= 2 && lengths[0] > 5) {
        blockIsCommander[1] = true;
      }
    }
    // Heuristic 2: 3 blocks (e.g. Commander [N <= 2], Mainboard [N > 10], Sideboard/Companion [N > 2])
    else if (cleanBlocks.length === 3) {
      if (lengths[0] <= 2 && lengths[1] > 10) {
        blockIsCommander[0] = true;
      } else if (lengths[2] <= 2 && lengths[1] > 10) {
        blockIsCommander[2] = true;
      }
    }
  }
 
  // 5. Parse entries from all blocks
  const entries: ParsedDeckEntry[] = [];
 
  for (let b = 0; b < cleanBlocks.length; b++) {
    const lines = cleanBlocks[b];
    const isCommanderBlock = blockIsCommander[b];
 
    for (const line of lines) {
      let qty = 1;
      let name = line;
 
      // Parse quantity prefix: "1 Sol Ring" or "1x Sol Ring"
      const qtyPrefixMatch = line.match(/^(\d+)x?\s+(.+)/i);
      if (qtyPrefixMatch) {
        qty = parseInt(qtyPrefixMatch[1], 10);
        name = qtyPrefixMatch[2];
      } else {
        // Parse quantity suffix: "Sol Ring x1"
        const qtySuffixMatch = line.match(/^(.+)\s+x(\d+)$/i);
        if (qtySuffixMatch) {
          name = qtySuffixMatch[1];
          qty = parseInt(qtySuffixMatch[2], 10);
        }
      }
 
      // Strip set codes: "Sol Ring (NEO) 278"
      name = name.replace(/\s*\([A-Z0-9]+\)\s*\d*\s*$/, '').trim();
      // Strip foil markers: "Sol Ring *F*"
      name = name.replace(/\s*\*[A-Z]+\*\s*$/, '').trim();
 
      if (!name) continue;
 
      entries.push({
        name,
        quantity: qty,
        isCommander: isCommanderBlock,
      });
    }
  }
 
  return entries;
}

/** Detect if a URL is from a supported import source */
export function detectImportSource(url: string): 'moxfield' | 'archidekt' | 'unknown' {
  if (url.includes('moxfield.com')) return 'moxfield';
  if (url.includes('archidekt.com')) return 'archidekt';
  return 'unknown';
}

export interface ParsedTTSImport {
  cards: ParsedDeckEntry[];
  tokens: ParsedDeckEntry[];
  sidedeck: ParsedDeckEntry[];
}

/** Parse Tabletop Simulator JSON deck files recursively */
export function parseTTSJson(jsonText: string): ParsedTTSImport {
  try {
    const parsed = JSON.parse(jsonText);

    /**
     * Count cards in a single TTS object (pile/deck).
     * Returns a map of { cardName\nartUrl → count } for that pile only.
     */
    function countCardsInPile(obj: any): Record<string, { quantity: number; artUrl?: string }> {
      const counts: Record<string, { quantity: number; artUrl?: string }> = {};

      function traverse(node: any) {
        if (!node || typeof node !== 'object') return;

        // Leaf card node
        if (node.Name === 'Card' && typeof node.Nickname === 'string') {
          const fullName = node.Nickname.trim();
          let name = fullName.split('\n')[0].trim();
          if (name) {
            // Normalize/clean card name (strip set codes, quantity prefixes, and foil markers)
            const qtyPrefixMatch = name.match(/^(\d+)x?\s+(.+)/i);
            if (qtyPrefixMatch) {
              name = qtyPrefixMatch[2];
            }
            name = name.replace(/\s*\([A-Z0-9]+\)\s*\d*\s*$/, '').trim();
            name = name.replace(/\s*\[[A-Z0-9]+\]\s*\d*\s*$/, '').trim();
            name = name.replace(/\s*\*[^*]+\*\s*$/, '').trim();

            let artUrl: string | undefined = undefined;
            if (typeof node.CardID === 'number' && obj.CustomDeck) {
              const deckId = Math.floor(node.CardID / 100);
              artUrl = obj.CustomDeck[String(deckId)]?.FaceURL;
            }

            const key = artUrl ? `${name}\n${artUrl}` : name;
            if (counts[key]) {
              counts[key].quantity += 1;
            } else {
              counts[key] = { quantity: 1, artUrl };
            }
          }
          return;
        }

        for (const key in node) {
          if (Object.prototype.hasOwnProperty.call(node, key)) {
            traverse(node[key]);
          }
        }
      }

      traverse(obj);
      return counts;
    }

    const mainCounts: Record<string, { quantity: number; artUrl?: string }> = {};
    const tokenCounts: Record<string, { quantity: number; artUrl?: string }> = {};
    const sideCounts: Record<string, { quantity: number; artUrl?: string }> = {};

    if (parsed && Array.isArray(parsed.ObjectStates)) {
      for (const subDeck of parsed.ObjectStates) {
        const posX = subDeck.Transform?.posX ?? 0;
        const pileCounts = countCardsInPile(subDeck);

        if (Math.abs(posX - 2.2) < 0.1) {
          // Token pile
          for (const [key, item] of Object.entries(pileCounts)) {
            const existing = tokenCounts[key];
            if (existing) {
              existing.quantity = Math.max(existing.quantity, item.quantity);
            } else {
              tokenCounts[key] = { ...item };
            }
          }
        } else if (Math.abs(posX + 2.2) < 0.1) {
          // Sidedeck pile
          for (const [key, item] of Object.entries(pileCounts)) {
            const existing = sideCounts[key];
            if (existing) {
              existing.quantity = Math.max(existing.quantity, item.quantity);
            } else {
              sideCounts[key] = { ...item };
            }
          }
        } else if (Math.abs(posX - 4.4) < 0.1) {
          // DFC helper pile — ignore this pile completely on import to prevent double-adding cards
          continue;
        } else {
          // Main deck pile
          for (const [key, item] of Object.entries(pileCounts)) {
            const existing = mainCounts[key];
            if (existing) {
              existing.quantity = Math.max(existing.quantity, item.quantity);
            } else {
              mainCounts[key] = { ...item };
            }
          }
        }
      }
    } else {
      // Flat file — just count everything into main
      const counts = countCardsInPile(parsed);
      for (const [key, item] of Object.entries(counts)) {
        mainCounts[key] = { ...item };
      }
    }

    const mapToEntries = (countsMap: Record<string, { quantity: number; artUrl?: string }>) => {
      return Object.entries(countsMap).map(([key, item]) => {
        const parts = key.split('\n');
        const name = parts[0];
        return {
          name,
          quantity: item.quantity,
          isCommander: false,
          artUrl: item.artUrl,
        };
      });
    };

    const cards = mapToEntries(mainCounts);
    const tokens = mapToEntries(tokenCounts);
    const sidedeck = mapToEntries(sideCounts);

    return { cards, tokens, sidedeck };
  } catch (err) {
    throw new Error('Invalid JSON format. Please upload a valid Tabletop Simulator deck file.');
  }
}

/**
 * Extract a Scryfall UUID from a Scryfall CDN URL.
 * e.g. https://cards.scryfall.io/large/front/7/b/7b0d67b1-...jpg?t → "7b0d67b1-..."
 */
function extractScryfallUUID(url: string): string | null {
  const m = url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jpg/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Helper to enrich a list of ParsedDeckEntry items with Scryfall data.
 */
async function enrichCardEntries(entries: any[]): Promise<any[]> {
  const cards: any[] = [];
  const uuidEntries: Array<{ index: number; uuid: string }> = [];
  const nameEntries: Array<{ index: number; name: string }> = [];
  const uniqueUUIDs = new Set<string>();
  const uniqueNames = new Set<string>();

  for (const entryCard of entries) {
    const name = entryCard.name;
    const artUrl = entryCard.artUrl ?? '';
    const isCommander = entryCard.isCommander ?? false;
    const uuid = artUrl.includes('scryfall.io') ? extractScryfallUUID(artUrl) : null;

    const cardObj = {
      scryfallId: uuid ?? name,
      name,
      quantity: entryCard.quantity,
      scryfallData: {} as any,
      category: 'Creature' as any,
      isCommander: !!isCommander,
      imageUrl: '',
      _artUrl: artUrl || undefined, // preserve for post-enrichment override
    };
    cards.push(cardObj);

    const idx = cards.length - 1;
    if (uuid) {
      uuidEntries.push({ index: idx, uuid });
      uniqueUUIDs.add(uuid);
    } else {
      nameEntries.push({ index: idx, name });
      uniqueNames.add(name);
    }
  }

  // 1. Fetch by Scryfall UUID (exact match)
  if (uniqueUUIDs.size > 0) {
    const byId = await getCardsBatchByIds(Array.from(uniqueUUIDs));
    const idMap = new Map<string, any>(byId.map((c: any) => [c.id.toLowerCase(), c]));
    for (const { index, uuid } of uuidEntries) {
      const scry = idMap.get(uuid);
      if (scry) {
        // Verify name matches (case-insensitive) to prevent mismatches on shared sheet URLs
        const importedNameNorm = cards[index].name.toLowerCase().trim().split('//')[0].trim();
        const scryfallNameNorm = scry.name.toLowerCase().trim().split('//')[0].trim();
        if (importedNameNorm === scryfallNameNorm) {
          cards[index].scryfallId = scry.id;
          cards[index].scryfallData = scry;
          cards[index].imageUrl =
            scry.image_uris?.png ??
            scry.image_uris?.large ??
            scry.card_faces?.[0]?.image_uris?.png ??
            scry.card_faces?.[0]?.image_uris?.large ??
            '';
          continue;
        }
      }
      // UUID not found or name mismatched — fall back to name lookup
      uniqueNames.add(cards[index].name);
      nameEntries.push({ index, name: cards[index].name });
    }
  }

  // 2. Fetch remaining cards by name
  if (uniqueNames.size > 0) {
    const { found } = await getCardsBatch(Array.from(uniqueNames));
    const nameMap = new Map<string, any>();
    for (const c of found) {
      nameMap.set(c.name.toLowerCase(), c);
      if (c.name.includes('//')) {
        nameMap.set(c.name.split('//')[0].trim().toLowerCase(), c);
      }
    }
    for (const { index, name } of nameEntries) {
      if (cards[index].scryfallData && cards[index].scryfallData.id) continue;
      const scry = nameMap.get(name.toLowerCase()) ?? nameMap.get(name.split('//')[0].trim().toLowerCase());
      if (scry) {
        cards[index].scryfallId = scry.id;
        cards[index].scryfallData = scry;
        cards[index].imageUrl =
          scry.image_uris?.png ??
          scry.image_uris?.large ??
          scry.card_faces?.[0]?.image_uris?.png ??
          scry.card_faces?.[0]?.image_uris?.large ??
          '';
      }
    }
  }

  // Populate categories correctly
  const { getCardCategory } = require('./scryfall');
  for (const card of cards) {
    if (card.scryfallData && card.scryfallData.id) {
      card.category = getCardCategory(card.scryfallData);
    }
  }

  // Apply non-Scryfall artUrls as image overrides.
  // When a TTS file stores a custom/alternate art URL that isn't from scryfall.io,
  // we overlay it onto the card's image_uris so the art is preserved after re-import.
  for (const card of cards) {
    const altUrl: string | undefined = card._artUrl;
    if (!altUrl || altUrl.includes('scryfall.io')) continue; // Scryfall URLs are already handled
    if (!card.scryfallData || !card.scryfallData.id) continue; // unresolved card — skip

    // Apply the alt URL as an image override across all size variants
    card.scryfallData = {
      ...card.scryfallData,
      image_uris: {
        ...card.scryfallData.image_uris,
        small: altUrl,
        normal: altUrl,
        large: altUrl,
        png: altUrl,
        art_crop: altUrl,
      },
      card_faces: card.scryfallData.card_faces?.map((face: any, i: number) =>
        i === 0
          ? {
              ...face,
              image_uris: {
                ...face.image_uris,
                small: altUrl,
                normal: altUrl,
                large: altUrl,
                png: altUrl,
                art_crop: altUrl,
              },
            }
          : face
      ),
    };
    card.imageUrl = altUrl;
    delete card._artUrl;
  }

  return cards;
}

/**
 * Parse a legacy TTS JSON deck file and enrich it with Scryfall data.
 * Returns a fully-formed SavedDeck ready for the UI.
 */
export async function parseLegacyTTSFile(jsonText: string, baseName: string): Promise<SavedDeck> {
  const importResult = parseTTSJson(jsonText);

  // Enrich each section
  let cards = await enrichCardEntries(importResult.cards);
  const tokens = await enrichCardEntries(importResult.tokens);
  const sidedeck = await enrichCardEntries(importResult.sidedeck);

  // Filter out resolved tokens from the mainboard cards list
  cards = cards.filter((c) => {
    if (c.scryfallData && c.scryfallData.id) {
      return !isToken(c.scryfallData);
    }
    return true;
  });

  // Resolve commander scryfallId
  const cmdCard = cards.find((c) => c.isCommander);
  let commanderId = cmdCard ? cmdCard.scryfallId : null;
  if (!commanderId && cards.length) {
    commanderId = cards[cards.length - 1].scryfallId;
    cards[cards.length - 1].isCommander = true;
  }

  return {
    id: baseName,
    deckName: baseName,
    cards,
    tokens,
    sidedeck,
    isSideDeckEnabled: sidedeck.length > 0,
    commanderId,
    coverCardId: commanderId,
  } as SavedDeck;
}

/**
 * Validates and repairs any SavedDeck that has incomplete or empty scryfallData.
 * Automatically fetches the missing details from Scryfall to heal the deck.
 */
export async function ensureDeckEnriched(deck: SavedDeck): Promise<SavedDeck> {
  // Helper: a card is a "land" if its type_line (or first face) includes "land"
  const isLandCard = (card: any): boolean => {
    const typeLine: string =
      card.scryfallData?.type_line ??
      card.scryfallData?.card_faces?.[0]?.type_line ??
      '';
    return typeLine.toLowerCase().includes('land');
  };

  const deduplicateSection = (section?: any[]): any[] => {
    if (!section) return [];
    const map = new Map<string, any>();
    for (const card of section) {
      const key = card.scryfallId || card.name;
      const existing = map.get(key);
      if (existing) {
        if (card.isCommander || existing.isCommander) {
          existing.isCommander = true;
          existing.quantity = card.isCommander ? card.quantity : existing.quantity;
        } else if (isLandCard(existing)) {
          // Lands can stack (basic lands can have multiple copies)
          existing.quantity += card.quantity;
        } else {
          // Non-land cards: cap at 1 (Commander singleton rule)
          existing.quantity = 1;
        }
      } else {
        map.set(key, card);
      }
    }
    // Also enforce qty=1 for non-land, non-commander cards in case the source had wrong quantities
    return Array.from(map.values()).map((card) => ({
      ...card,
      quantity: card.isCommander || isLandCard(card) ? card.quantity : 1,
    }));
  };

  deck.cards = deduplicateSection(deck.cards);
  if (deck.sidedeck) deck.sidedeck = deduplicateSection(deck.sidedeck);
  if (deck.tokens) deck.tokens = deduplicateSection(deck.tokens);

  const cardsToFetch: Array<{ name: string }> = [];

  const isIncomplete = (card: any) => {
    return (
      !card.scryfallData ||
      !card.scryfallData.id ||
      (!card.scryfallData.image_uris && !card.scryfallData.card_faces)
    );
  };

  const checkSection = (section?: any[]) => {
    if (!section) return;
    for (const card of section) {
      if (isIncomplete(card)) {
        cardsToFetch.push({ name: card.name });
      }
    }
  };

  checkSection(deck.cards);
  checkSection(deck.sidedeck);
  checkSection(deck.tokens);

  if (cardsToFetch.length === 0) {
    return deck;
  }

  console.log(`Self-healing deck "${deck.deckName}": enriching ${cardsToFetch.length} incomplete cards...`);

  const uniqueNames = Array.from(new Set(cardsToFetch.map((c) => c.name)));
  if (uniqueNames.length > 0) {
    const { found } = await getCardsBatch(uniqueNames);
    const nameMap = new Map<string, any>();
    for (const c of found) {
      nameMap.set(c.name.toLowerCase(), c);
      if (c.name.includes('//')) {
        nameMap.set(c.name.split('//')[0].trim().toLowerCase(), c);
      }
    }

    const enrichCard = (card: any) => {
      if (!isIncomplete(card)) return;
      const scry = nameMap.get(card.name.toLowerCase()) ?? nameMap.get(card.name.split('//')[0].trim().toLowerCase());
      if (scry) {
        card.scryfallId = scry.id;
        card.scryfallData = scry;
        // Reset category to correct Scryfall-determined value if needed
        const { getCardCategory } = require('./scryfall');
        card.category = getCardCategory(scry);
      }
    };

    deck.cards.forEach(enrichCard);
    if (deck.sidedeck) deck.sidedeck.forEach(enrichCard);
    if (deck.tokens) deck.tokens.forEach(enrichCard);
  }

  // Update commanderId / coverCardId to actual Scryfall IDs if they were names
  if (deck.commanderId) {
    const cmdCard = deck.cards.find((c) => c.name === deck.commanderId || c.scryfallId === deck.commanderId);
    if (cmdCard && cmdCard.scryfallData?.id) {
      deck.commanderId = cmdCard.scryfallData.id;
    }
  }
  if (deck.coverCardId) {
    const coverCard = deck.cards.find((c) => c.name === deck.coverCardId || c.scryfallId === deck.coverCardId);
    if (coverCard && coverCard.scryfallData?.id) {
      deck.coverCardId = coverCard.scryfallData.id;
    }
  }

  return deck;
}
