import type { StorageAdapter } from './types';
import { LocalStorageAdapter } from './local-storage-adapter';
import { FileSystemAdapter } from './file-system-adapter';

export type StoragePreference = 'local' | 'folder' | null;

const PREFERENCE_KEY = 'mtg-tts-storage-preference';

export class StorageManager {
  private static instance: StorageManager;
  private adapter: StorageAdapter | null = null;
  private preference: StoragePreference = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.preference = (localStorage.getItem(PREFERENCE_KEY) as StoragePreference) || null;
      this._initAdapter();
    }
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  private _initAdapter() {
    if (this.preference === 'folder') {
      this.adapter = new FileSystemAdapter();
    } else if (this.preference === 'local') {
      this.adapter = new LocalStorageAdapter();
    } else {
      this.adapter = null;
    }
  }

  public getPreference(): StoragePreference {
    return this.preference;
  }

  public async setPreference(pref: StoragePreference): Promise<boolean> {
    if (pref === 'folder') {
      const fsAdapter = new FileSystemAdapter();
      const success = await fsAdapter.requestDirectoryAccess();
      if (!success) {
        return false;
      }
      this.adapter = fsAdapter;
    } else if (pref === 'local') {
      this.adapter = new LocalStorageAdapter();
    } else {
      this.adapter = null;
    }

    this.preference = pref;
    if (pref) {
      localStorage.setItem(PREFERENCE_KEY, pref);
    } else {
      localStorage.removeItem(PREFERENCE_KEY);
    }
    
    if (this.adapter) {
      await this.adapter.init();
    }
    
    return true;
  }

  public getAdapter(): StorageAdapter | null {
    return this.adapter;
  }
}

// Export a singleton instance helper
export const storageManager = StorageManager.getInstance();
