import LZString from 'lz-string';
import { SavedDeck, DeckCard } from './deck-store';
import { getCardsBatchByIds, ScryfallCard, getCardCategory } from './scryfall';

// Ultra-compressed JSON payload schema to save maximum URL characters
export interface SharedDeckPayload {
  n: string;                            // deckName
  c: string;                            // cards string: scryfallId,qty,isComm,alterUrl,alterName;scryfallId,qty,isComm...
  cv?: string | null;                   // coverCardId
  cb?: string | null;                   // customCardbackUrl
  w?: number;                           // wins
  l?: number;                           // losses
  t?: string;                           // tags string: tag1,tag2,tag3
}

/**
 * Checks if a card's image is a custom alter (not from Scryfall CDN)
 */
function getCustomAlterDetails(card: DeckCard): { imageUrl?: string; name?: string } {
  const normalUrl = card.scryfallData.image_uris?.normal || card.scryfallData.card_faces?.[0]?.image_uris?.normal || '';
  if (normalUrl && !normalUrl.includes('scryfall.io') && !normalUrl.includes('scryfall.com')) {
    return {
      imageUrl: normalUrl,
      name: card.scryfallData.name !== card.name ? card.name : undefined, // Check if there is a custom alter name
    };
  }
  return {};
}

/**
 * Compresses a SavedDeck into a URL-safe LZ string using a minimum payload layout
 */
export function compressDeck(deck: SavedDeck): string {
  const cardsStr = deck.cards.map((card) => {
    const alter = getCustomAlterDetails(card);
    const fields: string[] = [
      card.scryfallId,
      String(card.quantity),
      card.isCommander ? '1' : '0'
    ];
    if (alter.imageUrl) {
      // Replace commas with encoded counterpart to prevent split issues
      const safeUrl = alter.imageUrl.replace(/,/g, '%2C');
      fields.push(safeUrl);
      if (alter.name) {
        const safeName = alter.name.replace(/,/g, '%2C');
        fields.push(safeName);
      }
    }
    return fields.join(',');
  }).join(';');

  const payload: SharedDeckPayload = {
    n: deck.deckName || 'Shared Commander Deck',
    c: cardsStr,
    cv: deck.coverCardId || null,
    cb: deck.customCardbackUrl || null,
    w: deck.wins || 0,
    l: deck.losses || 0,
    t: deck.tags && deck.tags.length > 0 ? deck.tags.join(',') : undefined,
  };

  const jsonStr = JSON.stringify(payload);
  return LZString.compressToEncodedURIComponent(jsonStr);
}

/**
 * Decompresses an LZ string back into a SharedDeckPayload
 */
export function decompressDeck(compressed: string): SharedDeckPayload | null {
  try {
    const jsonStr = LZString.decompressFromEncodedURIComponent(compressed);
    if (!jsonStr) return null;
    return JSON.parse(jsonStr) as SharedDeckPayload;
  } catch (err) {
    console.error('Failed to decompress shared deck:', err);
    return null;
  }
}

/**
 * Resolves a SharedDeckPayload into a fully populated SavedDeck by fetching Scryfall data
 */
export async function fetchSharedDeckDetails(payload: SharedDeckPayload): Promise<SavedDeck> {
  // Parse card entries from the compact string representation
  const cardEntries = payload.c.split(';').filter(Boolean).map((entry) => {
    const parts = entry.split(',');
    const scryfallId = parts[0];
    const quantity = parseInt(parts[1], 10) || 1;
    const isCommFlag = parseInt(parts[2], 10) || 0;
    const customImageUrl = parts[3] ? parts[3].replace(/%2C/g, ',') : undefined;
    const customName = parts[4] ? parts[4].replace(/%2C/g, ',') : undefined;
    return {
      scryfallId,
      quantity,
      isCommFlag,
      customImageUrl,
      customName
    };
  });

  const ids = cardEntries.map((item) => item.scryfallId);
  
  // 1. Fetch standard Scryfall cards in bulk
  const scryfallCards = await getCardsBatchByIds(ids);
  
  // Create a map for quick access
  const cardMap = new Map<string, ScryfallCard>();
  scryfallCards.forEach((card) => {
    cardMap.set(card.id, card);
  });

  // 2. Reconstruct the SavedDeck
  const resolvedCards: DeckCard[] = [];

  cardEntries.forEach(({ scryfallId, quantity, isCommFlag, customImageUrl, customName }) => {
    const originalCard = cardMap.get(scryfallId);
    if (!originalCard) return; // Skip if card not found in Scryfall

    // Deep clone the ScryfallCard structure so we can safely mutate it with custom alters
    const scryCard = JSON.parse(JSON.stringify(originalCard)) as ScryfallCard;

    // Apply custom alter overrides if present in payload
    if (customImageUrl) {
      if (scryCard.image_uris) {
        scryCard.image_uris = {
          ...scryCard.image_uris,
          small: customImageUrl,
          normal: customImageUrl,
          large: customImageUrl,
          png: customImageUrl,
          art_crop: customImageUrl,
        };
      }
      if (scryCard.card_faces && scryCard.card_faces[0]) {
        scryCard.card_faces[0].image_uris = {
          ...(scryCard.card_faces[0].image_uris || {}),
          small: customImageUrl,
          normal: customImageUrl,
          large: customImageUrl,
          png: customImageUrl,
          art_crop: customImageUrl,
        };
      }
      if (customName) {
        scryCard.name = customName;
      }
    }

    resolvedCards.push({
      scryfallId,
      name: scryCard.name,
      quantity,
      scryfallData: scryCard,
      category: getCardCategory(scryCard),
      isCommander: isCommFlag === 1,
    });
  });

  // Parse tags list
  const resolvedTags = payload.t ? payload.t.split(',').filter(Boolean) : [];

  return {
    id: `shared-deck-${Date.now()}`,
    deckName: payload.n,
    cards: resolvedCards,
    commanderId: payload.cv || resolvedCards.find((c) => c.isCommander)?.scryfallId || null,
    coverCardId: payload.cv || null,
    customCardbackUrl: payload.cb || null,
    wins: payload.w || 0,
    losses: payload.l || 0,
    tags: resolvedTags,
  };
}
