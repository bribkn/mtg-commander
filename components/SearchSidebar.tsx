/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  SlidersHorizontal, Plus, Check, Loader2, Search, X,
  ChevronRight, Sparkles, Trophy, ShieldAlert, ArrowLeft, Map as MapIcon,
  Flame, Info, Minimize2, Trash2, ArrowRightLeft, Crown, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useDeck } from '@/lib/deck-store';
import {
  ScryfallCard, searchCards, getFrontImageUrl, getManaSymbolUrl,
  isGameChangerCard, CATEGORY_ORDER, autocompleteCardName, getCardByExactName
} from '@/lib/scryfall';
import { AddLandModal } from './AddLandModal';

// ─── Constants ──────────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<string, string> = {
  W: 'bg-yellow-100/90 text-yellow-900 border-yellow-300 shadow-yellow-100/10',
  U: 'bg-blue-600/25 text-blue-400 border-blue-500/30 shadow-blue-500/10',
  B: 'bg-neutral-800 text-neutral-300 border-neutral-700 shadow-neutral-700/10',
  R: 'bg-red-600/25 text-red-400 border-red-500/30 shadow-red-500/10',
  G: 'bg-green-600/25 text-green-400 border-green-500/30 shadow-green-500/10',
  C: 'bg-secondary text-muted-foreground border-border',
};

