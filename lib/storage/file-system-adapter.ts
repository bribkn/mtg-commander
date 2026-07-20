import type { StorageAdapter } from './types';
import type { DeckState, SavedDeck, FavoriteArt, CustomCard } from '../deck-store';
import { get, set } from 'idb-keyval';

const DIRECTORY_HANDLE_KEY = 'mtg-tts-directory-handle';

export class FileSystemAdapter implements StorageAdapter {
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    // Try to restore the directory handle from IndexedDB
    try {
      const handle = await get<FileSystemDirectoryHandle>(DIRECTORY_HANDLE_KEY);
      if (handle) {
        // Verify permission. If not granted, request it.
        const options = { mode: 'readwrite' as const };
        // In Chrome, querying permission doesn't prompt, but requesting does.
        // We will wait to request until we actually need to read/write, or we can request now.
        // It's usually better to request when the user clicks something, but since this is init,
        // we might just check if we have permission.
        const permission = await handle.queryPermission(options);
        if (permission === 'granted') {
          this.directoryHandle = handle;
        } else {
          // If not granted, we will request it when loadState is called, as that's often triggered
          // by user interaction in the onboarding, but on reload it might be triggered without interaction.
          // We'll store it, but note it might require permission later.
          this.directoryHandle = handle; 
        }
      }
    } catch (err) {
      console.error('Failed to restore directory handle:', err);
    }
  }

  /**
   * Prompts the user to select a directory if we don't have one, or if permission is needed.
   */
  async requestDirectoryAccess(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.showDirectoryPicker) {
      alert('Your browser does not support the File System Access API. Please use Local Storage.');
      return false;
    }

    try {
      if (this.directoryHandle) {
        const permission = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          return true;
        }
      }

      // If no handle or permission denied, ask user to pick a folder
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      this.directoryHandle = handle;
      await set(DIRECTORY_HANDLE_KEY, handle);
      return true;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error requesting directory access:', err);
        alert('Failed to access directory. Please ensure you grant permissions.');
      }
      return false;
    }
  }

  private async getDecksDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.directoryHandle) return null;
    try {
      return await this.directoryHandle.getDirectoryHandle('Decks', { create: true });
    } catch (err) {
      console.error('Failed to get Decks directory:', err);
      return null;
    }
  }

  async loadState(): Promise<DeckState | null> {
    if (!this.directoryHandle) {
      // If we don't have a handle, we can't load state. 
      // It implies the user hasn't set up the folder yet, or we failed to restore it.
      return null;
    }

    try {
      // Verify we still have permission
      const perm = await this.directoryHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        // We cannot prompt here securely without user gesture in some browsers, 
        // but we can try. If it fails, we return null and the UI should prompt them.
        try {
          const newPerm = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
          if (newPerm !== 'granted') return null;
        } catch (e) {
          return null;
        }
      }

      const state: DeckState = {
        decks: [],
        activeDeckId: null,
        savedCardbacks: [],
        customCards: [],
        favoriteArts: [],
      };

      // 1. Load Settings
      try {
        const settingsFileHandle = await this.directoryHandle.getFileHandle('settings.json');
        const file = await settingsFileHandle.getFile();
        const text = await file.text();
        const settings = JSON.parse(text);
        if (settings.savedCardbacks) state.savedCardbacks = settings.savedCardbacks;
        if (settings.customCards) state.customCards = settings.customCards;
        if (settings.favoriteArts) state.favoriteArts = settings.favoriteArts;
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          console.error('Error reading settings.json:', err);
        }
      }

      // 2. Load Decks
      const decksDir = await this.getDecksDirectory();
      if (decksDir) {
        // Async iteration over directory
        // @ts-ignore
        for await (const entry of decksDir.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.json')) {
            try {
              const fileHandle = await decksDir.getFileHandle(entry.name);
              const file = await fileHandle.getFile();
              const text = await file.text();
              const deck: SavedDeck = JSON.parse(text);
              if (deck && deck.id) {
                state.decks.push(deck);
              }
            } catch (err) {
              console.error(`Error reading deck file ${entry.name}:`, err);
            }
          }
        }
      }

      return state;
    } catch (err) {
      console.error('Failed to load state from File System:', err);
      return null;
    }
  }

  async saveDeck(deck: SavedDeck): Promise<void> {
    const decksDir = await this.getDecksDirectory();
    if (!decksDir) return;

    try {
      const fileName = `${deck.id}.json`;
      const fileHandle = await decksDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(deck, null, 2));
      await writable.close();
    } catch (err) {
      console.error(`Failed to save deck ${deck.id}:`, err);
    }
  }

  async deleteDeck(deckId: string): Promise<void> {
    const decksDir = await this.getDecksDirectory();
    if (!decksDir) return;

    try {
      const fileName = `${deckId}.json`;
      await decksDir.removeEntry(fileName);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        console.error(`Failed to delete deck ${deckId}:`, err);
      }
    }
  }

  async saveSettings(settings: {
    savedCardbacks?: string[];
    customCards?: CustomCard[];
    favoriteArts?: FavoriteArt[];
  }): Promise<void> {
    if (!this.directoryHandle) return;

    try {
      // First, we need to read existing settings to merge them
      let existingSettings: any = {};
      try {
        const settingsFileHandle = await this.directoryHandle.getFileHandle('settings.json');
        const file = await settingsFileHandle.getFile();
        const text = await file.text();
        existingSettings = JSON.parse(text);
      } catch (err: any) {
        // File might not exist yet, which is fine
      }

      const mergedSettings = {
        ...existingSettings,
        ...settings,
      };

      const fileHandle = await this.directoryHandle.getFileHandle('settings.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(mergedSettings, null, 2));
      await writable.close();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }
}
