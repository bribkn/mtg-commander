'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react';
import { ScryfallCard, getCardCategory, CardCategory } from './scryfall';

export interface DeckCard {
  scryfallId: string;
  name: string;
  quantity: number;
  scryfallData: ScryfallCard;
  category: CardCategory;
  isCommander: boolean;
}

export interface SavedDeck {
  id: string;
  deckName: string;
  cards: DeckCard[];
  commanderId: string | null; // scryfallId of the commander
  coverCardId?: string | null; // scryfallId of the custom cover art card
  customCardbackUrl?: string | null; // Custom cardback URL
  wins?: number;   // Number of wins
  losses?: number; // Number of losses
  tags?: string[]; // Deck tags
  tokens?: DeckCard[];
  sidedeck?: DeckCard[];
  isSideDeckEnabled?: boolean;
}

export interface CustomCard {
  id: string;
  name: string;
  imageUrl: string;
  associatedScryfallId: string;
  associatedName: string;
}

interface DeckState {
  decks: SavedDeck[];
  activeDeckId: string | null; // ID of currently open deck, null means dashboard
  savedCardbacks?: string[]; // Global registry of custom uploaded cardbacks
  customCards?: CustomCard[]; // Global registry of custom cards
}

type DeckAction =
  | { type: 'LOAD_STORE'; state: DeckState }
  | { type: 'CREATE_DECK'; name?: string; id?: string }
  | { type: 'DUPLICATE_DECK'; deckId: string }
  | { type: 'DELETE_DECK'; deckId: string }
  | { type: 'OPEN_DECK'; deckId: string }
  | { type: 'CLOSE_DECK' }
  | { type: 'SET_DECK_NAME'; name: string; deckId?: string }
  | { type: 'ADD_CARD'; card: ScryfallCard; quantity?: number; isCommander?: boolean; deckId?: string; targetSection?: 'main' | 'side' | 'tokens' }
  | { type: 'REMOVE_CARD'; scryfallId: string; deckId?: string; targetSection?: 'main' | 'side' | 'tokens' }
  | { type: 'SET_QUANTITY'; scryfallId: string; quantity: number; deckId?: string; targetSection?: 'main' | 'side' | 'tokens' }
  | { type: 'INCREMENT_QUANTITY'; scryfallId: string; deckId?: string; targetSection?: 'main' | 'side' | 'tokens' }
  | { type: 'DECREMENT_QUANTITY'; scryfallId: string; deckId?: string; targetSection?: 'main' | 'side' | 'tokens' }
  | { type: 'SET_COMMANDER'; scryfallId: string; deckId?: string }
  | { type: 'UNSET_COMMANDER'; deckId?: string }
  | { type: 'SET_COVER_CARD'; scryfallId: string; deckId?: string }
  | { type: 'UNSET_COVER_CARD'; deckId?: string }
  | { type: 'SET_CUSTOM_CARDBACK'; url: string | null; deckId?: string }
  | { type: 'SAVE_CARDBACK_URL'; url: string }
  | { type: 'DELETE_CARDBACK_URL'; url: string }
  | { type: 'ADD_CUSTOM_CARD'; name: string; imageUrl: string; associatedScryfallId: string; associatedName: string }
  | { type: 'DELETE_CUSTOM_CARD'; id: string }
  | { type: 'CLEAR_DECK'; deckId?: string }
  | { type: 'UPDATE_CARD_DATA'; scryfallId: string; newCardData: ScryfallCard; deckId?: string; targetSection?: 'main' | 'side' | 'tokens' }
  | { type: 'UPDATE_DECK_STATS'; wins: number; losses: number; deckId?: string }
  | { type: 'SET_DECK_TAGS'; tags: string[]; deckId?: string }
  | { type: 'BULK_ADD_CARDS'; cards: Array<{ card: ScryfallCard; quantity: number; isCommander?: boolean }>; deckId?: string; targetSection?: 'main' | 'side' | 'tokens' }
  | { type: 'MOVE_CARD_TO_SIDEDECK'; scryfallId: string; deckId?: string }
  | { type: 'MOVE_CARD_TO_MAINDECK'; scryfallId: string; deckId?: string }
  | { type: 'TOGGLE_SIDEDECK'; deckId?: string }
  | { type: 'SET_SIDEDECK_ENABLED'; enabled: boolean; deckId?: string };

