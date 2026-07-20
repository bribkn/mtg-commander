const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'lib', 'deck-store.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove Supabase imports
content = content.replace(/import \{ supabase \} from '\.\/supabase';\r?\n/, '');
content = content.replace(/import \{ User \} from '@supabase\/supabase-js';\r?\n/, '');

// 2. Add Storage Manager imports
const storageImports = `import { storageManager, StoragePreference } from './storage/manager';\n`;
content = content.replace(/(import .* from '\.\/scryfall';\r?\n)/, `$1${storageImports}`);

// 3. Replace the entire init function (since it contains old logic that is now handled by adapter)
const initRegex = /function init\(initial: DeckState\): DeckState \{[\s\S]*?return initial;\n\}/;
content = content.replace(initRegex, `function init(initial: DeckState): DeckState {\n  return initial;\n}`);

// 4. Replace DeckContextValue
const contextValueRegex = /interface DeckContextValue \{[\s\S]*?\}/;
const newContextValue = `interface DeckContextValue {
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
}`;
content = content.replace(contextValueRegex, newContextValue);

// 5. Replace DeckProvider body up to the return statement
// Let's find the start of DeckProvider and the return statement
const providerStart = /export function DeckProvider\(\{ children \}: \{ children: ReactNode \}\) \{/;
const returnStatement = /return \(\s*<DeckContext\.Provider/;

const startIdx = content.search(providerStart);
const returnIdx = content.search(returnStatement);

const newProviderBody = `export function DeckProvider({ children }: { children: ReactNode }) {
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

  `;

content = content.substring(0, startIdx) + newProviderBody + content.substring(returnIdx);

// Replace value prop for DeckContext.Provider
const oldProviderValue = /value=\{\{[\s\S]*?\}\}/;
const newProviderValue = `value={{
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
      }}`;
content = content.replace(oldProviderValue, newProviderValue);

fs.writeFileSync(file, content, 'utf8');
console.log('Deck store refactored successfully.');
