'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
  useState,
  useRef,
} from 'react';
import { ScryfallCard, getCardCategory, CardCategory } from './scryfall';
import { storageManager, StoragePreference } from './storage/manager';

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
  needsFullLoad?: boolean;
  _sourceFileName?: string;
}

export interface CustomCard {
  id: string;
  name: string;
  imageUrl: string;
  associatedScryfallId: string;
  associatedName: string;
}

/**
 * A globally-saved preferred art for a card.
 * cardName is normalized (lowercase, front-face only).
 * scryfallData holds the full preferred printing — no extra fetch needed.
 * imageUrl is only set for custom alter overrides.
 */
export interface FavoriteArt {
  cardName: string;       // normalized: lowercase, front-face only
  scryfallId: string;     // preferred printing scryfall ID
  scryfallData: ScryfallCard; // full card data for the preferred printing
  imageUrl?: string;      // if it's a custom alter, override image URL
}

export interface DeckState {
  decks: SavedDeck[];
  activeDeckId: string | null; // ID of currently open deck, null means dashboard
  savedCardbacks?: string[]; // Global registry of custom uploaded cardbacks
  customCards?: CustomCard[]; // Global registry of custom cards
  favoriteArts?: FavoriteArt[]; // Global registry of preferred card arts
}

type DeckAction =
  | { type: 'LOAD_STORE'; state: DeckState }
  | { type: 'CREATE_DECK'; name?: string; id?: string }
  | { type: 'DUPLICATE_DECK'; deckId: string; newDeckId?: string }
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
  | { type: 'SET_SIDEDECK_ENABLED'; enabled: boolean; deckId?: string }
  | { type: 'UPDATE_LOADED_DECK'; deck: SavedDeck }
  | { type: 'SET_FAVORITE_ART'; favoriteArt: FavoriteArt }
  | { type: 'REMOVE_FAVORITE_ART'; cardName: string };

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
      const newId = action.newDeckId || `deck-${Date.now()}`;
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

    case 'UPDATE_LOADED_DECK': {
      return {
        ...state,
        decks: state.decks.map((d) => (d.id === action.deck.id ? action.deck : d)),
      };
    }

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

          const existing = section === 'tokens'
            ? cardsList.find((c) => c.name.toLowerCase() === action.card.name.toLowerCase())
            : cardsList.find((c) => c.scryfallId === action.card.id);
          const qty = action.quantity ?? 1;

          let updatedList: DeckCard[];
          if (existing) {
            updatedList = cardsList.map((c) => {
              const isMatch = section === 'tokens'
                ? c.name.toLowerCase() === action.card.name.toLowerCase()
                : c.scryfallId === action.card.id;
              const newQty = section === 'tokens' ? 1 : c.quantity + qty;
              return isMatch ? { ...c, quantity: newQty } : c;
            });
          } else {
            const newCard: DeckCard = {
              scryfallId: action.card.id,
              name: action.card.name,
              quantity: section === 'tokens' ? 1 : qty,
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
        const existingIndex = section === 'tokens'
          ? cardsList.findIndex((c) => c.name.toLowerCase() === card.name.toLowerCase())
          : cardsList.findIndex((c) => c.scryfallId === card.id);

        if (section === 'main' && isCommander) {
          newCommanderId = card.id;
        }

        if (existingIndex > -1) {
          cardsList = cardsList.map((c, idx) =>
            idx === existingIndex
              ? {
                  ...c,
                  quantity: section === 'tokens' ? 1 : c.quantity + quantity,
                  isCommander: section === 'main' && isCommander ? true : c.isCommander,
                }
              : c
          );
        } else {
          const newCard: DeckCard = {
            scryfallId: card.id,
            name: card.name,
            quantity: section === 'tokens' ? 1 : quantity,
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

    case 'SET_FAVORITE_ART': {
      const currentList = state.favoriteArts || [];
      const normName = action.favoriteArt.cardName;
      // Replace existing entry for this card or add new one
      const alreadyExists = currentList.some((f) => f.cardName === normName);
      return {
        ...state,
        favoriteArts: alreadyExists
          ? currentList.map((f) => f.cardName === normName ? action.favoriteArt : f)
          : [...currentList, action.favoriteArt],
      };
    }

    case 'REMOVE_FAVORITE_ART': {
      const currentList = state.favoriteArts || [];
      return {
        ...state,
        favoriteArts: currentList.filter((f) => f.cardName !== action.cardName),
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
  favoriteArts: [],
};

function init(initial: DeckState): DeckState {
  if (typeof window === 'undefined') return initial;
  try {
    // Bypass loading local storage if a Supabase auth token is present
    const keys = Object.keys(localStorage);
    const hasSessionKey = keys.some((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));
    if (hasSessionKey) {
      return initial;
    }

    const stored = localStorage.getItem(STORE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (!parsed.savedCardbacks) {
        parsed.savedCardbacks = [];
      }
      if (!parsed.customCards) {
        parsed.customCards = [];
      }
      if (!parsed.favoriteArts) {
        parsed.favoriteArts = [];
      }
      if (Array.isArray(parsed.decks)) {
        parsed.decks = parsed.decks.map((d: any) => {
          const tokensList: DeckCard[] = d.tokens || [];
          const dedupedTokensMap = new Map<string, DeckCard>();
          for (const token of tokensList) {
            const normName = token.name.toLowerCase().trim();
            const existing = dedupedTokensMap.get(normName);
            if (existing) {
              existing.quantity = 1;
            } else {
              dedupedTokensMap.set(normName, { ...token, quantity: 1 });
            }
          }
          return {
            ...d,
            tags: d.tags || [],
            tokens: Array.from(dedupedTokensMap.values()),
            sidedeck: d.sidedeck || [],
            isSideDeckEnabled: d.isSideDeckEnabled ?? false,
          };
        });
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
  dispatch: (action: DeckAction) => Promise<void>;
  totalCards: number;
  commander: DeckCard | null;
  savedCardbacks: string[];
  customCards: CustomCard[];
  favoriteArts: FavoriteArt[];
  
  // Storage
  storagePreference: StoragePreference;
  setStoragePreference: (pref: StoragePreference) => Promise<boolean>;
  storageLoading: boolean;
}

const DeckContext = createContext<DeckContextValue | null>(null);

export function DeckProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(deckReducer, initialState, init);
  const [storagePreference, setPref] = useState<StoragePreference>(null);
  const [storageLoading, setStorageLoading] = useState(true);

  // Initialize storage state
  useEffect(() => {
    async function load() {
      const pref = storageManager.getPreference();
      setPref(pref);
      
      if (pref) {
        const adapter = storageManager.getAdapter();
        if (adapter) {
          const loadedState = await adapter.loadState();
          if (loadedState) {
            rawDispatch({ type: 'LOAD_STORE', state: loadedState });
          }
        }
      }
      setStorageLoading(false);
    }
    load();
  }, []);

  const setStoragePreference = async (pref: StoragePreference) => {
    setStorageLoading(true);
    const success = await storageManager.setPreference(pref);
    if (success) {
      setPref(pref);
      const adapter = storageManager.getAdapter();
      if (adapter) {
        const loadedState = await adapter.loadState();
        if (loadedState) {
          rawDispatch({ type: 'LOAD_STORE', state: loadedState });
        } else {
          // If no state exists in new storage, we might want to clear it or start fresh
          rawDispatch({ type: 'LOAD_STORE', state: initialState });
        }
      } else if (!pref) {
        rawDispatch({ type: 'LOAD_STORE', state: initialState });
      }
    }
    setStorageLoading(false);
    return success;
  };

  const dispatch = async (action: DeckAction) => {
    // 1. Optimistic UI update
    rawDispatch(action);
    
    // 2. Persist to storage
    const adapter = storageManager.getAdapter();
    if (!adapter) return;
    
    // We need to compute the next state to know what to save
    const nextState = deckReducer(state, action);
    
    try {
      switch (action.type) {
        case 'CREATE_DECK':
        case 'DUPLICATE_DECK': {
          const created = nextState.decks.find(
            (d) => !state.decks.some((sd) => sd.id === d.id)
          );
          if (created) await adapter.saveDeck(created);
          break;
        }
        case 'DELETE_DECK': {
          await adapter.deleteDeck(action.deckId);
          break;
        }
        case 'SAVE_CARDBACK_URL':
        case 'DELETE_CARDBACK_URL':
        case 'ADD_CUSTOM_CARD':
        case 'DELETE_CUSTOM_CARD':
        case 'SET_FAVORITE_ART':
        case 'REMOVE_FAVORITE_ART': {
          await adapter.saveSettings({
            savedCardbacks: nextState.savedCardbacks,
            customCards: nextState.customCards,
            favoriteArts: nextState.favoriteArts,
          });
          break;
        }
        default: {
          const targetId = (action as any).deckId || state.activeDeckId;
          if (targetId) {
            const updatedDeck = nextState.decks.find((d) => d.id === targetId);
            if (updatedDeck) await adapter.saveDeck(updatedDeck);
          }
          break;
        }
      }
    } catch (err) {
      console.error('Failed to sync action to storage:', err);
    }
  };

  const activeDeck = state.decks.find((d) => d.id === state.activeDeckId) ?? null;
  const totalCards = activeDeck ? activeDeck.cards.reduce((sum, c) => sum + c.quantity, 0) : 0;
  const commander = activeDeck ? activeDeck.cards.find((c) => c.isCommander) ?? null : null;
  const savedCardbacks = state.savedCardbacks || [];
  const customCards = state.customCards || [];
  const favoriteArts = state.favoriteArts || [];

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
        favoriteArts,
        storagePreference,
        setStoragePreference,
        storageLoading,
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

/**
 * Apply a saved favorite art to a ScryfallCard if one exists.
 * For custom alters (imageUrl set): overlays the imageUrl over the cached scryfallData.
 * For normal printings: returns the cached scryfallData directly.
 * Returns the original card if no favorite is found.
 */
export function applyFavoriteArt(card: ScryfallCard, favoriteArts: FavoriteArt[]): ScryfallCard {
  const normName = card.name.toLowerCase().trim().split('//')[0].trim();
  const favorite = favoriteArts.find((f) => f.cardName === normName);
  if (!favorite) return card;

  // Custom alter: override image_uris with the alter URL
  if (favorite.imageUrl) {
    const base = favorite.scryfallData;
    return {
      ...base,
      image_uris: {
        ...base.image_uris,
        small: favorite.imageUrl,
        normal: favorite.imageUrl,
        large: favorite.imageUrl,
        png: favorite.imageUrl,
        art_crop: favorite.imageUrl,
      },
      card_faces: base.card_faces?.map((face, index) =>
        index === 0
          ? {
              ...face,
              image_uris: {
                ...face.image_uris,
                small: favorite.imageUrl,
                normal: favorite.imageUrl,
                large: favorite.imageUrl,
                png: favorite.imageUrl,
                art_crop: favorite.imageUrl,
              },
            }
          : face
      ),
    };
  }

  // Normal printing: use the cached scryfallData as-is
  return favorite.scryfallData;
}
