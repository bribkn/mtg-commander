import type { StorageAdapter } from './types';
import type { DeckState, SavedDeck, FavoriteArt, CustomCard } from '../deck-store';
import { get, set } from 'idb-keyval';
import { generateTTSExport } from '../tts-export';
import { parseLegacyTTSFile, ensureDeckEnriched } from '../import';
import { MTG_CARD_BACK, isToken } from '../scryfall';

const DIRECTORY_HANDLE_KEY = 'mtg-tts-directory-handle';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'deck';
}

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

  /** Ensure we have a directory handle with read/write permission */
  async ensureAccess(): Promise<boolean> {
    if (!this.directoryHandle) {
      // No handle yet; request access
      return await this.requestDirectoryAccess();
    }
    const perm = await this.directoryHandle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      return true;
    }
    // Try to request permission again (may require user gesture)
    const newPerm = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
    return newPerm === 'granted';
  }

  private async getDecksDirectory(): Promise<FileSystemDirectoryHandle | null> {
    // We now just use the root directory directly
    return this.directoryHandle;
  }

  async loadState(): Promise<DeckState | null> {
    if (!this.directoryHandle) {
      // If we don't have a handle, we can't load state. 
      // It implies the user hasn't set up the folder yet, or we failed to restore it.
      return null;
    }

    try {
       // Verify we still have permission
       let perm = await this.directoryHandle.queryPermission({ mode: 'readwrite' });
       if (perm !== 'granted') {
         // Try to request permission (may require user gesture)
         try {
           const newPerm = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
           perm = newPerm;
         } catch (e) {
           // fallback: ask user to re‑select the folder via UI button
           console.warn('Permission not granted; UI should prompt for directory access');
         }
       }
       if (perm !== 'granted') {
         // Permission still not granted – abort loading. UI can call requestDirectoryAccess later.
         return null;
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
         // Load optional settings.json if present
         try {
           const settingsFileHandle = await this.directoryHandle.getFileHandle('settings.json');
           const file = await settingsFileHandle.getFile();
           const text = await file.text();
           const settings = JSON.parse(text);
           if (settings.savedCardbacks) state.savedCardbacks = settings.savedCardbacks;
           if (settings.customCards) state.customCards = settings.customCards;
           if (settings.favoriteArts) state.favoriteArts = settings.favoriteArts;
         } catch (_) { /* ignore missing settings */ }
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          console.error('Error reading settings.json:', err);
        }
      }

      // 2. Load Decks from root (New Format)
      const decksDir = this.directoryHandle;
      let loaded = 0;
      if (decksDir) {
        // First collect all JSON entries to know total count
        const entries: FileSystemFileHandle[] = [];
        // @ts-ignore
        for await (const e of decksDir.values()) {
          if (e.kind === 'file' && e.name.endsWith('.json') && e.name !== 'settings.json') {
            entries.push(e as any);
          }
        }
        const total = entries.length;
        // Update total in UI if present
        const totalEl = document.getElementById('total');
        if (totalEl) totalEl.textContent = String(total);
        for (const entry of entries) {
          try {
            console.log('Loading deck file:', entry.name);
            const fileHandle = await decksDir.getFileHandle(entry.name);
            const file = await fileHandle.getFile();
            const text = await file.text();
            const parsed = JSON.parse(text);
            let deck: SavedDeck | null = null;
            // Prefer the stored builder state if present
            if (parsed.__mtgTtsBuilderState) {
              deck = parsed.__mtgTtsBuilderState as SavedDeck;
              deck.needsFullLoad = true;
              deck._sourceFileName = entry.name;
            } else if (parsed.deckName && parsed.cards) {
              // New format without injected state
              deck = parsed as SavedDeck;
              deck.needsFullLoad = true;
              deck._sourceFileName = entry.name;
            } else if (parsed.ObjectStates) {
              // Legacy TTS format: create a stub deck
              const baseName = entry.name.replace(/\.json$/i, '');
              deck = {
                id: baseName, // Use filename as ID temporarily
                deckName: baseName,
                cards: [],
                commanderId: null,
                tokens: [],
                sidedeck: [],
                isSideDeckEnabled: false,
                needsFullLoad: true,
                _sourceFileName: entry.name,
              };
            }
            if (deck && deck.id) {
              if (!state.decks.find((d) => d.id === deck!.id)) {
                state.decks.push(deck);
              }
            }
            // Update loaded count UI
            loaded += 1;
            const loadedEl = document.getElementById('loaded');
            if (loadedEl) loadedEl.textContent = String(loaded);
          } catch (err) {
            console.error(`Error reading deck file ${entry.name}:`, err);
          }
        }
      }


      return state;
    } catch (err) {
      console.error('Failed to load state from File System:', err);
      return null;
    }
  }

  async loadFullDeck(stubDeck: SavedDeck): Promise<SavedDeck | null> {
    if (!this.directoryHandle || !stubDeck._sourceFileName) return stubDeck;
    try {
      const fileHandle = await this.directoryHandle.getFileHandle(stubDeck._sourceFileName);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      let deck: SavedDeck | null = null;
      if (parsed.__mtgTtsBuilderState) {
        deck = parsed.__mtgTtsBuilderState as SavedDeck;
      } else if (parsed.deckName && parsed.cards) {
        deck = parsed as SavedDeck;
      } else if (parsed.ObjectStates) {
        const baseName = stubDeck._sourceFileName.replace(/\.json$/i, '');
        deck = await parseLegacyTTSFile(text, baseName);
      }
      
      if (deck && deck.id) {
        deck = await ensureDeckEnriched(deck);
        // Fix: When using the local folder, ensure tokens are not added as main cards
        const tokensFromCards = deck.cards.filter((c) => c.scryfallData && isToken(c.scryfallData));
        deck.cards = deck.cards.filter((c) => !(c.scryfallData && isToken(c.scryfallData)));
        if (deck.sidedeck) {
          const tokensFromSide = deck.sidedeck.filter((c) => c.scryfallData && isToken(c.scryfallData));
          deck.sidedeck = deck.sidedeck.filter((c) => !(c.scryfallData && isToken(c.scryfallData)));
          tokensFromCards.push(...tokensFromSide);
        }
        if (tokensFromCards.length > 0) {
          if (!deck.tokens) deck.tokens = [];
          for (const t of tokensFromCards) {
            if (!deck.tokens.find((existing) => existing.scryfallId === t.scryfallId)) {
              deck.tokens.push(t);
            }
          }
        }
        // Enforce Commander singleton rule: deduplicate and cap non-land cards at qty=1
        const isLandCard = (c: any): boolean => {
          const typeLine: string =
            c.scryfallData?.type_line ?? c.scryfallData?.card_faces?.[0]?.type_line ?? '';
          return typeLine.toLowerCase().includes('land');
        };
        const dedupeCards = (cards: any[]) => {
          const seen = new Map<string, any>();
          for (const c of cards) {
            const key = c.scryfallId || c.name;
            if (!seen.has(key)) {
              seen.set(key, { ...c });
            } else {
              const existing = seen.get(key)!;
              if (isLandCard(existing)) {
                existing.quantity = Math.max(existing.quantity, c.quantity);
              }
            }
          }
          return Array.from(seen.values()).map((c) => ({
            ...c,
            quantity: c.isCommander || isLandCard(c) ? c.quantity : 1,
          }));
        };
        deck.cards = dedupeCards(deck.cards);
        if (deck.sidedeck) deck.sidedeck = dedupeCards(deck.sidedeck);
        deck.needsFullLoad = false;
        return deck;
      }
      return stubDeck;
    } catch (err) {
      console.error(`Error fully loading deck file ${stubDeck._sourceFileName}:`, err);
      return stubDeck;
    }
  }

  async saveDeck(deck: SavedDeck): Promise<void> {
    const dir = this.directoryHandle;
    if (!dir) return;

    try {
      const baseName = sanitizeFileName(deck.deckName);
      const jsonFileName = `${baseName}.json`;
      const pngFileName = `${baseName}.png`;

      // 1. Check for old file if renamed
      // @ts-ignore
      for await (const entry of dir.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json') && entry.name !== 'settings.json' && entry.name !== jsonFileName) {
          try {
            const oldHandle = await dir.getFileHandle(entry.name);
            const oldFile = await oldHandle.getFile();
            const text = await oldFile.text();
            const parsed = JSON.parse(text);
            const oldDeck: SavedDeck = parsed.__mtgTtsBuilderState || parsed;
            if (oldDeck && oldDeck.id === deck.id) {
              await dir.removeEntry(entry.name);
              const oldPngName = entry.name.replace('.json', '.png');
              try { await dir.removeEntry(oldPngName); } catch (e) {}
            }
          } catch(e) {}
        }
      }

      // 2. Generate TTS Export
      const ttsResult = await generateTTSExport(
        deck.cards,
        deck.customCardbackUrl,
        deck.tokens || [],
        deck.isSideDeckEnabled ? (deck.sidedeck || []) : []
      );
      const ttsObj = JSON.parse(ttsResult.json);
      ttsObj.__mtgTtsBuilderState = deck; // Inject state

      // 3. Save JSON
      const fileHandle = await dir.getFileHandle(jsonFileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(ttsObj, null, 2));
      await writable.close();

      // 4. Save PNG cover
      const imageUrl = deck.customCardbackUrl || MTG_CARD_BACK;
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const pngHandle = await dir.getFileHandle(pngFileName, { create: true });
        const pngWritable = await pngHandle.createWritable();
        await pngWritable.write(blob);
        await pngWritable.close();
      } catch (err) {
        console.error('Failed to save deck cover png', err);
      }

      // 5. Cleanup legacy file if it exists
      try {
        const legacyDir = await dir.getDirectoryHandle('Decks');
        if (legacyDir) {
          await legacyDir.removeEntry(`${deck.id}.json`);
        }
      } catch (e) {
        // Ignore
      }
    } catch (err) {
      console.error(`Failed to save deck ${deck.id}:`, err);
    }
  }

  async deleteDeck(deckId: string): Promise<void> {
    const dir = this.directoryHandle;
    if (!dir) return;

    try {
      let foundBaseName = null;
      // @ts-ignore
      for await (const entry of dir.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json') && entry.name !== 'settings.json') {
          try {
            const entryBaseName = entry.name.replace(/\.json$/i, '');
            // 1. Check if the file base name matches the deck ID directly (imported or legacy decks)
            if (entryBaseName === deckId) {
              foundBaseName = entryBaseName;
              break;
            }

            // 2. Check inside the file for the builder state ID
            const handle = await dir.getFileHandle(entry.name);
            const file = await handle.getFile();
            const text = await file.text();
            const parsed = JSON.parse(text);
            const deck: SavedDeck = parsed.__mtgTtsBuilderState || parsed;
            if (deck && (deck.id === deckId || entryBaseName === deckId)) {
              foundBaseName = entryBaseName;
              break;
            }
          } catch(e) {}
        }
      }

      if (foundBaseName) {
        await dir.removeEntry(`${foundBaseName}.json`);
        try { await dir.removeEntry(`${foundBaseName}.png`); } catch(e) {}
      }

      // Cleanup legacy file just in case
      try {
        const legacyDir = await dir.getDirectoryHandle('Decks');
        if (legacyDir) {
          await legacyDir.removeEntry(`${deckId}.json`);
        }
      } catch (e) {
        // Ignore
      }
    } catch (err: any) {
      console.error(`Failed to delete deck ${deckId}:`, err);
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