const RARITY_CLASSES: Record<string, string> = {
  common: 'bg-neutral-600/20 text-neutral-400 border-neutral-600/30',
  uncommon: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
  rare: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  mythic: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const CARD_TYPES = [
  { id: 'creature', label: 'Creature' },
  { id: 'planeswalker', label: 'Planeswalker' },
  { id: 'instant', label: 'Instant' },
  { id: 'sorcery', label: 'Sorcery' },
  { id: 'artifact', label: 'Artifact' },
  { id: 'enchantment', label: 'Enchantment' },
  { id: 'other', label: 'Other' },
];

const MANA_COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
const MANA_STYLES: Record<string, { bar: string; bg: string; text: string }> = {
  W: { bar: 'bg-yellow-200', bg: 'bg-yellow-200/10', text: 'text-yellow-200' },
  U: { bar: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  B: { bar: 'bg-gray-400', bg: 'bg-gray-400/10', text: 'text-gray-400' },
  R: { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
  G: { bar: 'bg-green-500', bg: 'bg-green-500/10', text: 'text-green-400' },
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface SearchSidebarProps {
  mode: 'stats' | 'search';
  onModeChange: (mode: 'stats' | 'search') => void;
  deckId?: string;
}

export function SearchSidebar({ mode, onModeChange, deckId }: SearchSidebarProps) {
  const { state: activeDeck, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : activeDeck;

  // Modals inside sidebar
  const [addLandOpen, setAddLandOpen] = useState(false);
  const [editingStats, setEditingStats] = useState(false);

  // Search input state
  const [query, setQuery] = useState('');
  const [isOracleMode, setIsOracleMode] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Advanced Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({});
  const [selectedColors, setSelectedColors] = useState<Record<string, boolean>>({});
  const [colorMatch, setColorMatch] = useState<'=' | '<=' | '>=' | ':'>(':');
  const [selectedIdentity, setSelectedIdentity] = useState<Record<string, boolean>>({});
  const [identityMatch, setIdentityMatch] = useState<'=' | '<=' | '>=' | ':'>('<=');
  const [restrictCommander, setRestrictCommander] = useState(false);
  const [cmcValue, setCmcValue] = useState('');
  const [cmcOperator, setCmcOperator] = useState<'=' | '>' | '>=' | '<' | '<=' | '!='>('=');
  const [powValue, setPowValue] = useState('');
  const [powOperator, setPowOperator] = useState<'=' | '>' | '>=' | '<' | '<=' | '!='>('=');
  const [touValue, setTouValue] = useState('');
  const [touOperator, setTouOperator] = useState<'=' | '>' | '>=' | '<' | '<=' | '!='>('=');
  const [selectedRarities, setSelectedRarities] = useState<Record<string, boolean>>({});
  const [setCode, setSetCode] = useState('');
  const [artistName, setArtistName] = useState('');
  const [subtypeName, setSubtypeName] = useState('');
  const [legalityFormat, setLegalityFormat] = useState('commander');
  const [legalityStatus, setLegalityStatus] = useState('legal');

  // Misc Toggles
  const [isLegendary, setIsLegendary] = useState(false);
  const [isFoil, setIsFoil] = useState(false);
  const [isPromo, setIsPromo] = useState(false);
  const [isFullArt, setIsFullArt] = useState(false);
  const [isTextless, setIsTextless] = useState(false);
  const [isReprint, setIsReprint] = useState(false);

  // Search Results States
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCardsCount, setTotalCardsCount] = useState<number | undefined>(undefined);
  const [searchError, setSearchError] = useState('');
  const [lastQuery, setLastQuery] = useState('');

  // Local card adding loading states
  const [addingIds, setAddingIds] = useState<Record<string, boolean>>({});

  // Preview Hover State
  const [previewCard, setPreviewCard] = useState<ScryfallCard | null>(null);
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  // Commander Identity details
  const commander = state?.cards.find((c) => c.isCommander) ?? null;
  const commanderIdentity = commander?.scryfallData.color_identity ?? [];

  // Sync to commander colors if checked
  useEffect(() => {
    if (restrictCommander && commanderIdentity.length > 0) {
      const newIdentity: Record<string, boolean> = {};
      ['W', 'U', 'B', 'R', 'G'].forEach((c) => {
        newIdentity[c] = commanderIdentity.includes(c);
      });
      setSelectedIdentity(newIdentity);
      setIdentityMatch('<=');
    }
  }, [restrictCommander, commanderIdentity]);

  // Autocomplete fetcher
  useEffect(() => {
    if (isOracleMode || debouncedQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsAutocompleteLoading(true);
    autocompleteCardName(debouncedQuery).then((results) => {
      setSuggestions(results.slice(0, 8));
      setShowSuggestions(results.length > 0);
      setIsAutocompleteLoading(false);
      setHighlightedIndex(-1);
    });
  }, [debouncedQuery, isOracleMode]);

  // Click outside suggestions
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleMouseMove(e: React.MouseEvent) {
    setMouseCoords({
      x: e.clientX,
      y: e.clientY,
    });
  }

  // ── Stats Calculations ────────────────────────────────────────────────────────
  if (!state) return null;

  const totalCards = state.cards.reduce((sum, c) => sum + c.quantity, 0);
  const wins = state.wins || 0;
  const losses = state.losses || 0;
  const totalGames = wins + losses;
  const winrate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const wrString = totalGames > 0 ? `${winrate}%` : '—';

  const curve: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  for (const card of state.cards) {
    if (card.category !== 'Land') {
      const cmc = Math.min(Math.floor(card.scryfallData.cmc ?? 0), 7);
      curve[cmc] = (curve[cmc] ?? 0) + card.quantity;
    }
  }
  const maxCurve = Math.max(...Object.values(curve), 1);

  const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const card of state.cards) {
    const colors = card.scryfallData.color_identity ?? [];
    for (const c of colors) {
      if (c in colorCounts) colorCounts[c] += card.quantity;
    }
  }
  const maxColor = Math.max(...Object.values(colorCounts), 1);

  const typeCounts = new Map<string, number>();
  for (const cat of CATEGORY_ORDER) {
    typeCounts.set(cat, 0);
  }
  for (const card of state.cards) {
    typeCounts.set(card.category, (typeCounts.get(card.category) ?? 0) + card.quantity);
  }

  let totalCmc = 0;
  let nonLandCount = 0;
  for (const card of state.cards) {
    if (card.category !== 'Land') {
      totalCmc += (card.scryfallData.cmc ?? 0) * card.quantity;
      nonLandCount += card.quantity;
    }
  }
  const avgCmc = nonLandCount > 0 ? (totalCmc / nonLandCount).toFixed(2) : '—';

  let gameChangerCount = 0;
  for (const card of state.cards) {
    if (isGameChangerCard(card.name)) {
      gameChangerCount += card.quantity;
    }
  }
  const gameChangersInDeck = state.cards
    .filter((card) => isGameChangerCard(card.name))
    .map((card) => ({ name: card.name, quantity: card.quantity }));

  let bannedCount = 0;
  const bannedCardsList: Array<{ name: string; quantity: number }> = [];
  for (const card of state.cards) {
    if (card.scryfallData.legalities?.commander === 'banned') {
      bannedCount += card.quantity;
      bannedCardsList.push({ name: card.name, quantity: card.quantity });
    }
  }

  let landCount = 0;
  for (const card of state.cards) {
    if (card.category === 'Land') {
      landCount += card.quantity;
    }
  }
  const avgOpeningLands = totalCards > 0 ? ((landCount / totalCards) * 7).toFixed(2) : '—';

  // Stats Actions
  function handleUpdateStats(newWins: number, newLosses: number) {
    dispatch({ type: 'UPDATE_DECK_STATS', wins: newWins, losses: newLosses, deckId });
  }

  // ── Scryfall Query Builder ─────────────────────────────────────────────
  const buildScryfallQuery = () => {
    const parts: string[] = [];

    // General term or Oracle text search depending on isOracleMode
    if (query.trim()) {
      if (isOracleMode) {
        parts.push(`o:"${query.trim()}"`);
      } else {
        parts.push(query.trim());
      }
    }

    // Types
    const activeTypes = Object.keys(selectedTypes).filter((t) => selectedTypes[t]);
    if (activeTypes.length > 0) {
      const typeQueries = activeTypes.map((type) => {
        if (type === 'other') {
          return '(-t:creature -t:planeswalker -t:instant -t:sorcery -t:artifact -t:enchantment -t:land)';
        }
        return `t:${type}`;
      });
      if (typeQueries.length === 1) {
        parts.push(typeQueries[0]);
      } else {
        parts.push(`(${typeQueries.join(' or ')})`);
      }
    }

    // Auto-exclude lands unless 'other' is selected
    const hasLandSearch = activeTypes.includes('other');
    if (!hasLandSearch) {
      parts.push('-t:land');
    }

    // Colors
    const activeColors = Object.keys(selectedColors).filter((c) => selectedColors[c]);
    if (activeColors.length > 0) {
      const colorsStr = activeColors.join('');
      parts.push(`c${colorMatch}${colorsStr}`);
    }

    // Identity
    if (restrictCommander && commanderIdentity.length > 0) {
      const cmColors = commanderIdentity.join('').toLowerCase() || 'c';
      parts.push(`id<=${cmColors}`);
    } else {
      const activeIdentity = Object.keys(selectedIdentity).filter((c) => selectedIdentity[c]);
      if (activeIdentity.length > 0) {
        const identityStr = activeIdentity.join('');
        parts.push(`id${identityMatch}${identityStr}`);
      }
    }

    // Mana Value (CMC)
    if (cmcValue.trim()) {
      const num = parseInt(cmcValue, 10);
      if (!isNaN(num)) {
        parts.push(`mv${cmcOperator}${num}`);
      }
    }

    // Power / Toughness
    if (powValue.trim()) {
      const num = parseInt(powValue, 10);
      if (!isNaN(num)) {
        parts.push(`pow${powOperator}${num}`);
      }
    }
    if (touValue.trim()) {
      const num = parseInt(touValue, 10);
      if (!isNaN(num)) {
        parts.push(`tou${touOperator}${num}`);
      }
    }

    // Rarity
    const activeRarities = Object.keys(selectedRarities).filter((r) => selectedRarities[r]);
    if (activeRarities.length > 0) {
      const rarityQueries = activeRarities.map((r) => `r:${r}`);
      if (rarityQueries.length === 1) {
        parts.push(rarityQueries[0]);
      } else {
        parts.push(`(${rarityQueries.join(' or ')})`);
      }
    }

    // Extras
    if (setCode.trim()) parts.push(`s:${setCode.trim().toLowerCase()}`);
    if (artistName.trim()) parts.push(`a:"${artistName.trim()}"`);
    if (subtypeName.trim()) parts.push(`t:${subtypeName.trim().toLowerCase()}`);
    if (legalityFormat) parts.push(`${legalityStatus}:${legalityFormat}`);

    // Toggles
    if (isLegendary) parts.push('is:legendary');
    if (isFoil) parts.push('is:foil');
    if (isPromo) parts.push('is:promo');
    if (isFullArt) parts.push('is:full');
    if (isTextless) parts.push('is:textless');
    if (isReprint) parts.push('is:reprint');

    return parts.join(' ');
  };

  // Search execution
  const handleSearch = async (searchPage: number = 1) => {
    const q = buildScryfallQuery();
    if (!q.trim()) {
      setSearchError('Please type a search term or select some filters to search.');
      return;
    }

    setIsLoadingResults(true);
    setSearchError('');
    
    if (searchPage === 1) {
      setResults([]);
      setTotalCardsCount(undefined);
    }

    try {
      const res = await searchCards(q, searchPage);
      if (res && res.data) {
        if (searchPage === 1) {
          setResults(res.data);
        } else {
          setResults((prev) => [...prev, ...res.data]);
        }
        setHasMore(res.has_more);
        setTotalCardsCount(res.total_cards);
        setPage(searchPage);
        setLastQuery(q);
      } else {
        if (searchPage === 1) {
          setResults([]);
          setSearchError('No cards found with these filters.');
        }
        setHasMore(false);
      }
    } catch (err: any) {
      setSearchError('Error connecting to Scryfall: ' + err.message);
    } finally {
      setIsLoadingResults(false);
    }
  };

  function handleResetFilters() {
    setQuery('');
    setIsOracleMode(false);
    setSelectedTypes({});
    setSelectedColors({});
    setColorMatch(':');
    setSelectedIdentity({});
    setIdentityMatch('<=');
    setRestrictCommander(false);
    setCmcValue('');
    setCmcOperator('=');
    setPowValue('');
    setPowOperator('=');
    setTouValue('');
    setTouOperator('=');
    setSelectedRarities({});
    setSetCode('');
    setArtistName('');
    setSubtypeName('');
    setIsLegendary(false);
    setIsFoil(false);
    setIsPromo(false);
    setIsFullArt(false);
    setIsTextless(false);
    setIsReprint(false);
    setResults([]);
    setSearchError('');
    setTotalCardsCount(undefined);
    setPage(1);
    setHasMore(false);
  }

  // Handle adding card directly
  async function handleAddCard(card: ScryfallCard) {
    setAddingIds((prev) => ({ ...prev, [card.id]: true }));
    try {
      dispatch({
        type: 'ADD_CARD',
        card,
        quantity: 1,
        deckId,
      });
    } finally {
      setTimeout(() => {
        setAddingIds((prev) => ({ ...prev, [card.id]: false }));
      }, 500);
    }
  }

  // Autocomplete enter or click selection
  async function handleSelectAutocomplete(name: string) {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setIsAutocompleteLoading(true);
    try {
      const card = await getCardByExactName(name);
      if (card) {
        dispatch({ type: 'ADD_CARD', card, quantity: 1, deckId });
      }
    } finally {
      setIsAutocompleteLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleSelectAutocomplete(suggestions[highlightedIndex]);
      } else {
        handleSearch(1);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  // Card quantity counter helper
  function getQuantityInDeck(card: ScryfallCard): number {
    return state?.cards.find((c) => c.scryfallId === card.id)?.quantity || 0;
  }

  // Float preview coordinates helper
  const previewWidth = 250;
  const previewHeight = 350;
  let leftPos = mouseCoords.x + 12;
  if (typeof window !== 'undefined' && mouseCoords.x + previewWidth + 24 > window.innerWidth) {
    leftPos = mouseCoords.x - previewWidth - 12;
  }
  let topPos = mouseCoords.y - previewHeight / 2;
  if (typeof window !== 'undefined') {
    if (topPos < 10) {
      topPos = 10;
    } else if (topPos + previewHeight > window.innerHeight - 10) {
      topPos = window.innerHeight - previewHeight - 10;
    }
  }

  return (
    <aside
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`hidden lg:flex flex-col border-r border-border overflow-hidden bg-card/25 backdrop-blur-md transition-all duration-300 relative ${
        mode === 'search' ? 'w-[420px]' : 'w-64'
      } shrink-0`}
    >
      {/* ─── STATS MODE ────────────────────────────────────────────────────────── */}
      {mode === 'stats' && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header Action Button Row */}
          <div className="p-4 border-b border-border bg-secondary/10 flex flex-col gap-2 shrink-0">
            <Button
              onClick={() => onModeChange('search')}
              className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold flex items-center justify-center gap-2 group shadow-md shadow-primary/20 transition-all duration-300 active:scale-98"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              <span>Add Cards</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setAddLandOpen(true)}
              className="w-full border-border hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              <MapIcon className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Add Lands</span>
            </Button>
          </div>

          <ScrollArea className="flex-1 custom-scrollbar">
            <div className="space-y-6 p-4">
              {/* Banned Cards legality alert */}
              {bannedCount > 0 && (
                <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-3 flex flex-col gap-1.5 shadow-lg shadow-red-500/5 animate-pulse">
                  <div className="flex items-center gap-2 text-red-400">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">Legality Warning</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    This deck contains <strong className="text-red-400 font-bold">{bannedCount} banned card{bannedCount > 1 ? 's' : ''}</strong> in Commander:
                  </p>
                  <div className="flex flex-col gap-0.5 mt-1 border-t border-red-500/15 pt-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                    {bannedCardsList.map((bc) => (
                      <div key={bc.name} className="flex justify-between gap-4 text-[10px]">
                        <span className="font-semibold text-red-400 truncate max-w-[140px]" title={bc.name}>{bc.name}</span>
                        <span className="font-mono text-muted-foreground font-bold shrink-0">{bc.quantity}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main stats counters */}
              <div className="grid grid-cols-2 gap-2.5">
                <StatBox label="Cards" value={String(totalCards)} sublabel="/100" highlight={totalCards === 100} />
                <StatBox label="Avg CMC" value={avgCmc} sublabel="non-land" />
                <StatBox label="Lands" value={String(landCount)} sublabel="in deck" highlight={landCount >= 34 && landCount <= 40} />
                <StatBox label="Opening Lands" value={avgOpeningLands} sublabel="avg in 7 cards" highlight={!isNaN(parseFloat(avgOpeningLands)) && parseFloat(avgOpeningLands) >= 2.3 && parseFloat(avgOpeningLands) <= 3.0} />
                <StatBox label="Unique" value={String(state.cards.length)} sublabel="cards" />

                {gameChangersInDeck.length > 0 ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <div className="cursor-pointer">
                          <StatBox
                            label="Game Changers"
                            value={String(gameChangerCount)}
                            sublabel="in deck"
                            highlight={gameChangerCount > 0}
                            isGameChanger={true}
                          />
                        </div>
                      }
                    />
                    <TooltipContent className="bg-black/95 text-white border border-red-500/20 p-2.5 rounded-lg max-w-sm flex flex-col gap-1 shadow-xl z-50">
                      <div className="font-bold text-[10px] uppercase tracking-wider text-red-400 mb-1 border-b border-red-500/20 pb-1">
                        Game Changers:
                      </div>
                      <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {gameChangersInDeck.map((gc) => (
                          <div key={gc.name} className="flex justify-between gap-4 text-[10px]">
                            <span className="font-medium text-foreground">{gc.name}</span>
                            <span className="font-mono text-muted-foreground font-bold shrink-0">{gc.quantity}x</span>
                          </div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <StatBox
                    label="Game Changers"
                    value={String(gameChangerCount)}
                    sublabel="in deck"
                    highlight={gameChangerCount > 0}
                    isGameChanger={true}
                  />
                )}
              </div>

              {/* Winrate Stats Box */}
              <div className="border border-border bg-secondary/30 rounded-xl p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block leading-none">Performance</span>
                      <span className="text-sm font-extrabold text-foreground">{wrString} Winrate</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{wins}W - {losses}L</span>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Match History</span>
                  <button
                    onClick={() => setEditingStats(!editingStats)}
                    className="text-[10px] text-primary hover:underline font-bold"
                  >
                    {editingStats ? 'Close' : 'Modify'}
                  </button>
                </div>

                {editingStats && (
                  <div className="grid grid-cols-2 gap-3 pt-1 animate-fade-in-up">
                    <div className="flex flex-col items-center gap-1 bg-secondary/50 rounded-lg p-2 border border-border/40">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Wins</span>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => handleUpdateStats(Math.max(0, wins - 1), losses)}
                          className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-xs font-bold hover:bg-border transition-colors"
                        >
                          -
                        </button>
                        <span className="text-xs font-mono font-bold w-4 text-center">{wins}</span>
                        <button
                          onClick={() => handleUpdateStats(wins + 1, losses)}
                          className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-xs font-bold hover:bg-border transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 bg-secondary/50 rounded-lg p-2 border border-border/40">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Losses</span>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => handleUpdateStats(wins, Math.max(0, losses - 1))}
                          className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-xs font-bold hover:bg-border transition-colors"
                        >
                          -
                        </button>
                        <span className="text-xs font-mono font-bold w-4 text-center">{losses}</span>
                        <button
                          onClick={() => handleUpdateStats(wins, losses + 1)}
                          className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-xs font-bold hover:bg-border transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Color Identity list */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Color Identity
                </h3>
                <div className="space-y-2">
                  {MANA_COLORS.map((color) => {
                    const count = colorCounts[color] ?? 0;
                    const pct = maxColor > 0 ? (count / maxColor) * 100 : 0;
                    const styles = MANA_STYLES[color];
                    return (
                      <div key={color} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-black flex items-center justify-center border border-border/40 shadow-sm">
                          <img
                            src={getManaSymbolUrl(color)}
                            alt={color}
                            className="w-full h-full object-cover select-none pointer-events-none"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${styles.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono w-6 text-right shrink-0">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card Types breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Card Types
                </h3>
                <div className="space-y-1.5">
                  {CATEGORY_ORDER.map((cat) => {
                    const count = typeCounts.get(cat) ?? 0;
                    if (count === 0) return null;
                    const pct = totalCards > 0 ? Math.round((count / totalCards) * 100) : 0;
                    return (
                      <div key={cat} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground w-24 truncate">{cat}</span>
                        <div className="flex-1 mx-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-foreground font-mono w-5 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ─── SEARCH MODE ───────────────────────────────────────────────────────── */}
      {mode === 'search' && (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in-right">
          {/* Header row with stats & back link */}
          <div className="p-3.5 border-b border-border bg-secondary/10 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onModeChange('stats')}
                className="text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex items-center gap-1 px-1.5 h-7"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Stats</span>
              </Button>

              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5 px-2 py-0.5 select-none uppercase">
                {totalCardsCount !== undefined ? `Found: ${totalCardsCount}` : 'Search Mode'}
              </Badge>
            </div>

            {/* Mini Stats Bar */}
            <div className="grid grid-cols-3 gap-2 bg-secondary/40 border border-border/40 rounded-lg p-2 text-center text-[10px] font-semibold text-muted-foreground">
              <div>
                <span className="text-foreground block font-bold text-xs">{totalCards}/100</span>
                Total Cards
              </div>
              <div className="border-x border-border/40">
                <span className="text-foreground block font-bold text-xs">{landCount}</span>
                Lands
              </div>
              <div>
                <span className="text-foreground block font-bold text-xs">{gameChangerCount}</span>
                Game Changers
              </div>
            </div>
          </div>

          {/* Scrollable Filters & Inputs container */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
            {/* Search Input with Autocomplete dropdown inside absolute portal/relative wrapper */}
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {isOracleMode ? 'Search Rules (Oracle)' : 'Search Cards (Name)'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOracleMode(!isOracleMode);
                    setQuery('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all duration-300 flex items-center gap-1 active:scale-95 cursor-pointer select-none
                    ${isOracleMode
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/5 hover:bg-amber-500/20'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                    }`}
                >
                  <Sparkles className={`w-2.5 h-2.5 ${isOracleMode ? 'animate-pulse text-amber-400' : ''}`} />
                  <span>Oracle Rules</span>
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => !isOracleMode && suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder={isOracleMode ? 'Search in card text (e.g. "draw a card")...' : 'Search cards by name...'}
                  className="pl-8 pr-8 h-8 text-xs bg-secondary border-border focus:border-primary/50 focus:ring-primary/20"
                  autoComplete="off"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {isAutocompleteLoading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                  {query && !isAutocompleteLoading && (
                    <button
                      onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false); }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && !isOracleMode && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl shadow-black/80 overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                  {suggestions.map((name, i) => (
                    <button
                      key={name}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2
                        ${i === highlightedIndex ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-secondary'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectAutocomplete(name);
                      }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                    >
                      <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Collapsible Advanced Filters Section */}
            <div className="border border-border/50 bg-secondary/15 rounded-xl overflow-hidden transition-all duration-300">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full flex items-center justify-between p-3 text-xs font-bold text-muted-foreground hover:text-foreground bg-secondary/10 hover:bg-secondary/20 transition-all select-none"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                  <span>Advanced Query Filters</span>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${showFilters ? 'rotate-90' : ''}`} />
              </button>

              {showFilters && (
                <div className="p-3 border-t border-border/40 space-y-4 animate-fade-in-up">
                  {/* Types Toggles */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Card Type</span>
                    <div className="flex flex-wrap gap-1">
                      {CARD_TYPES.map((type) => {
                        const isActive = selectedTypes[type.id];
                        return (
                          <button
                            key={type.id}
                            onClick={() => setSelectedTypes((prev) => ({ ...prev, [type.id]: !prev[type.id] }))}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                              isActive
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border bg-secondary/35 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  {/* Colors selectors */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Card Colors</span>
                    <div className="flex items-center gap-1.5">
                      {['W', 'U', 'B', 'R', 'G', 'C'].map((color) => {
                        const isActive = selectedColors[color];
                        return (
                          <button
                            key={color}
                            onClick={() => setSelectedColors((prev) => ({ ...prev, [color]: !prev[color] }))}
                            className={`w-6.5 h-6.5 rounded-full transition-all flex items-center justify-center overflow-hidden bg-background ${
                              isActive
                                ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110 shadow-lg opacity-100'
                                : 'border border-border/40 opacity-60 hover:opacity-100'
                            }`}
                            title={`Color ${color}`}
                          >
                            <img
                              src={getManaSymbolUrl(color)}
                              alt={color}
                              className="w-full h-full select-none object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  {/* Color Identity */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Color Identity</span>
                    
                    {commander && (
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-primary cursor-pointer hover:text-primary/80 transition-colors py-0.5 select-none">
                        <input
                          type="checkbox"
                          checked={restrictCommander}
                          onChange={(e) => setRestrictCommander(e.target.checked)}
                          className="rounded border-border bg-secondary text-primary focus:ring-primary/40 focus:ring-offset-background"
                        />
                        <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                        <span>Limit to Commander's Colors ({commanderIdentity.join('') || 'C'})</span>
                      </label>
                    )}

                    {!restrictCommander && (
                      <div className="flex items-center gap-1.5">
                        {['W', 'U', 'B', 'R', 'G'].map((color) => {
                          const isActive = selectedIdentity[color];
                          return (
                            <button
                              key={color}
                              onClick={() => setSelectedIdentity((prev) => ({ ...prev, [color]: !prev[color] }))}
                              className={`w-6.5 h-6.5 rounded-full transition-all flex items-center justify-center overflow-hidden bg-background ${
                                isActive
                                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110 shadow-lg opacity-100'
                                  : 'border border-border/40 opacity-60 hover:opacity-100'
                              }`}
                              title={`Identity ${color}`}
                            >
                              <img
                                src={getManaSymbolUrl(color)}
                                alt={color}
                                className="w-full h-full select-none object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Separator className="opacity-30" />

                  {/* CMC and stats operator boxes */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Mana Value</span>
                      <div className="flex gap-1">
                        <select
                          value={cmcOperator}
                          onChange={(e) => setCmcOperator(e.target.value as any)}
                          className="h-7 px-1 rounded text-xs bg-secondary border border-border text-foreground focus:outline-none"
                        >
                          <option value="=">=</option>
                          <option value=">">&gt;</option>
                          <option value=">=">&gt;=</option>
                          <option value="<">&lt;</option>
                          <option value="<=">&lt;=</option>
                          <option value="!=">!=</option>
                        </select>
                        <Input
                          type="number"
                          min="0"
                          placeholder="CMC"
                          value={cmcValue}
                          onChange={(e) => setCmcValue(e.target.value)}
                          className="h-7 text-xs bg-secondary border-border w-full text-center font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Power</span>
                      <div className="flex gap-1">
                        <select
                          value={powOperator}
                          onChange={(e) => setPowOperator(e.target.value as any)}
                          className="h-7 px-1 rounded text-xs bg-secondary border border-border text-foreground focus:outline-none"
                        >
                          <option value="=">=</option>
                          <option value=">">&gt;</option>
                          <option value=">=">&gt;=</option>
                          <option value="<">&lt;</option>
                          <option value="<=">&lt;=</option>
                        </select>
                        <Input
                          placeholder="Pow"
                          value={powValue}
                          onChange={(e) => setPowValue(e.target.value)}
                          className="h-7 text-xs bg-secondary border-border w-full text-center font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Toughness</span>
                      <div className="flex gap-1">
                        <select
                          value={touOperator}
                          onChange={(e) => setTouOperator(e.target.value as any)}
                          className="h-7 px-1 rounded text-xs bg-secondary border border-border text-foreground focus:outline-none"
                        >
                          <option value="=">=</option>
                          <option value=">">&gt;</option>
                          <option value=">=">&gt;=</option>
                          <option value="<">&lt;</option>
                          <option value="<=">&lt;=</option>
                        </select>
                        <Input
                          placeholder="Tou"
                          value={touValue}
                          onChange={(e) => setTouValue(e.target.value)}
                          className="h-7 text-xs bg-secondary border-border w-full text-center font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Subtype (Creature)</span>
                      <Input
                        placeholder="e.g. Goblin, Elf, Drake"
                        value={subtypeName}
                        onChange={(e) => setSubtypeName(e.target.value)}
                        className="h-7 text-xs bg-secondary border-border w-full"
                      />
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  {/* Rarities */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Rarity</span>
                    <div className="grid grid-cols-4 gap-1">
                      {['common', 'uncommon', 'rare', 'mythic'].map((rarity) => {
                        const isActive = selectedRarities[rarity];
                        return (
                          <button
                            key={rarity}
                            onClick={() => setSelectedRarities((prev) => ({ ...prev, [rarity]: !prev[rarity] }))}
                            className={`px-1 py-0.5 rounded text-[8px] font-bold border transition-all text-center capitalize ${
                              isActive
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border bg-secondary/35 text-muted-foreground'
                            }`}
                          >
                            {rarity.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  {/* Set & Artist */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Set Code</span>
                      <Input
                        placeholder="e.g. MH2, NEO"
                        value={setCode}
                        onChange={(e) => setSetCode(e.target.value)}
                        className="h-7 text-xs bg-secondary border-border font-mono text-center uppercase"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Artist</span>
                      <Input
                        placeholder="Artist name..."
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        className="h-7 text-xs bg-secondary border-border"
                      />
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  {/* Format Legality */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Format</span>
                      <select
                        value={legalityFormat}
                        onChange={(e) => setLegalityFormat(e.target.value)}
                        className="h-7 w-full px-1.5 rounded text-xs bg-secondary border border-border text-foreground focus:outline-none"
                      >
                        <option value="commander">Commander</option>
                        <option value="standard">Standard</option>
                        <option value="modern">Modern</option>
                        <option value="legacy">Legacy</option>
                        <option value="vintage">Vintage</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Legality</span>
                      <select
                        value={legalityStatus}
                        onChange={(e) => setLegalityStatus(e.target.value)}
                        className="h-7 w-full px-1.5 rounded text-xs bg-secondary border border-border text-foreground focus:outline-none"
                      >
                        <option value="legal">Legal</option>
                        <option value="banned">Banned</option>
                        <option value="restricted">Restricted</option>
                      </select>
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  {/* Misc checkbox toggles */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { state: isLegendary, set: setIsLegendary, label: 'Legendary' },
                      { state: isFoil, set: setIsFoil, label: 'Foil Version' },
                      { state: isPromo, set: setIsPromo, label: 'Promo Version' },
                      { state: isFullArt, set: setIsFullArt, label: 'Full Art' },
                      { state: isTextless, set: setIsTextless, label: 'Textless' },
                      { state: isReprint, set: setIsReprint, label: 'Reprint' },
                    ].map((item) => (
                      <label key={item.label} className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                        <input
                          type="checkbox"
                          checked={item.state}
                          onChange={(e) => item.set(e.target.checked)}
                          className="rounded border-border bg-secondary text-primary focus:ring-primary/40"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search actions buttons */}
            <div className="grid grid-cols-2 gap-2 pb-2">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="h-8 text-xs border-border text-muted-foreground hover:text-foreground transition-transform active:scale-95"
              >
                Reset Filters
              </Button>
              <Button
                onClick={() => handleSearch(1)}
                disabled={isLoadingResults}
                className="h-8 text-xs bg-primary text-primary-foreground font-bold hover:bg-primary/95 flex items-center justify-center gap-1.5 shadow shadow-primary/10 transition-transform active:scale-95"
              >
                {isLoadingResults ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-foreground" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Run Search</span>
              </Button>
            </div>

            <Separator className="opacity-35" />

            {/* Error box */}
            {searchError && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-2.5 rounded-lg">
                {searchError}
              </div>
            )}

            {/* Search Results List */}
            <div className="space-y-2">
              {results.map((card) => {
                const isGameChanger = isGameChangerCard(card.name);
                const quantity = getQuantityInDeck(card);
                return (
                  <div
                    key={card.id}
                    onMouseEnter={() => setPreviewCard(card)}
                    onMouseLeave={() => setPreviewCard(null)}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg border border-border/40 bg-secondary/10 hover:bg-secondary/40 hover:border-primary/20 transition-all select-none group"
                  >
                    {/* Left side: Card artwork crop & name details */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded overflow-hidden shrink-0 border border-border/60 bg-black/40 flex items-center justify-center">
                        <img
                          src={getFrontImageUrl(card) || ''}
                          alt={card.name}
                          className="w-full h-full object-cover select-none pointer-events-none group-hover:scale-105 transition-transform"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs font-semibold truncate block leading-tight ${isGameChanger ? 'text-red-400 font-bold' : 'text-foreground'}`}>
                          {card.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] px-1 py-0.2 rounded border ${RARITY_CLASSES[card.rarity] || 'border-border text-muted-foreground'}`}>
                            {card.rarity.slice(0, 3).toUpperCase()}
                          </span>
                          <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">
                            {card.type_line}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Mana symbols + adding interactions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Cost */}
                      {card.mana_cost && (
                        <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {card.mana_cost.match(/{[^{}]+}/g)?.slice(0, 3).map((sym, idx) => (
                            <img
                              key={idx}
                              src={getManaSymbolUrl(sym)}
                              alt={sym}
                              className="w-3.5 h-3.5 select-none pointer-events-none"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Click to add interaction button */}
                      <button
                        onClick={() => handleAddCard(card)}
                        disabled={addingIds[card.id]}
                        className={`w-7 h-7 rounded-lg border transition-all flex items-center justify-center relative active:scale-90
                          ${
                            quantity > 0
                              ? 'bg-primary/20 border-primary text-primary hover:bg-primary/30'
                              : 'border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-secondary'
                          }`}
                      >
                        {addingIds[card.id] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : quantity > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold font-mono">{quantity}</span>
                          </div>
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Load More Button */}
              {hasMore && (
                <Button
                  onClick={() => handleSearch(page + 1)}
                  disabled={isLoadingResults}
                  variant="outline"
                  className="w-full text-xs h-8 border-dashed hover:border-primary/50 hover:bg-secondary/40 font-bold transition-all text-muted-foreground hover:text-foreground mt-2"
                >
                  {isLoadingResults ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1" />Loading...</>
                  ) : (
                    'Load More Results'
                  )}
                </Button>
              )}

              {/* Empty placeholder */}
              {results.length === 0 && !isLoadingResults && !searchError && (
                <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl p-4 bg-secondary/5 flex flex-col items-center justify-center gap-1">
                  <Search className="w-6 h-6 text-muted-foreground/30 mb-1" />
                  <span className="font-semibold text-foreground">No search matches</span>
                  <span>Type a name or choose filters to start.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Card Image Preview tooltip portal */}
      {previewCard &&
        createPortal(
          <div
            className="fixed z-50 pointer-events-none select-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] border border-white/10 rounded-xl overflow-hidden animate-fade-in-up"
            style={{
              left: `${leftPos}px`,
              top: `${topPos}px`,
              width: `${previewWidth}px`,
              height: `${previewHeight}px`,
            }}
          >
            <img
              src={getFrontImageUrl(previewCard) || ''}
              alt={previewCard.name}
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>,
          document.body
        )}

      {/* Add land modal embedded inside the sidebar wrapper */}
      <AddLandModal open={addLandOpen} onClose={() => setAddLandOpen(false)} deckId={deckId} />
    </aside>
  );
}

function StatBox({
  label,
  value,
  sublabel,
  highlight,
  isGameChanger,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
  isGameChanger?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-3 text-center border transition-all duration-300 ${
        isGameChanger && highlight
          ? 'bg-red-500/10 border-red-500/30 shadow-sm shadow-red-500/5 hover:border-red-500/50 hover:bg-red-500/15'
          : highlight
          ? 'bg-primary/10 border-primary/30 shadow-sm shadow-primary/5'
          : 'bg-secondary border-border hover:border-border/80'
      }`}
    >
      <div
        className={`text-xl font-bold font-mono ${
          isGameChanger && highlight
            ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.2)]'
            : highlight
            ? 'text-primary'
            : 'text-foreground'
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
      {sublabel && <div className="text-[10px] text-muted-foreground/60">{sublabel}</div>}
    </div>
  );
}