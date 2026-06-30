'use client';

import { useState, useCallback } from 'react';
import { Loader2, AlertCircle, Link, FileText, Wand2, CheckCircle2, FileJson } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeck } from '@/lib/deck-store';
import {
  importFromMoxfield,
  importFromArchidekt,
  parseBulkText,
  detectImportSource,
  parseTTSJson,
  ParsedDeckEntry,
} from '@/lib/import';
import {
  getCardsBatch,
  getCardByFuzzyName,
  autocompleteCardName,
  ScryfallCard,
  isToken,
  getCardsBatchByIds,
} from '@/lib/scryfall';

interface FuzzyCorrection {
  original: string;
  suggestions: string[];
  chosen: string | null;
  skip: boolean;
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  /** If true, automatically creates a new deck before importing (used from the dashboard) */
  createNewDeck?: boolean;
  deckId?: string;
}

export function ImportModal({ open, onClose, createNewDeck, deckId }: ImportModalProps) {
  const { dispatch, activeDeckId, customCards } = useDeck();

  // URL import
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');

  // Bulk text import
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');

  // TTS file import
  const [ttsFile, setTtsFile] = useState<File | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const [ttsSuccess, setTtsSuccess] = useState('');

  // Fuzzy correction state
  const [corrections, setCorrections] = useState<FuzzyCorrection[]>([]);
  const [correctionQueue, setCorrectionQueue] = useState<ParsedDeckEntry[]>([]);
  const [currentCorrectionIndex, setCurrentCorrectionIndex] = useState(0);
  const [showCorrections, setShowCorrections] = useState(false);
  const [pendingCards, setPendingCards] = useState<Array<{ card: ScryfallCard; quantity: number; isCommander: boolean }>>([]);
  const [pendingSection, setPendingSection] = useState<'main' | 'side' | 'tokens'>('main');

  // Autocomplete search states inside fuzzy correction
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});
  const [searchResults, setSearchResults] = useState<Record<number, string[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<number, boolean>>({});

  const reset = () => {
    setUrlInput('');
    setUrlError('');
    setBulkText('');
    setBulkError('');
    setBulkSuccess('');
    setTtsFile(null);
    setTtsError('');
    setTtsSuccess('');
    setCorrections([]);
    setCorrectionQueue([]);
    setCurrentCorrectionIndex(0);
    setShowCorrections(false);
    setPendingCards([]);
    setPendingSection('main');
    setSearchQueries({});
    setSearchResults({});
    setSearchLoading({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Process parsed entries: batch-fetch from Scryfall, handle not-found
  const processEntries = useCallback(async (entries: ParsedDeckEntry[], targetSection: 'main' | 'side' | 'tokens' = 'main') => {
    // Deduplicate entries by normalized name + artUrl, prioritizing isCommander: true
    const normalizedEntriesMap = new Map<string, ParsedDeckEntry>();
    for (const entry of entries) {
      const normName = entry.name.trim().toLowerCase().split('//')[0].trim();
      const normKey = entry.artUrl ? `${normName}|${entry.artUrl.trim()}` : normName;
      const existing = normalizedEntriesMap.get(normKey);
      if (!existing) {
        normalizedEntriesMap.set(normKey, { ...entry });
      } else {
        if (entry.isCommander || existing.isCommander) {
          existing.isCommander = true;
          // Keep the commander quantity (usually 1), do not sum the mainboard copy's quantity
          existing.quantity = entry.isCommander ? entry.quantity : existing.quantity;
        } else {
          // Sum quantities for non-commander duplicates (e.g. basic lands)
          existing.quantity += entry.quantity;
        }
      }
    }
    const uniqueEntries = Array.from(normalizedEntriesMap.values());

    const scryfallUuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

    const scryfallIdToEntries = new Map<string, ParsedDeckEntry[]>();
    const nameToEntries = new Map<string, ParsedDeckEntry[]>();

    for (const entry of uniqueEntries) {
      let resolvedId: string | null = null;

      if (entry.artUrl) {
        const isScryfallUrl = entry.artUrl.includes('scryfall.io');
        const uuidMatch = entry.artUrl.match(scryfallUuidRegex);

        if (isScryfallUrl && uuidMatch) {
          resolvedId = uuidMatch[1].toLowerCase();
        } else {
          // Check if custom URL matches a custom card
          const matchedCustom = customCards.find(
            (cc) => cc.imageUrl.trim() === entry.artUrl?.trim()
          );
          if (matchedCustom) {
            resolvedId = matchedCustom.associatedScryfallId.toLowerCase();
          }
        }
      }

      if (resolvedId) {
        const list = scryfallIdToEntries.get(resolvedId) || [];
        list.push(entry);
        scryfallIdToEntries.set(resolvedId, list);
      } else {
        const normName = entry.name.trim().toLowerCase();
        const list = nameToEntries.get(normName) || [];
        list.push(entry);
        nameToEntries.set(normName, list);
      }
    }

    // Fetch cards by ID
    const idToCardMap = new Map<string, ScryfallCard>();
    if (scryfallIdToEntries.size > 0) {
      const fetchedCards = await getCardsBatchByIds(Array.from(scryfallIdToEntries.keys()));
      for (const card of fetchedCards) {
        idToCardMap.set(card.id.toLowerCase(), card);
      }
    }

    // Fetch cards by Name
    const nameToFetchSet = new Set<string>();
    for (const normName of nameToEntries.keys()) {
      const entriesList = nameToEntries.get(normName) || [];
      if (entriesList.length > 0) {
        nameToFetchSet.add(entriesList[0].name);
      }
    }
    // Fall back to fetching by name for any ID lookups that failed
    for (const [id, entriesList] of scryfallIdToEntries.entries()) {
      if (!idToCardMap.has(id)) {
        for (const entry of entriesList) {
          nameToFetchSet.add(entry.name);
          const normName = entry.name.trim().toLowerCase();
          const list = nameToEntries.get(normName) || [];
          if (!list.includes(entry)) {
            list.push(entry);
            nameToEntries.set(normName, list);
          }
        }
      }
    }

    const nameToCardMap = new Map<string, ScryfallCard>();
    const notFoundNamesSet = new Set<string>();

    if (nameToFetchSet.size > 0) {
      const { found, notFound } = await getCardsBatch(Array.from(nameToFetchSet));
      for (const card of found) {
        nameToCardMap.set(card.name.toLowerCase(), card);
        const frontName = card.name.split('//')[0].trim().toLowerCase();
        nameToCardMap.set(frontName, card);
      }
      for (const nf of notFound) {
        if (typeof nf === 'string') {
          notFoundNamesSet.add(nf.toLowerCase());
          notFoundNamesSet.add(nf.split('//')[0].trim().toLowerCase());
        }
      }
    }

    const resolvedCards: Array<{ card: ScryfallCard; quantity: number; isCommander: boolean }> = [];
    const needsFuzzy: ParsedDeckEntry[] = [];

    for (const entry of uniqueEntries) {
      let resolvedCard: ScryfallCard | undefined = undefined;
      let hasIdMatch = false;

      if (entry.artUrl) {
        const uuidMatch = entry.artUrl.match(scryfallUuidRegex);
        const isScryfallUrl = entry.artUrl.includes('scryfall.io');
        if (isScryfallUrl && uuidMatch) {
          const id = uuidMatch[1].toLowerCase();
          resolvedCard = idToCardMap.get(id);
          if (resolvedCard) {
            hasIdMatch = true;
          }
        } else {
          // Custom URL matching
          const matchedCustom = customCards.find(
            (cc) => cc.imageUrl.trim() === entry.artUrl?.trim()
          );
          if (matchedCustom) {
            const id = matchedCustom.associatedScryfallId.toLowerCase();
            const scryfallCard = idToCardMap.get(id);
            if (scryfallCard) {
              hasIdMatch = true;
              // Override ScryfallCard images with custom URL
              resolvedCard = {
                ...scryfallCard,
                image_uris: {
                  ...scryfallCard.image_uris,
                  small: entry.artUrl,
                  normal: entry.artUrl,
                  large: entry.artUrl,
                  png: entry.artUrl,
                  art_crop: entry.artUrl,
                },
                card_faces: scryfallCard.card_faces?.map((face, index) =>
                  index === 0
                    ? {
                        ...face,
                        image_uris: {
                          ...face.image_uris,
                          small: entry.artUrl,
                          normal: entry.artUrl,
                          large: entry.artUrl,
                          png: entry.artUrl,
                          art_crop: entry.artUrl,
                        },
                      }
                    : face
                ),
              };
            }
          }
        }
      }

      // Verify that if we resolved by ID, the name matches (case-insensitive) to prevent mismatches
      if (resolvedCard && hasIdMatch && entry.artUrl?.includes('scryfall.io')) {
        const importedNameNorm = entry.name.toLowerCase().trim().split('//')[0].trim();
        const scryfallNameNorm = resolvedCard.name.toLowerCase().trim().split('//')[0].trim();
        if (importedNameNorm !== scryfallNameNorm) {
          resolvedCard = undefined;
        }
      }

      // If ID resolution failed or was mismatched, resolve by name
      if (!resolvedCard) {
        const lower = entry.name.toLowerCase().trim();
        const norm = entry.name.trim().toLowerCase().split('//')[0].trim();
        resolvedCard = nameToCardMap.get(lower) || nameToCardMap.get(norm);
      }

      if (resolvedCard) {
        if (isToken(resolvedCard)) {
          if (targetSection !== 'tokens') {
            continue;
          }
        }

        resolvedCards.push({
          card: resolvedCard,
          quantity: entry.quantity,
          isCommander: entry.isCommander ?? false,
        });
      } else {
        // Check if it's in notFound
        const lower = entry.name.toLowerCase().trim();
        const norm = entry.name.trim().toLowerCase().split('//')[0].trim();
        const isNotFound = notFoundNamesSet.has(lower) || notFoundNamesSet.has(norm);
        if (isNotFound || (!nameToCardMap.has(lower) && !nameToCardMap.has(norm))) {
          needsFuzzy.push(entry);
        }
      }
    }

    if (needsFuzzy.length === 0) {
      // Final dedup by Scryfall card ID
      const deduped = new Map<string, { card: ScryfallCard; quantity: number; isCommander: boolean }>();
      for (const entry of resolvedCards) {
        const existing = deduped.get(entry.card.id);
        if (!existing) {
          deduped.set(entry.card.id, { ...entry });
        } else {
          if (entry.isCommander) existing.isCommander = true;
          if (entry.isCommander || existing.isCommander) {
            existing.quantity = 1;
          } else {
            existing.quantity = Math.max(existing.quantity, entry.quantity);
          }
        }
      }
      dispatch({ type: 'BULK_ADD_CARDS', cards: Array.from(deduped.values()), deckId, targetSection });
      return { addedCount: deduped.size, fuzzyNeeded: 0 };
    }

    // Start fuzzy correction flow
    setPendingSection(targetSection);
    setPendingCards(resolvedCards);
    setCorrectionQueue(needsFuzzy);
    setCurrentCorrectionIndex(0);

    // Pre-fetch suggestions for all bad names
    const correctionEntries: FuzzyCorrection[] = await Promise.all(
      needsFuzzy.map(async (entry) => {
        const suggestions = await autocompleteCardName(entry.name);
        return { original: entry.name, suggestions: suggestions.slice(0, 5), chosen: null, skip: false };
      })
    );
    setCorrections(correctionEntries);
    setShowCorrections(true);

    return { addedCount: resolvedCards.length, fuzzyNeeded: needsFuzzy.length };
  }, [dispatch, customCards]);

  // Ensure there is an active deck to import into; creates one if createNewDeck is set
  function ensureActiveDeck(name?: string) {
    if (createNewDeck && !activeDeckId) {
      dispatch({ type: 'CREATE_DECK', name: name || 'Imported Deck', id: `deck-${Date.now()}` });
    }
  }

  // URL import handler
  async function handleUrlImport() {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    setUrlError('');
    try {
      const source = detectImportSource(urlInput);
      let entries: ParsedDeckEntry[];
      if (source === 'moxfield') {
        entries = await importFromMoxfield(urlInput);
      } else if (source === 'archidekt') {
        entries = await importFromArchidekt(urlInput);
      } else {
        throw new Error('Unsupported URL. Please use a Moxfield or Archidekt deck URL.');
      }
      ensureActiveDeck();
      const { addedCount, fuzzyNeeded } = await processEntries(entries);
      if (fuzzyNeeded === 0) {
        setBulkSuccess(`Added ${addedCount} cards to your deck.`);
        setTimeout(() => handleClose(), 1500);
      }
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to import deck.');
    } finally {
      setUrlLoading(false);
    }
  }

  // Bulk text import handler
  async function handleBulkImport() {
    if (!bulkText.trim()) return;
    setBulkLoading(true);
    setBulkError('');
    setBulkSuccess('');
    try {
      const entries = parseBulkText(bulkText);
      if (entries.length === 0) {
        setBulkError('No cards found. Please check the format.');
        return;
      }
      ensureActiveDeck();
      const { addedCount, fuzzyNeeded } = await processEntries(entries);
      if (fuzzyNeeded === 0) {
        setBulkSuccess(`Successfully added ${addedCount} cards!`);
        setTimeout(() => handleClose(), 1500);
      }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBulkLoading(false);
    }
  }

  // TTS JSON import handler
  async function handleTtsImport() {
    if (!ttsFile) return;
    setTtsLoading(true);
    setTtsError('');
    setTtsSuccess('');
    try {
      const text = await ttsFile.text();
      const { cards, sidedeck } = parseTTSJson(text);
      if (cards.length === 0 && sidedeck.length === 0) {
        setTtsError('No deck or sidedeck cards found in the Tabletop Simulator file.');
        return;
      }
      // Derive deck name from the filename (strip extension)
      const deckName = ttsFile.name.replace(/\.json$/i, '').trim() || 'Imported Deck';
      ensureActiveDeck(deckName);

      if (sidedeck.length > 0) {
        dispatch({ type: 'SET_SIDEDECK_ENABLED', enabled: true });
      }

      let totalAdded = 0;
      let fuzzyTotal = 0;

      if (cards.length > 0) {
        const { addedCount, fuzzyNeeded } = await processEntries(cards, 'main');
        totalAdded += addedCount;
        fuzzyTotal += fuzzyNeeded;
      }

      if (sidedeck.length > 0) {
        const { addedCount, fuzzyNeeded } = await processEntries(sidedeck, 'side');
        totalAdded += addedCount;
        fuzzyTotal += fuzzyNeeded;
      }

      if (fuzzyTotal === 0) {
        setTtsSuccess(`Successfully imported ${totalAdded} cards (including sidedeck) from TTS file!`);
        setTimeout(() => handleClose(), 1500);
      }
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : 'TTS import failed.');
    } finally {
      setTtsLoading(false);
    }
  }

  // Live autocomplete search inside correction items
  const handleSearchChange = async (index: number, query: string) => {
    setSearchQueries((prev) => ({ ...prev, [index]: query }));

    if (query.trim().length < 2) {
      setSearchResults((prev) => ({ ...prev, [index]: [] }));
      return;
    }

    setSearchLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const results = await autocompleteCardName(query);
      setSearchResults((prev) => ({ ...prev, [index]: results.slice(0, 8) }));
    } catch {
      setSearchResults((prev) => ({ ...prev, [index]: [] }));
    } finally {
      setSearchLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  // Fuzzy correction: apply chosen correction
  async function applyCorrections() {
    const extraCards: Array<{ card: ScryfallCard; quantity: number; isCommander: boolean }> = [];

    for (let i = 0; i < corrections.length; i++) {
      const correction = corrections[i];
      const entry = correctionQueue[i];
      if (correction.skip || !correction.chosen) continue;

      const card = await getCardByFuzzyName(correction.chosen);
      if (card) {
        // Skip tokens from fuzzy corrections as well
        if (isToken(card)) continue;

        extraCards.push({
          card,
          quantity: entry.quantity,
          isCommander: entry.isCommander ?? false,
        });
      }
    }

    const allCards = [...pendingCards, ...extraCards];
    dispatch({ type: 'BULK_ADD_CARDS', cards: allCards, deckId, targetSection: pendingSection });
    handleClose();
  }

  function setChosen(index: number, name: string) {
    setCorrections((prev) =>
      prev.map((c, i) => (i === index ? { ...c, chosen: name, skip: false } : c))
    );
  }

  function setSkip(index: number) {
    setCorrections((prev) =>
      prev.map((c, i) => (i === index ? { ...c, skip: true, chosen: null } : c))
    );
  }

  // ── Fuzzy correction UI ──────────────────────────────────────────────────
  if (showCorrections) {
    const allResolved = corrections.every((c) => c.chosen !== null || c.skip);
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg w-full bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Card Name Corrections
            </DialogTitle>
            <DialogDescription>
              {corrections.length} card name(s) weren't found. Select the correct name or skip.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {corrections.map((correction, i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Not found:</p>
                    <p className="text-sm font-medium text-destructive line-through">
                      {correction.original}
                    </p>
                  </div>
                  {(correction.chosen || correction.skip) && (
                    <CheckCircle2 className="w-4 h-4 text-primary mt-1 shrink-0" />
                  )}
                </div>

                <div className="space-y-2">
                  {correction.suggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {correction.suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => setChosen(i, s)}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                            correction.chosen === s
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-foreground hover:border-primary/50 hover:bg-secondary'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                      <button
                        onClick={() => setSkip(i)}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                          correction.skip
                            ? 'bg-muted text-muted-foreground border-muted'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Skip
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-yellow-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        No suggestions found
                      </p>
                      <button
                        onClick={() => setSkip(i)}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                          correction.skip
                            ? 'bg-muted text-muted-foreground border-muted'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Skip Card
                      </button>
                    </div>
                  )}

                  {/* Autocomplete Search input fallback */}
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <div className="relative">
                      <Input
                        value={searchQueries[i] ?? ''}
                        onChange={(e) => handleSearchChange(i, e.target.value)}
                        placeholder={correction.suggestions.length > 0 ? "Or search another card name..." : "Search card name..."}
                        className="w-full bg-secondary/50 border-border focus:border-primary/50 text-xs py-1 h-8 pr-8"
                        autoComplete="off"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {searchLoading[i] && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                      </div>
                    </div>

                    {/* Autocomplete list dropdown */}
                    {(searchResults[i] ?? []).length > 0 && (
                      <div className="border border-border rounded-lg bg-popover max-h-[140px] overflow-y-auto mt-1 shadow-lg divide-y divide-border/60">
                        {(searchResults[i] ?? []).map((name) => (
                          <button
                            key={name}
                            onClick={() => setChosen(i, name)}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-foreground flex items-center justify-between ${
                              correction.chosen === name ? 'bg-primary/10 text-primary font-medium' : ''
                            }`}
                          >
                            <span>{name}</span>
                            {correction.chosen === name && (
                              <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
                                Selected
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Show selected manual search choice if not in suggested list */}
                    {correction.chosen && !correction.suggestions.includes(correction.chosen) && !(searchResults[i] ?? []).includes(correction.chosen) && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/5 p-1 rounded border border-primary/10">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">Selected: <strong className="text-foreground">{correction.chosen}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={applyCorrections}
              disabled={!allResolved}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Apply & Add {pendingCards.length + corrections.filter((c) => c.chosen).length} Cards
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Main import UI ────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg w-full bg-card border-border">
        <DialogHeader>
          <DialogTitle>Import Cards</DialogTitle>
          <DialogDescription>
            Import from a deck URL or paste your card list.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList className="w-full bg-secondary">
            <TabsTrigger value="url" className="flex-1 gap-2">
              <Link className="w-4 h-4" />
              URL Import
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex-1 gap-2">
              <FileText className="w-4 h-4" />
              Bulk Text
            </TabsTrigger>
            <TabsTrigger value="tts" className="flex-1 gap-2">
              <FileJson className="w-4 h-4" />
              TTS JSON
            </TabsTrigger>
          </TabsList>

          {/* URL Import */}
          <TabsContent value="url" className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Paste a deck URL from Archidekt:
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs border-border">Archidekt</Badge>
              </div>
              <Input
                id="url-import-input"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://archidekt.com/decks/..."
                className="bg-secondary border-border focus:border-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
              />
            </div>

            {urlError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{urlError}</p>
              </div>
            )}

            <Button
              onClick={handleUrlImport}
              disabled={urlLoading || !urlInput.trim()}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {urlLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
              ) : (
                'Import Deck'
              )}
            </Button>
          </TabsContent>

          {/* Bulk Text */}
          <TabsContent value="bulk" className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                One card per line. Supports: <code className="text-primary">1 Sol Ring</code>,{' '}
                <code className="text-primary">4x Island</code>, MTGO/Arena export format.
              </p>
              <p className="text-xs text-muted-foreground">
                Add a <code className="text-primary">Commander:</code> section header to mark your commander.
              </p>
              <Textarea
                id="bulk-text-input"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Commander:\n1 Alania, Divergent Storm\n\nDeck:\n1 Sol Ring\n1 Command Tower\n7 Island\n6 Mountain\n...'}
                className="bg-secondary border-border focus:border-primary/50 h-[300px] max-h-[300px] overflow-y-auto font-mono text-sm resize-none"
              />
            </div>

            {bulkError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{bulkError}</p>
              </div>
            )}

            {bulkSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p>{bulkSuccess}</p>
              </div>
            )}

            <Button
              onClick={handleBulkImport}
              disabled={bulkLoading || !bulkText.trim()}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {bulkLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              ) : (
                'Import Cards'
              )}
            </Button>
          </TabsContent>

          {/* TTS JSON File Upload */}
          <TabsContent value="tts" className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Upload a Tabletop Simulator JSON deck file (`.json`) exported from this builder or other TTS systems:
              </p>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/80 rounded-xl p-8 bg-secondary/15 hover:bg-secondary/25 hover:border-primary/50 transition-colors cursor-pointer relative group">
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setTtsFile(file);
                    setTtsError('');
                    setTtsSuccess('');
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileJson className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                <span className="text-xs font-semibold text-foreground">
                  {ttsFile ? ttsFile.name : 'Click to select or drag JSON file'}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Supports .json files
                </span>
              </div>
            </div>

            {ttsError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{ttsError}</p>
              </div>
            )}

            {ttsSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p>{ttsSuccess}</p>
              </div>
            )}

            <Button
              onClick={handleTtsImport}
              disabled={ttsLoading || !ttsFile}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {ttsLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
              ) : (
                'Import from TTS File'
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
