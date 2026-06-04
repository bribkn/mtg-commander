/**
 * Moxfield deck import
 *
 * Moxfield has a public API at https://api2.moxfield.com/v3/decks/all/{deckId}
 * The deck ID is extracted from URLs like:
 *   https://www.moxfield.com/decks/abc123
 */

export interface ParsedDeckEntry {
  name: string;
  quantity: number;
  isCommander?: boolean;
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
     * Returns a map of { cardName → count } for that pile only.
     */
    function countCardsInPile(obj: any): Record<string, number> {
      const counts: Record<string, number> = {};

      function traverse(node: any) {
        if (!node || typeof node !== 'object') return;

        // Leaf card node
        if (node.Name === 'Card' && typeof node.Nickname === 'string') {
          const fullName = node.Nickname.trim();
          const name = fullName.split('\n')[0].trim();
          if (name) counts[name] = (counts[name] || 0) + 1;
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

    const mainCounts: Record<string, number> = {};
    const tokenCounts: Record<string, number> = {};
    const sideCounts: Record<string, number> = {};

    if (parsed && Array.isArray(parsed.ObjectStates)) {
      for (const subDeck of parsed.ObjectStates) {
        const posX = subDeck.Transform?.posX ?? 0;
        const pileCounts = countCardsInPile(subDeck);

        if (Math.abs(posX - 2.2) < 0.1) {
          // Token pile
          for (const [name, count] of Object.entries(pileCounts)) {
            tokenCounts[name] = Math.max(tokenCounts[name] ?? 0, count);
          }
        } else if (Math.abs(posX + 2.2) < 0.1) {
          // Sidedeck pile
          for (const [name, count] of Object.entries(pileCounts)) {
            sideCounts[name] = Math.max(sideCounts[name] ?? 0, count);
          }
        } else if (Math.abs(posX - 4.4) < 0.1) {
          // DFC helper pile — ignore this pile completely on import to prevent double-adding cards
          continue;
        } else {
          // Main deck pile
          for (const [name, count] of Object.entries(pileCounts)) {
            mainCounts[name] = Math.max(mainCounts[name] ?? 0, count);
          }
        }
      }
    } else {
      // Flat file — just count everything into main
      const counts = countCardsInPile(parsed);
      for (const [name, count] of Object.entries(counts)) {
        mainCounts[name] = count;
      }
    }

    const cards = Object.entries(mainCounts).map(([name, quantity]) => ({
      name,
      quantity,
      isCommander: false,
    }));

    const tokens = Object.entries(tokenCounts).map(([name, quantity]) => ({
      name,
      quantity,
      isCommander: false,
    }));

    const sidedeck = Object.entries(sideCounts).map(([name, quantity]) => ({
      name,
      quantity,
      isCommander: false,
    }));

    return { cards, tokens, sidedeck };
  } catch (err) {
    throw new Error('Invalid JSON format. Please upload a valid Tabletop Simulator deck file.');
  }
}
