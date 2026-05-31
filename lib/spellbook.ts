import { DeckCard } from './deck-store';

export interface SpellbookCardDetail {
  id: number;
  name: string;
  spoiler: boolean;
  oracleId: string;
  typeLine: string;
  imageUriFrontNormal: string | null;
  imageUriFrontSmall: string | null;
  imageUriFrontLarge: string | null;
}

export interface SpellbookUse {
  card: SpellbookCardDetail;
  quantity: number;
  zoneLocations: string[];
  mustBeCommander: boolean;
}

export interface SpellbookRequire {
  quantity: number;
  template: {
    id: number;
    name: string;
    scryfallQuery?: string;
  };
  zoneLocations: string[];
}

export interface SpellbookProduce {
  feature: {
    id: number;
    name: string;
  };
  quantity: number;
}

export interface SpellbookCombo {
  id: string;
  uses: SpellbookUse[];
  requires: SpellbookRequire[];
  produces: SpellbookProduce[];
  description: string;
  manaNeeded?: string;
  easyPrerequisites?: string;
  notablePrerequisites?: string;
  identity: string;
  bracketTag?: string;
  notes?: string;
}

export interface FindMyCombosResponse {
  identity: string;
  included: SpellbookCombo[];
  includedByChangingCommanders: SpellbookCombo[];
  almostIncluded: SpellbookCombo[];
  almostIncludedByAddingColors: SpellbookCombo[];
  almostIncludedByChangingCommanders: SpellbookCombo[];
  almostIncludedByAddingColorsAndChangingCommanders: SpellbookCombo[];
}

export async function findMyCombos(cards: DeckCard[]): Promise<FindMyCombosResponse> {
  const mainCards = cards.filter((c) => !c.isCommander);
  const commandersList = cards.filter((c) => c.isCommander);

  const mainPayload = mainCards.map((c) => ({ card: c.name }));
  const commandersPayload = commandersList.map((c) => ({ card: c.name }));

  const response = await fetch('/api/spellbook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      main: mainPayload,
      commanders: commandersPayload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Spellbook API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return json.results as FindMyCombosResponse;
}
