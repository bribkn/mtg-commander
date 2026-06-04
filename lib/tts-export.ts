import {
  ScryfallCard,
  ScryfallRelatedCard,
  getFrontImageUrl,
  getBackImageUrl,
  isDoubleFaced,
  isToken,
  MTG_CARD_BACK,
  getCardById,
} from './scryfall';
import { DeckCard } from './deck-store';

// ─── TTS Types ───────────────────────────────────────────────────────────────

interface TTSTransform {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

interface TTSCard {
  CardID: number;
  Name: 'Card';
  Nickname: string;
  Description?: string;
  Transform: TTSTransform;
}

interface TTSCustomDeckEntry {
  FaceURL: string;
  BackURL: string;
  NumHeight: 1;
  NumWidth: 1;
  BackIsHidden: true;
}

interface TTSDeck {
  Name: 'DeckCustom' | 'Card';
  ContainedObjects?: TTSCard[];
  DeckIDs?: number[];
  CustomDeck: Record<string, TTSCustomDeckEntry>;
  Transform: TTSTransform;
  CardID?: number;
  Nickname?: string;
  Description?: string;
}

interface TTSObject {
  ObjectStates: TTSDeck[];
}

// ─── Transform Templates ─────────────────────────────────────────────────────

const CARD_TRANSFORM: TTSTransform = {
  posX: 0,
  posY: 0,
  posZ: 0,
  rotX: 0,
  rotY: 180,
  rotZ: 180,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
};

function deckTransform(posX: number, rotZ: number = 180): TTSTransform {
  return {
    posX,
    posY: 1,
    posZ: 0,
    rotX: 0,
    rotY: 180,
    rotZ,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

// ─── Description & Nickname Builders ─────────────────────────────────────────

export function getCardNicknameAndDescription(card: ScryfallCard): { nickname: string; description: string } {
  // Nickname format: Card Name \n Type Line [cmc]CMC
  const nickname = `${card.name}\n${card.type_line || ''} ${card.cmc ?? 0}CMC`;

  if (card.card_faces && card.card_faces.length > 0) {
    const faceDescriptions = card.card_faces.map((face) => {
      let text = face.oracle_text || '';
      const pt = face.power && face.toughness ? `[b]${face.power}/${face.toughness}[/b]` : '';
      const loyalty = face.loyalty ? `[b]Loyalty: ${face.loyalty}[/b]` : '';
      const defense = face.defense ? `[b]Defense: ${face.defense}[/b]` : '';
      const extra = [pt, loyalty, defense].filter(Boolean).join('\n');
      return `${face.name}:\n${text}${extra ? '\n' + extra : ''}`;
    });
    return {
      nickname,
      description: faceDescriptions.join('\n\n'),
    };
  } else {
    let description = card.oracle_text || '';
    const pt = card.power && card.toughness ? `[b]${card.power}/${card.toughness}[/b]` : '';
    const loyalty = card.loyalty ? `[b]Loyalty: ${card.loyalty}[/b]` : '';
    const defense = card.defense ? `[b]Defense: ${card.defense}[/b]` : '';
    const extra = [pt, loyalty, defense].filter(Boolean).join('\n');
    if (extra) {
      description = description ? `${description}\n${extra}` : extra;
    }
    return { nickname, description };
  }
}

// ─── Sub-deck Builder ────────────────────────────────────────────────────────

interface SubDeckCard {
  name: string;
  faceUrl: string;
  backUrl: string;
  nickname?: string;
  description?: string;
}

function buildSubDeck(cards: SubDeckCard[], posX: number, rotZ: number): TTSDeck {
  if (cards.length === 1) {
    const { name, faceUrl, backUrl, nickname, description } = cards[0];
    return {
      Name: 'Card',
      CardID: 100,
      Nickname: nickname || name,
      Description: description || '',
      Transform: deckTransform(posX, rotZ),
      CustomDeck: {
        '1': {
          FaceURL: faceUrl,
          BackURL: backUrl,
          NumHeight: 1,
          NumWidth: 1,
          BackIsHidden: true,
        },
      },
    };
  }

  // Build a deduplicated CustomDeck: cards with the same faceUrl share an entry
  const faceUrlToKey = new Map<string, number>();
  const customDeck: Record<string, TTSCustomDeckEntry> = {};
  let nextKey = 1;

  const containedObjects: TTSCard[] = [];
  const deckIDs: number[] = [];

  for (let i = 0; i < cards.length; i++) {
    const { name, faceUrl, backUrl, nickname, description } = cards[i];

    // Check if this exact faceUrl already has a key (for basic lands)
    let key = faceUrlToKey.get(faceUrl);
    if (key === undefined) {
      key = nextKey++;
      faceUrlToKey.set(faceUrl, key);
      customDeck[String(key)] = {
        FaceURL: faceUrl,
        BackURL: backUrl,
        NumHeight: 1,
        NumWidth: 1,
        BackIsHidden: true,
      };
    }

    const cardID = key * 100;

    containedObjects.push({
      CardID: cardID,
      Name: 'Card',
      Nickname: nickname || name,
      Description: description || '',
      Transform: { ...CARD_TRANSFORM },
    });
    deckIDs.push(cardID);
  }

  return {
    Name: 'DeckCustom',
    ContainedObjects: containedObjects,
    DeckIDs: deckIDs,
    CustomDeck: customDeck,
    Transform: deckTransform(posX, rotZ),
  };
}

// ─── Token Fetcher ───────────────────────────────────────────────────────────

export interface TokenCard {
  scryfallCard: ScryfallCard;
  name: string;
  faceUrl: string;
  backUrl: string;
}

/**
 * Collect token references from all_parts and fetch their data.
 * De-duplicates by name.
 */
export async function collectTokens(
  deckCards: DeckCard[]
): Promise<TokenCard[]> {
  const tokenIds = new Set<string>();
  const tokenRelations: ScryfallRelatedCard[] = [];

  for (const dc of deckCards) {
    const parts = dc.scryfallData.all_parts ?? [];
    for (const part of parts) {
      if (part.component === 'token' && !tokenIds.has(part.id)) {
        tokenIds.add(part.id);
        tokenRelations.push(part);
      }
    }
  }

  const tokens: TokenCard[] = [];
  const seenNames = new Set<string>();

  for (const rel of tokenRelations) {
    const card = await getCardById(rel.id);
    if (!card) continue;
    if (seenNames.has(card.name)) continue;
    seenNames.add(card.name);

    const faceUrl = getFrontImageUrl(card);
    if (!faceUrl) continue;

    const backUrl = isDoubleFaced(card) ? (getBackImageUrl(card) ?? MTG_CARD_BACK) : MTG_CARD_BACK;

    tokens.push({ scryfallCard: card, name: card.name, faceUrl, backUrl });
  }

  return tokens;
}

// ─── Main Export Function ────────────────────────────────────────────────────

export interface ExportResult {
  json: string;
  mainDeckCount: number;
  tokenCount: number;
  dfcCount: number;
  sideDeckCount: number;
}

/**
 * Generate a TTS-compatible JSON object from the current deck.
 *
 * Structure:
 *  ObjectStates[0] = main deck (alphabetical, commander last), posX: 0, rotZ: 180
 *  ObjectStates[1] = sidedeck (alphabetical), posX: -2.2, rotZ: 180
 *  ObjectStates[2] = tokens, posX: 2.2, rotZ: 0
 *  ObjectStates[3] = double-faced cards, posX: 4.4, rotZ: 0
 */
export async function generateTTSExport(
  deckCards: DeckCard[],
  customCardbackUrl?: string | null,
  tokens?: DeckCard[],
  sidedeck?: DeckCard[]
): Promise<ExportResult> {
  // 1. Separate commander from the rest
  const commanderCards = deckCards.filter((c) => c.isCommander);
  const regularCards = deckCards.filter((c) => !c.isCommander);
 
  // 2. Expand quantities into individual card entries
  function expandCards(cards: DeckCard[]): DeckCard[] {
    const expanded: DeckCard[] = [];
    for (const c of cards) {
      for (let i = 0; i < c.quantity; i++) {
        expanded.push(c);
      }
    }
    return expanded;
  }
 
  // 3. Sort alphabetically
  const sortedRegular = [...regularCards].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
 
  // 4. Commander goes last
  const allMainExpanded = [
    ...expandCards(sortedRegular),
    ...expandCards(commanderCards),
  ];
 
  // 5. Build main deck cards (including DFCs in the same pile using standard cardback!)
  const mainCards: SubDeckCard[] = [];
  const dfcCards: SubDeckCard[] = [];
  const seenDfcNames = new Set<string>();
  let dfcCount = 0;
 
  for (const dc of allMainExpanded) {
    const card = dc.scryfallData;
    const faceUrl = getFrontImageUrl(card);
    const standardBack = customCardbackUrl || MTG_CARD_BACK;
    const { nickname, description } = getCardNicknameAndDescription(card);
 
    // In the main deck pile, all cards must use the standard cardback
    mainCards.push({ name: card.name, faceUrl, backUrl: standardBack, nickname, description });
 
    if (isDoubleFaced(card)) {
      dfcCount++;
      if (!seenDfcNames.has(card.name)) {
        seenDfcNames.add(card.name);
        const backUrl = getBackImageUrl(card) ?? MTG_CARD_BACK;
        dfcCards.push({ name: card.name, faceUrl, backUrl, nickname, description });
      }
    }
  }

  // 5.5. Build sidedeck cards if any
  const sidedeckCards: SubDeckCard[] = [];
  if (sidedeck && sidedeck.length > 0) {
    const sortedSide = [...sidedeck].sort((a, b) => a.name.localeCompare(b.name));
    const allSideExpanded = expandCards(sortedSide);
    for (const dc of allSideExpanded) {
      const card = dc.scryfallData;
      const faceUrl = getFrontImageUrl(card);
      const standardBack = customCardbackUrl || MTG_CARD_BACK;
      const { nickname, description } = getCardNicknameAndDescription(card);
      sidedeckCards.push({ name: card.name, faceUrl, backUrl: standardBack, nickname, description });

      // Add double faced helper cards if any exist in the sidedeck
      if (isDoubleFaced(card)) {
        dfcCount++;
        if (!seenDfcNames.has(card.name)) {
          seenDfcNames.add(card.name);
          const backUrl = getBackImageUrl(card) ?? MTG_CARD_BACK;
          dfcCards.push({ name: card.name, faceUrl, backUrl, nickname, description });
        }
      }
    }
  }

  // 6. Build tokens
  let tokenCards: SubDeckCard[] = [];
  if (tokens && tokens.length > 0) {
    tokenCards = tokens.map((t) => {
      const card = t.scryfallData;
      const faceUrl = getFrontImageUrl(card);
      const backUrl = isDoubleFaced(card) ? (getBackImageUrl(card) ?? MTG_CARD_BACK) : MTG_CARD_BACK;
      const { nickname, description } = getCardNicknameAndDescription(card);
      return {
        name: card.name,
        faceUrl,
        backUrl,
        nickname,
        description,
      };
    });
  } else {
    const fetchedTokens = await collectTokens(deckCards);
    tokenCards = fetchedTokens.map((t) => {
      const card = t.scryfallCard;
      const faceUrl = t.faceUrl;
      const backUrl = t.backUrl;
      const { nickname, description } = getCardNicknameAndDescription(card);
      return {
        name: card.name,
        faceUrl,
        backUrl,
        nickname,
        description,
      };
    });
  }

  // 7. Build the sub-decks
  const objectStates: TTSDeck[] = [];

  if (mainCards.length > 0) {
    objectStates.push(buildSubDeck(mainCards, 0, 180));
  }

  if (sidedeckCards.length > 0) {
    objectStates.push(buildSubDeck(sidedeckCards, -2.2, 180));
  }

  if (tokenCards.length > 0) {
    objectStates.push(buildSubDeck(tokenCards, 2.2, 0));
  }

  if (dfcCards.length > 0) {
    objectStates.push(buildSubDeck(dfcCards, 4.4, 0));
  }

  const ttsObject: TTSObject = { ObjectStates: objectStates };

  return {
    json: JSON.stringify(ttsObject, null, 4),
    mainDeckCount: mainCards.length,
    tokenCount: tokenCards.length,
    dfcCount,
    sideDeckCount: sidedeckCards.length,
  };
}

/** Trigger a file download in the browser */
export function downloadJSON(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
