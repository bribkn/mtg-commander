'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
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
import { generateTTSExport, downloadJSON } from '@/lib/tts-export';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Pencil, Check, Crown } from 'lucide-react';

function DeckNameEditor() {
  const { state, dispatch } = useDeck();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(state?.deckName || '');

  function save() {
    dispatch({ type: 'SET_DECK_NAME', name: value.trim() || 'New Commander Deck' });
    setEditing(false);
  }

  if (!state) return null;

  if (editing) {
    return (
      <div className="flex items-center gap-2 max-w-xl">
        <Input
          id="deck-name-input"
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
  const { state, activeDeckId, dispatch, commander } = useDeck();
  const [importOpen, setImportOpen] = useState(false);
  const [cardbackOpen, setCardbackOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Helper to extract banner background art (Prioritizes coverCardId, falls back to commander)
  function getBannerArt(): string {
    if (state?.coverCardId) {
      const cover = state.cards.find((c) => c.scryfallId === state.coverCardId);
      if (cover?.scryfallData) {
        const data = cover.scryfallData;
        if (data.image_uris?.art_crop) return data.image_uris.art_crop;
        if (data.card_faces?.[0]?.image_uris?.art_crop) return data.card_faces[0].image_uris.art_crop;
        if (data.image_uris?.normal) return data.image_uris.normal;
      }
    }
    if (state?.commanderId) {
      const commanderCard = state.cards.find((c) => c.scryfallId === state.commanderId);
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

  async function handleExport() {
    if (!state || state.cards.length === 0) return;
    setIsExporting(true);
    try {
      const result = await generateTTSExport(state.cards, state.customCardbackUrl);
      const deckName =
        state.deckName.replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'commander-deck';
      downloadJSON(result.json, `${deckName}.json`);
    } finally {
      setIsExporting(false);
    }
  }

  function handleClear() {
    if (!state || state.cards.length === 0) return;
    if (confirm('Clear the entire deck? This cannot be undone.')) {
      dispatch({ type: 'CLEAR_DECK' });
    }
  }

  // Both modals are rendered outside the dashboard/editor conditional so they
  // never unmount mid-import when activeDeckId changes (e.g. after CREATE_DECK).
  const modals = (
    <>
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        createNewDeck={!activeDeckId}
      />
      <CardbackModal open={cardbackOpen} onClose={() => setCardbackOpen(false)} />
    </>
  );

  // Dashboard view — no active deck
  if (!state || !activeDeckId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <DeckDashboard />
        {modals}
      </div>
    );
  }

  const bannerArt = getBannerArt();

  // Deck editor view
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DeckHeader
        onExport={handleExport}
        onImportOpen={() => setImportOpen(true)}
        onCardbackOpen={() => setCardbackOpen(true)}
        onClear={handleClear}
        isExporting={isExporting}
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
