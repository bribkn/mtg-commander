'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DeckProvider, useDeck } from '@/lib/deck-store';
import { storageManager } from '@/lib/storage/manager';
import { DeckHeader } from '@/components/DeckHeader';
import { CardSearchBar } from '@/components/CardSearchBar';
import { CardList } from '@/components/CardList';
import { ImportModal } from '@/components/ImportModal';
import { CardbackModal } from '@/components/CardbackModal';
import { SearchSidebar } from '@/components/SearchSidebar';
import { StatsPanel } from '@/components/StatsPanel';
import { DeckDashboard } from '@/components/DeckDashboard';
import { StorageOnboardingModal } from '@/components/StorageOnboardingModal';
import { CustomCardsModal } from '@/components/CustomCardsModal';
import { CombosModal } from '@/components/CombosModal';
import { ShareBannerModal } from '@/components/ShareBannerModal';
import { ExportModal } from '@/components/ExportModal';
import { getCardsBatchByIds } from '@/lib/scryfall';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Pencil, Check, Crown, Columns, ArrowRightLeft, Minimize2, Trash2, ArrowLeft, Flame, ImageIcon, Tag, Search, Plus, X, Share2, Layers } from 'lucide-react';
import { DECK_TAGS_LIST } from '@/lib/tags';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function DeckNameEditor({ deckId }: { deckId?: string } = {}) {
  const { state: globalState, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(state?.deckName || '');

  useEffect(() => {
    if (state) {
      setValue(state.deckName);
    }
  }, [state?.deckName, deckId]);

  function save() {
    dispatch({ type: 'SET_DECK_NAME', name: value.trim() || 'New Commander Deck', deckId });
    setEditing(false);
  }

  if (!state) return null;

  if (editing) {
    return (
      <div className="flex items-center gap-2 max-w-xl animate-fade-in-up">
        <Input
          id={`deck-name-input-${deckId || 'main'}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-9 text-xl font-bold bg-black/60 border-primary/50 focus:border-primary text-white"
          autoFocus
        />
        <button
          onClick={save}
          className="p-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all shrink-0"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setValue(state.deckName);
        setEditing(true);
      }}
      className="flex items-center gap-3 group text-left max-w-fit"
    >
      <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:text-primary transition-colors truncate">
        {state.deckName}
      </h2>
      <Pencil className="w-4 h-4 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
    </button>
  );
}

function DeckTagsEditor({ deckId }: { deckId?: string } = {}) {
  const { state: globalState, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  if (!state) return null;

  const currentTags = state.tags || [];

  const filteredTags = DECK_TAGS_LIST.filter((tag) =>
    tag.toLowerCase().includes(search.toLowerCase())
  );

  function toggleTag(tag: string) {
    let nextTags: string[];
    if (currentTags.includes(tag)) {
      nextTags = currentTags.filter((t) => t !== tag);
    } else {
      nextTags = [...currentTags, tag];
    }
    dispatch({ type: 'SET_DECK_TAGS', tags: nextTags, deckId });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mt-1 animate-fade-in-up">
        {currentTags.length === 0 ? (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-white/40 hover:border-white text-[10px] font-semibold text-white/60 hover:text-white transition-all bg-black/30 backdrop-blur-sm"
          >
            <Tag className="w-2.5 h-2.5" />
            <span>Add Tags</span>
          </button>
        ) : (
          <>
            {currentTags.slice(0, 5).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="bg-primary/10 border-primary/30 text-white font-semibold text-[10px] px-2 py-0.5 rounded-full shadow-sm"
              >
                {tag}
              </Badge>
            ))}
            {currentTags.length > 5 && (
              <Badge
                variant="outline"
                className="bg-black/40 border-border/40 text-white/80 font-medium text-[10px] px-1.5 py-0.5 rounded-full"
              >
                +{currentTags.length - 5}
              </Badge>
            )}
            <button
              onClick={() => setOpen(true)}
              className="p-1 rounded-full bg-black/40 hover:bg-secondary border border-border/40 text-white/60 hover:text-white transition-colors"
              title="Edit Tags"
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-card border-border shadow-2xl flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Tag className="w-5 h-5 text-primary" />
              Manage Deck Tags
            </DialogTitle>
            <DialogDescription>
              Select personal tags for this deck from the list below.
            </DialogDescription>
          </DialogHeader>

          {/* Selected tags summary */}
          <div className="overflow-y-auto max-h-20 border border-border/40 rounded-lg bg-secondary/30 p-2 min-h-11 custom-scrollbar flex">
            <div className="flex flex-wrap gap-1.5 w-full items-center">
              {currentTags.length === 0 ? (
                <span className="text-xs text-muted-foreground px-1.5 py-1">No tags selected. Click tags below to add them.</span>
              ) : (
                currentTags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-primary text-primary-foreground font-semibold text-xs px-2.5 py-0.5 rounded-full gap-1 flex items-center hover:bg-primary/90 cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                    <X className="w-3.5 h-3.5 shrink-0" />
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative mt-2">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search available tags..."
              className="pl-9 h-9 bg-secondary border-border focus:border-primary/50 text-sm text-foreground"
            />
          </div>

          {/* Tag Grid Scroll Area */}
          <div className="flex-1 min-h-[250px] max-h-[350px] overflow-y-auto custom-scrollbar border border-border/40 rounded-lg bg-secondary/10 p-2 mt-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {filteredTags.map((tag) => {
                const isActive = currentTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all truncate flex items-center justify-between ${
                      isActive
                        ? 'bg-primary/20 border-primary text-white font-bold'
                        : 'border-border/60 text-muted-foreground hover:border-primary/30 hover:bg-secondary/40 hover:text-foreground'
                    }`}
                  >
                    <span>{tag}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                  </button>
                );
              })}
              {filteredTags.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                  No tags found matching "{search}"
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-3 mt-auto">
            <Button
              onClick={() => setOpen(false)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AppContent() {
  const { state, activeDeckId, decks, dispatch } = useDeck();
  const [importOpen, setImportOpen] = useState(false);
  const [cardbackOpen, setCardbackOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [combosOpen, setCombosOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTargetDeckId, setExportTargetDeckId] = useState<string | undefined>(undefined);
  const [sidebarMode, setSidebarMode] = useState<'stats' | 'search'>('stats');
  const [deckLoading, setDeckLoading] = useState(false);

  // Target deck ID for modals
  const [modalTargetDeckId, setModalTargetDeckId] = useState<string | undefined>(undefined);

  function openCombos(deckId?: string) {
    setModalTargetDeckId(deckId);
    setCombosOpen(true);
  }

  function openShare(deckId?: string) {
    setModalTargetDeckId(deckId);
    setShareOpen(true);
  }

  function openExport(deckId?: string) {
    setExportTargetDeckId(deckId);
    setExportOpen(true);
  }

  // Split view states
  const [splitMode, setSplitMode] = useState(false);
  const [leftDeckId, setLeftDeckId] = useState<string | null>(null);
  const [rightDeckId, setRightDeckId] = useState<string | null>(null);
  const [leftStatsOpen, setLeftStatsOpen] = useState(false);
  const [rightStatsOpen, setRightStatsOpen] = useState(false);

  // Helper to extract banner background art (Prioritizes coverCardId, falls back to commander) - bypasses WebM video formats
  function getBannerArtForDeck(deck: any): string {
    if (deck?.coverCardId) {
      const cover = deck.cards.find((c: any) => c.scryfallId === deck.coverCardId);
      if (cover?.scryfallData) {
        const data = cover.scryfallData;
        const id = cover.scryfallId;
        const art = data.image_uris?.art_crop || data.card_faces?.[0]?.image_uris?.art_crop || data.image_uris?.normal || '';
        if (art.endsWith('.webm') || art.includes('.webm') || art.includes('catbox.moe') || art.includes('pixeldrain.com') || art.includes('ufs.sh') || art.includes('utfs.io')) {
          return `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
        }
        if (art) return art;
      }
    }
    if (deck?.commanderId) {
      const commanderCard = deck.cards.find((c: any) => c.scryfallId === deck.commanderId);
      if (commanderCard?.scryfallData) {
        const data = commanderCard.scryfallData;
        const id = commanderCard.scryfallId;
        const art = data.image_uris?.art_crop || data.card_faces?.[0]?.image_uris?.art_crop || data.image_uris?.normal || '';
        if (art.endsWith('.webm') || art.includes('.webm') || art.includes('catbox.moe') || art.includes('pixeldrain.com') || art.includes('ufs.sh') || art.includes('utfs.io')) {
          return `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
        }
        if (art) return art;
      }
    }
    // Default MTG card back crop
    return 'https://i.pinimg.com/736x/7e/be/a3/7ebea35ad91c8ee201b0647a7c0d816b.jpg';
  }

  function getCommanderForDeck(deck: any): any {
    if (!deck) return null;
    return deck.cards.find((c: any) => c.isCommander) ?? null;
  }

  // Export modal trigger is openExport

  function handleClearDeck(deckId?: string) {
    const targetId = deckId || activeDeckId;
    if (!targetId) return;
    const targetDeck = decks.find((d) => d.id === targetId);
    if (!targetDeck || targetDeck.cards.length === 0) return;
    if (confirm(`Clear the entire deck "${targetDeck.deckName}"? This cannot be undone.`)) {
      dispatch({ type: 'CLEAR_DECK', deckId: targetId });
    }
  }

  function openImport(deckId?: string) {
    setModalTargetDeckId(deckId);
    setImportOpen(true);
  }

  function openCardback(deckId?: string) {
    setModalTargetDeckId(deckId);
    setCardbackOpen(true);
  }

  function handleOpenSplit(deckId: string) {
    // Open this deck globally so we are in the editor view
    dispatch({ type: 'OPEN_DECK', deckId });
    setLeftDeckId(deckId);
    // Find first other deck
    const other = decks.find((d) => d.id !== deckId);
    setRightDeckId(other ? other.id : null);
    setSplitMode(true);
  }

  // Handle deck selection in split view dropdowns
  function handleSelectDeck(side: 'left' | 'right', val: string) {
    if (val === 'new') {
      const newId = `deck-${Date.now()}`;
      dispatch({ type: 'CREATE_DECK', name: 'New Commander Deck', id: newId });
      if (side === 'left') {
        setLeftDeckId(newId);
      } else {
        setRightDeckId(newId);
      }
    } else {
      if (side === 'left') {
        setLeftDeckId(val);
      } else {
        setRightDeckId(val);
      }
    }
  }

  // Transfer card copy or move between panels
  function handleTransferCard(card: any, mode: 'copy' | 'move', sourceDeckId: string) {
    const destinationDeckId = sourceDeckId === leftDeckId ? rightDeckId : leftDeckId;
    if (!destinationDeckId) {
      alert('Please select a destination deck first in the other panel.');
      return;
    }

    dispatch({
      type: 'ADD_CARD',
      card: card.scryfallData,
      quantity: card.quantity,
      deckId: destinationDeckId,
    });

    if (mode === 'move') {
      dispatch({
        type: 'REMOVE_CARD',
        scryfallId: card.scryfallId,
        deckId: sourceDeckId,
      });
    }
  }

  // Lazy loading full deck details
  useEffect(() => {
    async function checkLazyLoad() {
      if (activeDeckId) {
        const currentDeck = decks.find((d) => d.id === activeDeckId);
        if (currentDeck && currentDeck.needsFullLoad) {
          setDeckLoading(true);
          const adapter = storageManager.getAdapter();
          if (adapter && adapter.loadFullDeck) {
            const fullyLoaded = await adapter.loadFullDeck(currentDeck);
            if (fullyLoaded) {
              dispatch({ type: 'UPDATE_LOADED_DECK', deck: fullyLoaded });
            }
          }
          setDeckLoading(false);
        }
      }
    }
    checkLazyLoad();
  }, [activeDeckId, decks, dispatch]);

  // Auto-fetch and sync referenced tokens in the background
  useEffect(() => {
    // Determine target deck
    const currentDeck = activeDeckId ? (decks.find((d) => d.id === activeDeckId) ?? null) : state;
    if (!currentDeck) return;

    // Scan all parts of main cards and sidedeck cards for tokens
    const referencedTokenIds = new Set<string>();
    const allDeckCards = [...currentDeck.cards, ...(currentDeck.sidedeck || [])];
    for (const dc of allDeckCards) {
      const parts = dc.scryfallData.all_parts ?? [];
      for (const part of parts) {
        if (part.component === 'token') {
          referencedTokenIds.add(part.id);
        }
      }
    }

    const currentTokenIds = new Set((currentDeck.tokens || []).map((t) => t.scryfallId));

    // Find what to add and what to remove
    const idsToFetch = Array.from(referencedTokenIds).filter((id) => !currentTokenIds.has(id));
    const idsToRemove = Array.from(currentTokenIds).filter((id) => !referencedTokenIds.has(id));

    const syncTokens = async () => {
      // 1. Fetch and add missing tokens
      if (idsToFetch.length > 0) {
        const fetchedCards = await getCardsBatchByIds(idsToFetch);
        if (fetchedCards.length > 0) {
          dispatch({
            type: 'BULK_ADD_CARDS',
            cards: fetchedCards.map((card) => ({ card, quantity: 1 })),
            targetSection: 'tokens',
            deckId: currentDeck.id,
          });
        }
      }

      // 2. Clean up unreferenced tokens
      if (idsToRemove.length > 0) {
        for (const scryfallId of idsToRemove) {
          dispatch({
            type: 'REMOVE_CARD',
            scryfallId,
            targetSection: 'tokens',
            deckId: currentDeck.id,
          });
        }
      }
    };

    if (idsToFetch.length > 0 || idsToRemove.length > 0) {
      syncTokens();
    }
  }, [
    activeDeckId,
    state?.id,
    JSON.stringify(state?.cards.map(c => `${c.scryfallId}-${c.quantity}`)),
    JSON.stringify(state?.sidedeck?.map(c => `${c.scryfallId}-${c.quantity}`))
  ]);

  // Render modal components (Shared single instance to prevent layout unmount/remount issues)
  const modals = (
    <>
      <ImportModal
        open={importOpen}
        onClose={() => { setImportOpen(false); setModalTargetDeckId(undefined); }}
        createNewDeck={!activeDeckId}
        deckId={modalTargetDeckId}
      />
      <CardbackModal
        open={cardbackOpen}
        onClose={() => { setCardbackOpen(false); setModalTargetDeckId(undefined); }}
        deckId={modalTargetDeckId}
      />
      <CustomCardsModal open={customOpen} onClose={() => setCustomOpen(false)} />
      <CombosModal
        open={combosOpen}
        onClose={() => { setCombosOpen(false); setModalTargetDeckId(undefined); }}
        deckId={modalTargetDeckId}
      />
      <ShareBannerModal
        open={shareOpen}
        onClose={() => { setShareOpen(false); setModalTargetDeckId(undefined); }}
        deckId={modalTargetDeckId}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => { setExportOpen(false); setExportTargetDeckId(undefined); }}
        deckId={exportTargetDeckId}
      />
    </>
  );

  // 1. Dashboard View
  if (!splitMode && (!state || !activeDeckId)) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <DeckDashboard onOpenSplit={handleOpenSplit} onShareOpen={openShare} />
        <StorageOnboardingModal />
        {modals}
      </div>
    );
  }

  // 2. Split Screen View
  if (splitMode) {
    const leftDeck = decks.find((d) => d.id === leftDeckId) || null;
    const rightDeck = decks.find((d) => d.id === rightDeckId) || null;

    const leftTotalQty = leftDeck ? leftDeck.cards.reduce((sum, c) => sum + c.quantity, 0) : 0;
    const rightTotalQty = rightDeck ? rightDeck.cards.reduce((sum, c) => sum + c.quantity, 0) : 0;

    const leftCommander = getCommanderForDeck(leftDeck);
    const rightCommander = getCommanderForDeck(rightDeck);

    return (
      <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
        {/* Split Screen Top Controls Bar */}
        <header className="border-b border-border glass-panel sticky top-0 z-40 bg-background/80 backdrop-blur-md shrink-0">
          <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSplitMode(false);
                dispatch({ type: 'CLOSE_DECK' });
              }}
              className="gap-1 px-2.5 h-9 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/40 shrink-0"
              title="Back to Decks Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Dashboard</span>
            </Button>

            {/* Middle Dropdown selectors + Swap */}
            <div className="flex items-center gap-2 max-w-full">
              {/* Left Deck Selector */}
              <select
                value={leftDeckId || ''}
                onChange={(e) => handleSelectDeck('left', e.target.value)}
                className="bg-secondary/80 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:border-primary/50 outline-none w-[130px] sm:w-[200px] font-medium cursor-pointer truncate"
              >
                <option value="" disabled>Select Left Deck</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>{d.deckName}</option>
                ))}
                <option value="new">+ Create New Deck</option>
              </select>

              {/* Swap Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const temp = leftDeckId;
                  setLeftDeckId(rightDeckId);
                  setRightDeckId(temp);
                }}
                className="w-8 h-8 border border-border/40 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors shrink-0"
                title="Swap Left and Right Decks"
              >
                <ArrowRightLeft className="w-4 h-4 text-primary" />
              </Button>

              {/* Right Deck Selector */}
              <select
                value={rightDeckId || ''}
                onChange={(e) => handleSelectDeck('right', e.target.value)}
                className="bg-secondary/80 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:border-primary/50 outline-none w-[130px] sm:w-[200px] font-medium cursor-pointer truncate"
              >
                <option value="" disabled>Select Right Deck</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>{d.deckName}</option>
                ))}
                <option value="new">+ Create New Deck</option>
              </select>
            </div>

            {/* Exit Split View Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (leftDeckId) {
                  dispatch({ type: 'OPEN_DECK', deckId: leftDeckId });
                }
                setSplitMode(false);
              }}
              className="gap-1.5 text-xs text-muted-foreground border-border hover:border-primary/50 hover:text-primary transition-colors shrink-0 h-9"
              title="Close split screen and view left deck"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit Split</span>
            </Button>
          </div>
        </header>

        {/* Side-by-Side Double Panel Area */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-hidden h-full max-h-full">
          {/* LEFT PANEL */}
          <div className="flex flex-col border border-border/60 rounded-xl bg-card/10 overflow-hidden h-full max-h-full glass-panel">
            {leftDeck ? (
              <>
                {/* local banner */}
                <div className="relative w-full h-24 shrink-0 border-b border-border flex flex-col justify-end p-4 select-none overflow-hidden group">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 scale-105 group-hover:scale-[1.07]"
                    style={{ backgroundImage: `url(${getBannerArtForDeck(leftDeck)})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/30" />
                  <div className="absolute inset-0 bg-black/15" />
                  <div className="relative z-10 flex items-end justify-between w-full">
                    <div className="min-w-0 pr-2">
                      <DeckNameEditor deckId={leftDeck.id} />
                      {leftCommander && (
                        <p className="text-[10px] text-white/80 font-medium flex items-center gap-1 mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate">
                          <Crown className="w-3 h-3 text-primary shrink-0" />
                          <span>{leftCommander.name}</span>
                        </p>
                      )}
                      <DeckTagsEditor deckId={leftDeck.id} />
                    </div>
                    <Badge
                      variant={leftTotalQty === 100 ? 'default' : 'outline'}
                      className={`${
                        leftTotalQty === 100
                          ? 'bg-primary text-primary-foreground border-primary'
                          : leftTotalQty > 100
                          ? 'border-red-500 text-red-400'
                          : 'border-yellow-600 text-yellow-400'
                      } drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.8)]`}
                    >
                      <span className="font-mono text-xs">{leftTotalQty}</span>
                      <span className="text-[10px] opacity-70">/100</span>
                    </Badge>
                  </div>
                </div>

                {/* Local Actions Toolbar */}
                <div className="p-3 border-b border-border flex flex-col gap-2 bg-secondary/15 shrink-0">
                  <CardSearchBar deckId={leftDeck.id} />

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openImport(leftDeck.id)}
                        className="text-[10px] h-7 px-2 border-border hover:border-primary/50 transition-colors"
                      >
                        Import
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openCardback(leftDeck.id)}
                        className="text-[10px] h-7 px-2 border-border hover:border-primary/50 transition-colors"
                      >
                        Cardback
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openCombos(leftDeck.id)}
                        className="text-[10px] h-7 px-2 border-border hover:border-primary/50 text-primary hover:bg-primary/5 transition-colors flex items-center gap-1"
                        title="Deck combos and synergies finder"
                      >
                        <Flame className="w-3.5 h-3.5 animate-pulse text-primary" />
                        <span>Combos</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openShare(leftDeck.id)}
                        disabled={!leftCommander}
                        className="text-[10px] h-7 px-2 border-border hover:border-primary/50 text-emerald-400 hover:bg-emerald-500/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        title={leftCommander ? "Share deck or generate card art visuals" : "Share deck or generate card art visuals (requires a selected commander)"}
                      >
                        <Share2 className={`w-3.5 h-3.5 text-emerald-400 ${leftCommander ? 'animate-pulse' : ''}`} />
                        <span>Share</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClearDeck(leftDeck.id)}
                        className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Clear deck"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setLeftStatsOpen(!leftStatsOpen)}
                        className={`text-[10px] h-7 px-2 transition-colors ${
                          leftStatsOpen
                            ? 'bg-primary/25 border-primary/45 text-primary hover:bg-primary/30'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {leftStatsOpen ? 'Hide Stats' : 'Stats'}
                      </Button>
                      <Button
                        onClick={() => openExport(leftDeck.id)}
                        disabled={leftTotalQty === 0}
                        className="text-[10px] h-7 px-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow shadow-primary/10"
                        size="xs"
                      >
                        Export
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Local Column Body (Stats side-by-side list) */}
                <div className="flex-1 flex overflow-hidden w-full">
                  {leftStatsOpen && (
                    <aside className="w-56 shrink-0 border-r border-border overflow-hidden bg-secondary/5 flex flex-col">
                      <ScrollArea className="flex-1">
                        <StatsPanel deckId={leftDeck.id} />
                      </ScrollArea>
                    </aside>
                  )}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <CardList
                      deckId={leftDeck.id}
                      onTransferCard={(card, mode) => handleTransferCard(card, mode, leftDeck.id)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-6 bg-secondary/5">
                <Columns className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">Left panel is empty</h3>
                <p className="text-xs text-muted-foreground max-w-[200px] mb-4">
                  Please select a deck from the left dropdown selector above.
                </p>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="flex flex-col border border-border/60 rounded-xl bg-card/10 overflow-hidden h-full max-h-full glass-panel">
            {rightDeck ? (
              <>
                {/* local banner */}
                <div className="relative w-full h-24 shrink-0 border-b border-border flex flex-col justify-end p-4 select-none overflow-hidden group">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 scale-105 group-hover:scale-[1.07]"
                    style={{ backgroundImage: `url(${getBannerArtForDeck(rightDeck)})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/30" />
                  <div className="absolute inset-0 bg-black/15" />
                  <div className="relative z-10 flex items-end justify-between w-full">
                    <div className="min-w-0 pr-2">
                      <DeckNameEditor deckId={rightDeck.id} />
                      {rightCommander && (
                        <p className="text-[10px] text-white/80 font-medium flex items-center gap-1 mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate">
                          <Crown className="w-3 h-3 text-primary shrink-0" />
                          <span>{rightCommander.name}</span>
                        </p>
                      )}
                      <DeckTagsEditor deckId={rightDeck.id} />
                    </div>
                    <Badge
                      variant={rightTotalQty === 100 ? 'default' : 'outline'}
                      className={`${
                        rightTotalQty === 100
                          ? 'bg-primary text-primary-foreground border-primary'
                          : rightTotalQty > 100
                          ? 'border-red-500 text-red-400'
                          : 'border-yellow-600 text-yellow-400'
                      } drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.8)]`}
                    >
                      <span className="font-mono text-xs">{rightTotalQty}</span>
                      <span className="text-[10px] opacity-70">/100</span>
                    </Badge>
                  </div>
                </div>

                {/* Local Actions Toolbar */}
                <div className="p-3 border-b border-border flex flex-col gap-2 bg-secondary/15 shrink-0">
                  <CardSearchBar deckId={rightDeck.id} />

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openImport(rightDeck.id)}
                        className="text-[10px] h-7 px-2 border-border hover:border-primary/50 transition-colors"
                      >
                        Import
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openCardback(rightDeck.id)}
                        className="text-[10px] h-7 px-2 border-border hover:border-primary/50 transition-colors"
                      >
                        Cardback
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openCombos(rightDeck.id)}
                        className="text-[10px] h-7 px-2 border-border hover:border-primary/50 text-primary hover:bg-primary/5 transition-colors flex items-center gap-1"
                        title="Deck combos and synergies finder"
                      >
                        <Flame className="w-3.5 h-3.5 animate-pulse text-primary" />
                        <span>Combos</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openShare(rightDeck.id)}
                        disabled={!rightCommander}
                        className="text-[10px] h-7 px-2 border-border hover:border-primary/50 text-emerald-400 hover:bg-emerald-500/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        title={rightCommander ? "Share deck or generate card art visuals" : "Share deck or generate card art visuals (requires a selected commander)"}
                      >
                        <Share2 className={`w-3.5 h-3.5 text-emerald-400 ${rightCommander ? 'animate-pulse' : ''}`} />
                        <span>Share</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClearDeck(rightDeck.id)}
                        className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Clear deck"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setRightStatsOpen(!rightStatsOpen)}
                        className={`text-[10px] h-7 px-2 transition-colors ${
                          rightStatsOpen
                            ? 'bg-primary/25 border-primary/45 text-primary hover:bg-primary/30'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {rightStatsOpen ? 'Hide Stats' : 'Stats'}
                      </Button>
                      <Button
                        onClick={() => openExport(rightDeck.id)}
                        disabled={rightTotalQty === 0}
                        className="text-[10px] h-7 px-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow shadow-primary/10"
                        size="xs"
                      >
                        Export
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Local Column Body (Stats side-by-side list) */}
                <div className="flex-1 flex overflow-hidden w-full">
                  {rightStatsOpen && (
                    <aside className="w-56 shrink-0 border-r border-border overflow-hidden bg-secondary/5 flex flex-col">
                      <ScrollArea className="flex-1">
                        <StatsPanel deckId={rightDeck.id} />
                      </ScrollArea>
                    </aside>
                  )}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <CardList
                      deckId={rightDeck.id}
                      onTransferCard={(card, mode) => handleTransferCard(card, mode, rightDeck.id)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-6 bg-secondary/5">
                <Columns className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">Right panel is empty</h3>
                <p className="text-xs text-muted-foreground max-w-[200px] mb-4">
                  Please select a deck from the right dropdown selector above.
                </p>
              </div>
            )}
          </div>
        </div>

        {modals}
      </div>
    );
  }

  // 3. Single Deck Editor View
  if (deckLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Layers className="w-12 h-12 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading deck data from Scryfall...</p>
        </div>
        {modals}
      </div>
    );
  }

  const commander = state ? state.cards.find((c) => c.isCommander) ?? null : null;
  const bannerArt = getBannerArtForDeck(state);
  const totalCards = state ? state.cards.reduce((sum, c) => sum + c.quantity, 0) : 0;

  // Calculate Mana Curve (Non-lands)
  const curve: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  if (state) {
    for (const card of state.cards) {
      if (card.category !== 'Land') {
        const cmc = Math.min(Math.floor(card.scryfallData.cmc ?? 0), 7);
        curve[cmc] = (curve[cmc] ?? 0) + card.quantity;
      }
    }
  }
  const maxCurve = Math.max(...Object.values(curve), 1);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DeckHeader
        onExport={() => openExport(state?.id)}
        onImportOpen={() => openImport(state?.id)}
        onCardbackOpen={() => openCardback(state?.id)}
        onCustomOpen={() => setCustomOpen(true)}
        onClear={() => handleClearDeck(state?.id)}
        onSplitOpen={() => handleOpenSplit(state!.id)}
        splitMode={splitMode}
        onCombosOpen={() => openCombos(state?.id)}
        onShareOpen={() => openShare(state?.id)}
      />

      <div className="flex flex-1 overflow-hidden w-full max-w-full px-2 sm:px-4">
        {/* ── Left sidebar: unified SearchSidebar ────────── */}
        <SearchSidebar
          mode={sidebarMode}
          onModeChange={setSidebarMode}
          deckId={state?.id}
        />

        {/* ── Center: card list ──────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Panoramic Hero Banner with Deck cover art background */}
          <div className="relative w-full h-44 shrink-0 border-b border-border flex flex-col justify-end p-6 select-none overflow-hidden group">
            {/* Background art crop illustration */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 scale-105 group-hover:scale-[1.07]"
              style={{ backgroundImage: `url(${bannerArt})` }}
            />
            {/* High-end gradient masks */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/30" />
            <div className="absolute inset-0 bg-black/20" />

            {/* Inner Content */}
            <div className="relative z-10 flex items-end justify-between w-full gap-6">
              {/* Left Column: Name & Details */}
              <div className="space-y-1.5 min-w-0">
                <DeckNameEditor />

                {/* Commander Name Subtitle */}
                {commander && (
                  <div className="flex items-center gap-1.5 text-xs text-white/80 font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    <Crown className="w-3.5 h-3.5 text-primary shrink-0 animate-pulse" />
                    <span>
                      Led by <strong className="text-white">{commander.name}</strong>
                    </span>
                  </div>
                )}

                <DeckTagsEditor />
              </div>

              {/* Right Column: Sleek Panoramic Mana Curve Chart */}
              {state && state.cards.length > 0 && (
                <div className="hidden sm:flex flex-col items-end gap-1 bg-black/45 backdrop-blur-md rounded-xl border border-white/5 p-3 px-3.5 shadow-2xl shrink-0 animate-fade-in-right">
                  <span className="text-[9px] uppercase font-bold text-white/60 tracking-wider block mb-1 select-none">
                    Mana Curve
                  </span>
                  <div className="flex items-end gap-1 h-12">
                    {Object.entries(curve).map(([cmc, count]) => (
                      <div key={cmc} className="w-6 flex flex-col items-center gap-1">
                        <span className="text-[9px] font-mono font-bold text-white/80">
                          {count > 0 ? count : ''}
                        </span>
                        <div className="w-full rounded-t overflow-hidden" style={{ height: `${(count / maxCurve) * 24}px`, minHeight: count > 0 ? '3px' : '0' }}>
                          <div className="w-full h-full bg-primary/65 hover:bg-primary transition-all duration-300 rounded-t" />
                        </div>
                        <span className="text-[9px] text-white/55 font-mono select-none">
                          {cmc === '7' ? '7+' : cmc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search bar row removed (moved to unified SearchSidebar) */}

          {/* Card list */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <CardList />
          </div>
        </main>
      </div>

      {/* Floating Card Counter at Bottom Center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fade-in-up select-none pointer-events-none">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-primary/30 bg-black/80 backdrop-blur-md shadow-lg shadow-primary/20 pointer-events-auto">
          <Layers className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-semibold text-white/90">
            Deck: <strong className="text-primary font-extrabold">{totalCards}</strong> / 100 cards
          </span>
        </div>
      </div>

      {modals}
    </div>
  );
}

export default function Home() {
  return (
    <TooltipProvider>
      <DeckProvider>
        <AppContent />
      </DeckProvider>
    </TooltipProvider>
  );
}
