import type { DeckState, SavedDeck, FavoriteArt, CustomCard } from '../deck-store';
import type { ScryfallCard, CardCategory } from '../scryfall';

export interface StorageAdapter {
  /**
   * Initializes the storage adapter (e.g. asking for permissions, loading handles)
   */
  init(): Promise<void>;

  /**
   * Loads the full state from the storage medium.
   * Return null if no state exists (new user).
   */
  loadState(): Promise<DeckState | null>;

  /**
   * Called when a deck is modified (created, updated).
   */
  saveDeck(deck: SavedDeck): Promise<void>;

  /**
   * Called when a deck is deleted.
   */
  deleteDeck(deckId: string): Promise<void>;

  /**
   * Saves the global settings/collections (cardbacks, custom cards, favorite arts).
   */
  saveSettings(settings: {
    savedCardbacks?: string[];
    customCards?: CustomCard[];
    favoriteArts?: FavoriteArt[];
  }): Promise<void>;
}