const STORE_STORAGE_KEY = 'mtg-commander-decks-store';

function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case 'LOAD_STORE':
      return action.state;

    case 'CREATE_DECK': {
      const newId = action.id || `deck-${Date.now()}`;
      const newDeck: SavedDeck = {
        id: newId,
        deckName: action.name || 'New Commander Deck',
        cards: [],
        commanderId: null,
        coverCardId: null,
        customCardbackUrl: null,
        wins: 0,
        losses: 0,
        tags: [],
        tokens: [],
        sidedeck: [],
        isSideDeckEnabled: false,
      };
      return {
        ...state,
        decks: [...state.decks, newDeck],
        activeDeckId: newId,
      };
    }

    case 'DUPLICATE_DECK': {
      const source = state.decks.find((d) => d.id === action.deckId);
      if (!source) return state;
      const newId = `deck-${Date.now()}`;
      const duplicate: SavedDeck = {
        id: newId,
        deckName: `${source.deckName} (Copia)`,
        cards: source.cards.map((c) => ({ ...c })), // deep copy
        commanderId: source.commanderId,
        coverCardId: source.coverCardId || null,
        customCardbackUrl: source.customCardbackUrl || null,
        wins: source.wins || 0,
        losses: source.losses || 0,
        tags: source.tags ? [...source.tags] : [],
        tokens: source.tokens ? source.tokens.map((c) => ({ ...c })) : [],
        sidedeck: source.sidedeck ? source.sidedeck.map((c) => ({ ...c })) : [],
        isSideDeckEnabled: source.isSideDeckEnabled ?? false,
      };
      return {
        ...state,
        decks: [...state.decks, duplicate],
      };
    }

    case 'DELETE_DECK': {
      const filtered = state.decks.filter((d) => d.id !== action.deckId);
      return {
        ...state,
        decks: filtered,
        activeDeckId: state.activeDeckId === action.deckId ? null : state.activeDeckId,
      };
    }

    case 'OPEN_DECK':
      return {
        ...state,
        activeDeckId: action.deckId,
      };

    case 'CLOSE_DECK':
      return {
        ...state,
        activeDeckId: null,
      };

    // --- Active Deck Operations ---
    case 'SET_DECK_NAME': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === targetId ? { ...d, deckName: action.name } : d
        ),
      };
    }

    case 'SET_DECK_TAGS': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === targetId ? { ...d, tags: action.tags } : d
        ),
      };
    }

    case 'ADD_CARD': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      const section = action.targetSection || 'main';

      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;

          let cardsList = d.cards;
          if (section === 'side') {
            cardsList = d.sidedeck || [];
          } else if (section === 'tokens') {
            cardsList = d.tokens || [];
          }

          const existing = cardsList.find((c) => c.scryfallId === action.card.id);
          const qty = action.quantity ?? 1;

          let updatedList: DeckCard[];
          if (existing) {
            updatedList = cardsList.map((c) =>
              c.scryfallId === action.card.id
                ? { ...c, quantity: c.quantity + qty }
                : c
            );
          } else {
            const newCard: DeckCard = {
              scryfallId: action.card.id,
              name: action.card.name,
              quantity: qty,
              scryfallData: action.card,
              category: getCardCategory(action.card),
              isCommander: section === 'main' ? (action.isCommander ?? false) : false,
            };
            updatedList = [...cardsList, newCard];
          }

          if (section === 'side') {
            return { ...d, sidedeck: updatedList };
          } else if (section === 'tokens') {
            return { ...d, tokens: updatedList };
          } else {
            const newCommanderId = action.isCommander ? action.card.id : d.commanderId;
            const finalCards = updatedList.map((c) => ({
              ...c,
              isCommander: action.isCommander
                ? c.scryfallId === action.card.id
                : c.isCommander,
            }));
            return {
              ...d,
              cards: finalCards,
              commanderId: newCommanderId,
            };
          }
        }),
      };
    }

    case 'BULK_ADD_CARDS': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      const activeDeck = state.decks.find((d) => d.id === targetId);
      if (!activeDeck) return state;
      const section = action.targetSection || 'main';

      let tempDeck = { ...activeDeck };
      let cardsList = section === 'side' ? (tempDeck.sidedeck || []) : section === 'tokens' ? (tempDeck.tokens || []) : tempDeck.cards;
      let newCommanderId = tempDeck.commanderId;

      for (const { card, quantity, isCommander } of action.cards) {
        const existingIndex = cardsList.findIndex((c) => c.scryfallId === card.id);

        if (section === 'main' && isCommander) {
          newCommanderId = card.id;
        }

        if (existingIndex > -1) {
          cardsList = cardsList.map((c, idx) =>
            idx === existingIndex
              ? {
                  ...c,
                  quantity: c.quantity + quantity,
                  isCommander: section === 'main' && isCommander ? true : c.isCommander,
                }
              : c
          );
        } else {
          const newCard: DeckCard = {
            scryfallId: card.id,
            name: card.name,
            quantity,
            scryfallData: card,
            category: getCardCategory(card),
            isCommander: section === 'main' ? (isCommander ?? false) : false,
          };
          cardsList = [...cardsList, newCard];
        }
      }

      if (section === 'side') {
        tempDeck.sidedeck = cardsList;
      } else if (section === 'tokens') {
        tempDeck.tokens = cardsList;
      } else {
        tempDeck.cards = cardsList;
        if (newCommanderId) {
          tempDeck.commanderId = newCommanderId;
          tempDeck.cards = tempDeck.cards.map((c) => ({
            ...c,
            isCommander: c.scryfallId === newCommanderId,
          }));
        }
      }

      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === targetId ? tempDeck : d
        ),
      };
    }

    case 'REMOVE_CARD': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      const section = action.targetSection || 'main';

      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;

          if (section === 'side') {
            const filtered = (d.sidedeck || []).filter((c) => c.scryfallId !== action.scryfallId);
            return { ...d, sidedeck: filtered };
          } else if (section === 'tokens') {
            const filtered = (d.tokens || []).filter((c) => c.scryfallId !== action.scryfallId);
            return { ...d, tokens: filtered };
          } else {
            const filtered = d.cards.filter((c) => c.scryfallId !== action.scryfallId);
            return {
              ...d,
              cards: filtered,
              commanderId: d.commanderId === action.scryfallId ? null : d.commanderId,
              coverCardId: d.coverCardId === action.scryfallId ? null : (d.coverCardId || null),
            };
          }
        }),
      };
    }

    case 'SET_QUANTITY': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      const section = action.targetSection || 'main';

      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;

          let cardsList = section === 'side' ? (d.sidedeck || []) : section === 'tokens' ? (d.tokens || []) : d.cards;

          if (action.quantity <= 0) {
            const filtered = cardsList.filter((c) => c.scryfallId !== action.scryfallId);
            if (section === 'side') return { ...d, sidedeck: filtered };
            if (section === 'tokens') return { ...d, tokens: filtered };
            return {
              ...d,
              cards: filtered,
              commanderId: d.commanderId === action.scryfallId ? null : d.commanderId,
              coverCardId: d.coverCardId === action.scryfallId ? null : (d.coverCardId || null),
            };
          }

          const updated = cardsList.map((c) =>
            c.scryfallId === action.scryfallId ? { ...c, quantity: action.quantity } : c
          );

          if (section === 'side') return { ...d, sidedeck: updated };
          if (section === 'tokens') return { ...d, tokens: updated };
          return { ...d, cards: updated };
        }),
      };
    }

    case 'INCREMENT_QUANTITY': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      const section = action.targetSection || 'main';

      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;

          let cardsList = section === 'side' ? (d.sidedeck || []) : section === 'tokens' ? (d.tokens || []) : d.cards;
          const updated = cardsList.map((c) =>
            c.scryfallId === action.scryfallId ? { ...c, quantity: c.quantity + 1 } : c
          );

          if (section === 'side') return { ...d, sidedeck: updated };
          if (section === 'tokens') return { ...d, tokens: updated };
          return { ...d, cards: updated };
        }),
      };
    }

    case 'DECREMENT_QUANTITY': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      const section = action.targetSection || 'main';

      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;

          let cardsList = section === 'side' ? (d.sidedeck || []) : section === 'tokens' ? (d.tokens || []) : d.cards;
          const card = cardsList.find((c) => c.scryfallId === action.scryfallId);
          if (!card) return d;

          if (card.quantity <= 1) {
            const filtered = cardsList.filter((c) => c.scryfallId !== action.scryfallId);
            if (section === 'side') return { ...d, sidedeck: filtered };
            if (section === 'tokens') return { ...d, tokens: filtered };
            return {
              ...d,
              cards: filtered,
              commanderId: d.commanderId === action.scryfallId ? null : d.commanderId,
              coverCardId: d.coverCardId === action.scryfallId ? null : (d.coverCardId || null),
            };
          }

          const updated = cardsList.map((c) =>
            c.scryfallId === action.scryfallId ? { ...c, quantity: c.quantity - 1 } : c
          );

          if (section === 'side') return { ...d, sidedeck: updated };
          if (section === 'tokens') return { ...d, tokens: updated };
          return { ...d, cards: updated };
        }),
      };
    }

    case 'SET_COMMANDER': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;
          const updatedCards = d.cards.map((c) => ({
            ...c,
            isCommander: c.scryfallId === action.scryfallId,
          }));
          return {
            ...d,
            cards: updatedCards,
            commanderId: action.scryfallId,
          };
        }),
      };
    }

    case 'UNSET_COMMANDER': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;
          return {
            ...d,
            cards: d.cards.map((c) => ({ ...c, isCommander: false })),
            commanderId: null,
          };
        }),
      };
    }

    case 'SET_COVER_CARD': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === targetId ? { ...d, coverCardId: action.scryfallId } : d
        ),
      };
    }

    case 'UNSET_COVER_CARD': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === targetId ? { ...d, coverCardId: null } : d
        ),
      };
    }

    case 'SET_CUSTOM_CARDBACK': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === targetId ? { ...d, customCardbackUrl: action.url } : d
        ),
      };
    }

    case 'SAVE_CARDBACK_URL': {
      const currentList = state.savedCardbacks || [];
      if (currentList.includes(action.url)) return state;
      return {
        ...state,
        savedCardbacks: [...currentList, action.url],
      };
    }

    case 'DELETE_CARDBACK_URL': {
      const currentList = state.savedCardbacks || [];
      return {
        ...state,
        savedCardbacks: currentList.filter((url) => url !== action.url),
      };
    }

    case 'ADD_CUSTOM_CARD': {
      const currentList = state.customCards || [];
      const newCard: CustomCard = {
        id: `custom-${Date.now()}`,
        name: action.name,
        imageUrl: action.imageUrl,
        associatedScryfallId: action.associatedScryfallId,
        associatedName: action.associatedName,
      };
      return {
        ...state,
        customCards: [...currentList, newCard],
      };
    }

    case 'DELETE_CUSTOM_CARD': {
      const currentList = state.customCards || [];
      return {
        ...state,
        customCards: currentList.filter((c) => c.id !== action.id),
      };
    }

    case 'UPDATE_DECK_STATS': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === targetId ? { ...d, wins: action.wins, losses: action.losses } : d
        ),
      };
    }

    case 'CLEAR_DECK': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;
          return {
            ...d,
            cards: [],
            tokens: [],
            sidedeck: [],
            isSideDeckEnabled: false,
            commanderId: null,
            coverCardId: null,
            customCardbackUrl: null,
            wins: 0,
            losses: 0,
          };
        }),
      };
    }

    case 'UPDATE_CARD_DATA': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      const section = action.targetSection || 'main';

      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;

          if (section === 'side') {
            const updated = (d.sidedeck || []).map((c) => {
              if (c.scryfallId !== action.scryfallId) return c;
              return {
                ...c,
                scryfallId: action.newCardData.id,
                name: action.newCardData.name,
                scryfallData: action.newCardData,
                category: getCardCategory(action.newCardData),
              };
            });
            return { ...d, sidedeck: updated };
          } else if (section === 'tokens') {
            const updated = (d.tokens || []).map((c) => {
              if (c.scryfallId !== action.scryfallId) return c;
              return {
                ...c,
                scryfallId: action.newCardData.id,
                name: action.newCardData.name,
                scryfallData: action.newCardData,
                category: getCardCategory(action.newCardData),
              };
            });
            return { ...d, tokens: updated };
          } else {
            const isTargetCommander = d.commanderId === action.scryfallId;
            const isTargetCover = d.coverCardId === action.scryfallId;
            
            const updatedCards = d.cards.map((c) => {
              if (c.scryfallId !== action.scryfallId) return c;
              return {
                ...c,
                scryfallId: action.newCardData.id,
                name: action.newCardData.name,
                scryfallData: action.newCardData,
                category: getCardCategory(action.newCardData),
              };
            });

            return {
              ...d,
              cards: updatedCards,
              commanderId: isTargetCommander ? action.newCardData.id : d.commanderId,
              coverCardId: isTargetCover ? action.newCardData.id : (d.coverCardId || null),
            };
          }
        }),
      };
    }

    case 'MOVE_CARD_TO_SIDEDECK': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;

      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;

          const cardToMove = d.cards.find((c) => c.scryfallId === action.scryfallId);
          if (!cardToMove) return d;

          const updatedCards = d.cards.map((c) =>
            c.scryfallId === action.scryfallId ? { ...c, quantity: c.quantity - 1 } : c
          ).filter((c) => c.quantity > 0);

          const sidedeckList = d.sidedeck || [];
          const existingInSide = sidedeckList.find((c) => c.scryfallId === action.scryfallId);
          let updatedSide: DeckCard[];

          if (existingInSide) {
            updatedSide = sidedeckList.map((c) =>
              c.scryfallId === action.scryfallId ? { ...c, quantity: c.quantity + 1 } : c
            );
          } else {
            updatedSide = [...sidedeckList, { ...cardToMove, quantity: 1, isCommander: false }];
          }

          const isCommanderRemoved = d.commanderId === action.scryfallId && !updatedCards.some((c) => c.scryfallId === action.scryfallId);

          return {
            ...d,
            cards: updatedCards,
            sidedeck: updatedSide,
            commanderId: isCommanderRemoved ? null : d.commanderId,
            coverCardId: d.coverCardId === action.scryfallId && !updatedCards.some((c) => c.scryfallId === action.scryfallId) ? null : d.coverCardId,
          };
        }),
      };
    }

    case 'MOVE_CARD_TO_MAINDECK': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;

      return {
        ...state,
        decks: state.decks.map((d) => {
          if (d.id !== targetId) return d;

          const sidedeckList = d.sidedeck || [];
          const cardToMove = sidedeckList.find((c) => c.scryfallId === action.scryfallId);
          if (!cardToMove) return d;

          const updatedSide = sidedeckList.map((c) =>
            c.scryfallId === action.scryfallId ? { ...c, quantity: c.quantity - 1 } : c
          ).filter((c) => c.quantity > 0);

          const existingInMain = d.cards.find((c) => c.scryfallId === action.scryfallId);
          let updatedCards: DeckCard[];

          if (existingInMain) {
            updatedCards = d.cards.map((c) =>
              c.scryfallId === action.scryfallId ? { ...c, quantity: c.quantity + 1 } : c
            );
          } else {
            updatedCards = [...d.cards, { ...cardToMove, quantity: 1 }];
          }

          return {
            ...d,
            cards: updatedCards,
            sidedeck: updatedSide,
          };
        }),
      };
    }

    case 'TOGGLE_SIDEDECK': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === targetId ? { ...d, isSideDeckEnabled: !d.isSideDeckEnabled } : d
        ),
      };
    }

    case 'SET_SIDEDECK_ENABLED': {
      const targetId = action.deckId || state.activeDeckId;
      if (!targetId) return state;
      return {
        ...state,
        decks: state.decks.map((d) =>
          d.id === targetId ? { ...d, isSideDeckEnabled: action.enabled } : d
        ),
      };
    }

    default:
      return state;
  }
}

