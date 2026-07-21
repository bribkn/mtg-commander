import type { StorageAdapter } from './types';
import type { DeckState, SavedDeck, FavoriteArt, CustomCard } from '../deck-store';

const STORE_STORAGE_KEY = 'mtg-commander-decks-store';

export class LocalStorageAdapter implements StorageAdapter {
  async init(): Promise<void> {
    // No initialization needed for local storage
  }

  async hasPermission(): Promise<boolean> {
    return true;
  }

  async loadFullDeck(deck: SavedDeck): Promise<SavedDeck | null> {
    return deck;
  }

  async loadState(): Promise<DeckState | null> {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(STORE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed as DeckState;
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
            favoriteArts: [],
          };
          localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(migratedState));
          localStorage.removeItem('mtg-commander-deck');
          return migratedState;
        }
      }
    } catch (err) {
      console.error('Failed to load state from Local Storage:', err);
    }
    
    return null;
  }

  private async _updateState(updater: (state: DeckState) => void): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const currentState = (await this.loadState()) || {
        decks: [],
        activeDeckId: null,
        savedCardbacks: [],
        customCards: [],
        favoriteArts: [],
      };
      
      updater(currentState);
      localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(currentState));
    } catch (err) {
      console.error('Failed to update state in Local Storage:', err);
    }
  }

  async saveDeck(deck: SavedDeck): Promise<void> {
    await this._updateState((state) => {
      const index = state.decks.findIndex(d => d.id === deck.id);
      if (index >= 0) {
        state.decks[index] = deck;
      } else {
        state.decks.push(deck);
      }
    });
  }

  async deleteDeck(deckId: string): Promise<void> {
    await this._updateState((state) => {
      state.decks = state.decks.filter(d => d.id !== deckId);
    });
  }

  async saveSettings(settings: {
    savedCardbacks?: string[];
    customCards?: CustomCard[];
    favoriteArts?: FavoriteArt[];
  }): Promise<void> {
    await this._updateState((state) => {
      if (settings.savedCardbacks !== undefined) {
        state.savedCardbacks = settings.savedCardbacks;
      }
      if (settings.customCards !== undefined) {
        state.customCards = settings.customCards;
      }
      if (settings.favoriteArts !== undefined) {
        state.favoriteArts = settings.favoriteArts;
      }
    });
  }
}
