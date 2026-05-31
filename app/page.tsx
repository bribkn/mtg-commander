'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DeckProvider, useDeck } from '@/lib/deck-store';
import { DeckHeader } from '@/components/DeckHeader';
import { CardSearchBar } from '@/components/CardSearchBar';
import { CardList } from '@/components/CardList';
import { ImportModal } from '@/components/ImportModal';
import { CardbackModal } from '@/components/CardbackModal';
import { StatsPanel } from '@/components/StatsPanel';
import { DeckDashboard } from '@/components/DeckDashboard';
import { CustomCardsModal } from '@/components/CustomCardsModal';
import { CombosModal } from '@/components/CombosModal';
import { ShareBannerModal } from '@/components/ShareBannerModal';
import { generateTTSExport, downloadJSON } from '@/lib/tts-export';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Pencil, Check, Crown, Columns, ArrowRightLeft, Minimize2, Trash2, ArrowLeft, Flame, ImageIcon } from 'lucide-react';

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

function AppContent() {
  const { state, activeDeckId, decks, dispatch } = useDeck();
  const [importOpen, setImportOpen] = useState(false);
  const [cardbackOpen, setCardbackOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [combosOpen, setCombosOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  // Split view states
  const [splitMode, setSplitMode] = useState(false);
  const [leftDeckId, setLeftDeckId] = useState<string | null>(null);
  const [rightDeckId, setRightDeckId] = useState<string | null>(null);
  const [leftStatsOpen, setLeftStatsOpen] = useState(false);
  const [rightStatsOpen, setRightStatsOpen] = useState(false);

  // Helper to extract banner background art (Prioritizes coverCardId, falls back to commander)
  function getBannerArtForDeck(deck: any): string {
    if (deck?.coverCardId) {
      const cover = deck.cards.find((c: any) => c.scryfallId === deck.coverCardId);
      if (cover?.scryfallData) {
        const data = cover.scryfallData;
        if (data.image_uris?.art_crop) return data.image_uris.art_crop;
        if (data.card_faces?.[0]?.image_uris?.art_crop) return data.card_faces[0].image_uris.art_crop;
        if (data.image_uris?.normal) return data.image_uris.normal;
      }
    }
    if (deck?.commanderId) {
      const commanderCard = deck.cards.find((c: any) => c.scryfallId === deck.commanderId);
      if (commanderCard?.scryfallData) {
        const data = commanderCard.scryfallData;
        if (data.image_uris?.art_crop) return data.image_uris.art_crop;
        if (data.card_faces?.[0]?.image_uris?.art_crop) return data.card_faces[0].image_uris.art_crop;
        if (data.image_uris?.normal) return data.image_uris.normal;
      }
    }
    // Default MTG card back crop
    return 'https://i.pinimg.com/736x/7e/be/a3/7ebea35ad91c8ee201b0647a7c0d816b.jpg';
  }

  function getCommanderForDeck(deck: any): any {
    if (!deck) return null;
    return deck.cards.find((c: any) => c.isCommander) ?? null;
  }

  async function handleExportDeck(deckId?: string) {
    const targetId = deckId || activeDeckId;
    if (!targetId) return;
    const targetDeck = decks.find((d) => d.id === targetId);
    if (!targetDeck || targetDeck.cards.length === 0) return;

    setIsExporting(true);
    try {
      const result = await generateTTSExport(targetDeck.cards, targetDeck.customCardbackUrl);
      const deckName =
        targetDeck.deckName.replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'commander-deck';
      downloadJSON(result.json, `${deckName}.json`);
    } finally {
      setIsExporting(false);
    }
  }

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
    </>
  );

  // 1. Dashboard View
  if (!splitMode && (!state || !activeDeckId)) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <DeckDashboard onOpenSplit={handleOpenSplit} />
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
                        title={leftCommander ? "Generate shareable deck banner image" : "Generate shareable deck banner image (requires a selected commander)"}
                      >
                        <ImageIcon className={`w-3.5 h-3.5 text-emerald-400 ${leftCommander ? 'animate-pulse' : ''}`} />
                        <span>Banner</span>
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
                        onClick={() => handleExportDeck(leftDeck.id)}
                        disabled={isExporting || leftTotalQty === 0}
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
                        title={rightCommander ? "Generate shareable deck banner image" : "Generate shareable deck banner image (requires a selected commander)"}
                      >
                        <ImageIcon className={`w-3.5 h-3.5 text-emerald-400 ${rightCommander ? 'animate-pulse' : ''}`} />
                        <span>Banner</span>
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
                        onClick={() => handleExportDeck(rightDeck.id)}
                        disabled={isExporting || rightTotalQty === 0}
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
  const commander = state ? state.cards.find((c) => c.isCommander) ?? null : null;
  const bannerArt = getBannerArtForDeck(state);
  const totalCards = state ? state.cards.reduce((sum, c) => sum + c.quantity, 0) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DeckHeader
        onExport={() => handleExportDeck(state?.id)}
        onImportOpen={() => openImport(state?.id)}
        onCardbackOpen={() => openCardback(state?.id)}
        onCustomOpen={() => setCustomOpen(true)}
        onClear={() => handleClearDeck(state?.id)}
        isExporting={isExporting}
        onSplitOpen={() => handleOpenSplit(state!.id)}
        splitMode={splitMode}
        onCombosOpen={() => openCombos(state?.id)}
        onShareOpen={() => openShare(state?.id)}
      />

      <div className="flex flex-1 overflow-hidden w-full max-w-full px-2 sm:px-4">
        {/* ── Left sidebar: stats ────────────────────────── */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Deck Stats
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <StatsPanel />
          </ScrollArea>
        </aside>

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
            <div className="relative z-10 space-y-1.5">
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
            </div>
          </div>

          {/* Search bar row */}
          <div className="border-b border-border p-3">
            <CardSearchBar />
          </div>

          {/* Card list */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <CardList />
          </div>
        </main>
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