const initialState: DeckState = {
  decks: [],
  activeDeckId: null,
  savedCardbacks: [],
  customCards: [],
};

function init(initial: DeckState): DeckState {
  if (typeof window === 'undefined') return initial;
  try {
    const stored = localStorage.getItem(STORE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (!parsed.savedCardbacks) {
        parsed.savedCardbacks = [];
      }
      if (!parsed.customCards) {
        parsed.customCards = [];
      }
      if (Array.isArray(parsed.decks)) {
        parsed.decks = parsed.decks.map((d: any) => ({
          ...d,
          tags: d.tags || [],
          tokens: d.tokens || [],
          sidedeck: d.sidedeck || [],
          isSideDeckEnabled: d.isSideDeckEnabled ?? false,
        }));
      }
      return parsed;
    }
    // Migration of old single-deck layout
    const oldStored = localStorage.getItem('mtg-commander-deck');
    if (oldStored) {
      const oldDeck = JSON.parse(oldStored);
      if (oldDeck && (oldDeck.cards || oldDeck.deckName)) {
        const migratedDeck: SavedDeck = {
          id: 'deck-migrated',
          deckName: oldDeck.deckName || 'Migrated Deck',
          cards: oldDeck.cards || [],
          commanderId: oldDeck.commanderId || null,
          coverCardId: null,
          customCardbackUrl: null,
          tags: [],
        };
        const migratedState: DeckState = {
          decks: [migratedDeck],
          activeDeckId: 'deck-migrated',
          savedCardbacks: [],
          customCards: [],
        };
        localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(migratedState));
        localStorage.removeItem('mtg-commander-deck');
        return migratedState;
      }
    }
  } catch {
    // ignore
  }
  return initial;
}

interface DeckContextValue {
  state: SavedDeck | null; // active deck (or null if dashboard is open)
  decks: SavedDeck[];
  activeDeckId: string | null;
  dispatch: React.Dispatch<DeckAction>;
  totalCards: number;
  commander: DeckCard | null;
  savedCardbacks: string[];
  customCards: CustomCard[];
}

const DeckContext = createContext<DeckContextValue | null>(null);

export function DeckProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(deckReducer, initialState, init);

  // Sync state changes back to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const activeDeck = state.decks.find((d) => d.id === state.activeDeckId) ?? null;
  const totalCards = activeDeck ? activeDeck.cards.reduce((sum, c) => sum + c.quantity, 0) : 0;
  const commander = activeDeck ? activeDeck.cards.find((c) => c.isCommander) ?? null : null;
  const savedCardbacks = state.savedCardbacks || [];
  const customCards = state.customCards || [];

  return (
    <DeckContext.Provider
      value={{
        state: activeDeck,
        decks: state.decks,
        activeDeckId: state.activeDeckId,
        dispatch,
        totalCards,
        commander,
        savedCardbacks,
        customCards,
      }}
    >
      {children}
    </DeckContext.Provider>
  );
}

export function useDeck() {
  const ctx = useContext(DeckContext);
  if (!ctx) throw new Error('useDeck must be used within DeckProvider');
  return ctx;
}
