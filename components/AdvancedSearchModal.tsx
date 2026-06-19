'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  SlidersHorizontal, Plus, Minus, Check, Loader2, Search, X, 
  ChevronLeft, ChevronRight, Sparkles, User, Image as ImageIcon, Info, HelpCircle, Crown
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useDeck } from '@/lib/deck-store';
import { ScryfallCard, searchCards, getFrontImageUrl, getManaSymbolUrl } from '@/lib/scryfall';

interface AdvancedSearchModalProps {
  open: boolean;
  onClose: () => void;
  deckId?: string;
}

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

export function AdvancedSearchModal({ open, onClose, deckId }: AdvancedSearchModalProps) {
  const { state: globalState, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;

  // Commander details for color identity restriction
  const commander = state?.cards.find((c) => c.isCommander) ?? null;
  const commanderIdentity = commander?.scryfallData.color_identity ?? [];

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
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
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCardsCount, setTotalCardsCount] = useState<number | undefined>(undefined);
  const [error, setError] = useState('');
  const [lastQuery, setLastQuery] = useState('');

  // Local card adding loading states
  const [addingIds, setAddingIds] = useState<Record<string, boolean>>({});

  // Preview State
  const [previewCard, setPreviewCard] = useState<ScryfallCard | null>(null);
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: React.MouseEvent) {
    setMouseCoords({
      x: e.clientX,
      y: e.clientY,
    });
  }

  // Restrict to Commander Identity Sync
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

  // Build the Scryfall search query string based on visual filter states
  const buildScryfallQuery = useCallback(() => {
    const parts: string[] = [];

    // General term
    if (searchTerm.trim()) {
      parts.push(searchTerm.trim());
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

    // Leave lands aside as per user rule ("dejando de lado las tierras")
    // Unless the user explicitly searches for land, we exclude it
    const hasLandSearch = activeTypes.includes('other'); // "other" excludes land
    if (!hasLandSearch) {
      parts.push('-t:land');
    }

    // Colors
    const activeColors = Object.keys(selectedColors).filter((c) => selectedColors[c]);
    if (activeColors.length > 0) {
      const colorsStr = activeColors.join('');
      parts.push(`c${colorMatch}${colorsStr}`);
    }

    // Color Identity
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

    // Power
    if (powValue.trim()) {
      const num = parseInt(powValue, 10);
      if (!isNaN(num)) {
        parts.push(`pow${powOperator}${num}`);
      }
    }

    // Toughness
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

    // Set Code
    if (setCode.trim()) {
      parts.push(`s:${setCode.trim().toLowerCase()}`);
    }

    // Artist
    if (artistName.trim()) {
      parts.push(`a:"${artistName.trim()}"`);
    }

    // Subtype
    if (subtypeName.trim()) {
      parts.push(`t:${subtypeName.trim().toLowerCase()}`);
    }

    // Format Legality
    if (legalityFormat) {
      parts.push(`${legalityStatus}:${legalityFormat}`);
    }

    // Misc
    if (isLegendary) parts.push('is:legendary');
    if (isFoil) parts.push('is:foil');
    if (isPromo) parts.push('is:promo');
    if (isFullArt) parts.push('is:full');
    if (isTextless) parts.push('is:textless');
    if (isReprint) parts.push('is:reprint');

    return parts.join(' ');
  }, [
    searchTerm, selectedTypes, selectedColors, colorMatch, 
    selectedIdentity, identityMatch, restrictCommander, commanderIdentity,
    cmcValue, cmcOperator, powValue, powOperator, touValue, touOperator,
    selectedRarities, setCode, artistName, subtypeName, legalityFormat, legalityStatus,
    isLegendary, isFoil, isPromo, isFullArt, isTextless, isReprint
  ]);

  // Execute search
  const handleSearch = useCallback(async (searchPage: number = 1) => {
    const query = buildScryfallQuery();
    if (!query.trim()) {
      setError('Please type a search term or select some filters to search.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    if (searchPage === 1) {
      setResults([]);
      setTotalCardsCount(undefined);
    }

    try {
      const res = await searchCards(query, searchPage);
      if (res && res.data) {
        if (searchPage === 1) {
          setResults(res.data);
        } else {
          setResults((prev) => [...prev, ...res.data]);
        }
        setHasMore(res.has_more);
        setTotalCardsCount(res.total_cards);
        setPage(searchPage);
        setLastQuery(query);
      } else {
        if (searchPage === 1) {
          setResults([]);
          setError('No cards found with these filters.');
        }
        setHasMore(false);
      }
    } catch (err: any) {
      setError('Error connecting to Scryfall: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [buildScryfallQuery]);

  // Quick reset all filters
  function handleResetFilters() {
    setSearchTerm('');
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
    setError('');
    setTotalCardsCount(undefined);
    setPage(1);
    setHasMore(false);
  }

  // Handle adding card to deck
  async function handleAddCard(card: ScryfallCard) {
    if (!state) return;
    setAddingIds((prev) => ({ ...prev, [card.id]: true }));
    try {
      dispatch({
        type: 'ADD_CARD',
        card,
        quantity: 1,
        deckId,
      });
    } finally {
      // Small timeout for added animation feedback
      setTimeout(() => {
        setAddingIds((prev) => ({ ...prev, [card.id]: false }));
      }, 500);
    }
  }

  // Calculate preview position to keep it inside screen boundaries
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        showCloseButton={false} 
        onMouseMove={handleMouseMove}
        className="w-[95vw] sm:max-w-7xl bg-card border-border h-[85vh] flex flex-col overflow-hidden animate-fade-in-up"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between gap-4 text-gradient-red text-xl font-bold">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              Advanced Card Search
            </div>
            {totalCardsCount !== undefined && (
              <Badge variant="outline" className="text-xs font-mono border-primary text-primary bg-primary/5 uppercase px-2 py-0.5 shrink-0">
                Found: {totalCardsCount}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Search and filter cards using Scryfall's powerful search engine and add them to your deck in one click.
          </DialogDescription>
        </DialogHeader>

        {/* Dual Column Layout */}
        <div className="flex-1 flex flex-col md:flex-row gap-5 overflow-hidden mt-3">
          {/* LEFT COLUMN: FILTERS */}
          <div className="w-full md:w-[350px] h-[320px] md:h-full border border-border/50 rounded-xl bg-secondary/10 p-3.5 flex flex-col overflow-hidden shrink-0 min-h-0">
            {/* Top Fixed Panel: Search & Reset Buttons */}
            <div className="grid grid-cols-2 gap-2 pb-3.5 border-b border-border/40 shrink-0">
              <Button 
                variant="outline" 
                onClick={handleResetFilters}
                className="h-8 text-xs border-border text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
              >
                Reset All
              </Button>
              <Button 
                onClick={() => handleSearch(1)}
                disabled={isLoading}
                className="h-8 text-xs bg-primary text-primary-foreground font-bold hover:bg-primary/95 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all duration-150"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-foreground" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                Search
              </Button>
            </div>

            {/* Scrollable Filters List */}
            <div className="flex-1 overflow-y-auto pr-2 mt-3 select-none custom-scrollbar">
              <div className="space-y-4 pb-4">
                
                {/* Search Text input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Text Search</span>
                    <button
                      type="button"
                      onClick={() => setIsLegendary(!isLegendary)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all duration-300 flex items-center gap-1 active:scale-95 cursor-pointer select-none
                        ${isLegendary
                          ? 'bg-primary/15 border-primary/30 text-primary shadow-sm shadow-primary/5 hover:bg-primary/25'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                        }`}
                    >
                      <Crown className="w-2.5 h-2.5 text-primary animate-pulse" />
                      <span>Legendary</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Name, oracle text, etc..."
                      className="pl-8 h-8 text-xs bg-secondary border-border"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch(1)}
                    />
                  </div>
                </div>

                <Separator className="opacity-30" />

                {/* Categories / Card Type quick toggles */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Card Type</span>
                  <div className="flex flex-wrap gap-1.5">
                    {CARD_TYPES.map((type) => {
                      const isActive = selectedTypes[type.id];
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            setSelectedTypes((prev) => ({ ...prev, [type.id]: !prev[type.id] }));
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                            isActive
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'border-border bg-secondary/35 text-muted-foreground hover:text-foreground hover:bg-secondary/75'
                          }`}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator className="opacity-30" />

                {/* Colors Panel */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Card Colors</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {['W', 'U', 'B', 'R', 'G', 'C'].map((color) => {
                      const isActive = selectedColors[color];
                      return (
                        <button
                          key={color}
                          onClick={() => {
                            setSelectedColors((prev) => ({ ...prev, [color]: !prev[color] }));
                          }}
                          className={`w-7 h-7 rounded-full transition-all flex items-center justify-center overflow-hidden bg-background ${
                            isActive
                              ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110 shadow-lg opacity-100'
                              : 'border border-border/40 hover:scale-105 hover:border-border/80 opacity-60 hover:opacity-100'
                          }`}
                          title={`Color ${color}`}
                        >
                          <img
                            src={getManaSymbolUrl(color)}
                            alt={color}
                            className="w-full h-full select-none pointer-events-none object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator className="opacity-30" />

                {/* Color Identity Panel */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Color Identity</span>
                  </div>

                  {commander && (
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-primary cursor-pointer hover:text-primary/80 transition-colors py-0.5 select-none">
                      <input
                        type="checkbox"
                        checked={restrictCommander}
                        onChange={(e) => setRestrictCommander(e.target.checked)}
                        className="rounded border-border bg-secondary text-primary focus:ring-primary/40 focus:ring-offset-background"
                      />
                      <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                      <span>Restrict to Commander's Colors ({commanderIdentity.join('') || 'C'})</span>
                    </label>
                  )}

                  {!restrictCommander && (
                    <div className="flex items-center gap-1.5">
                      {['W', 'U', 'B', 'R', 'G'].map((color) => {
                        const isActive = selectedIdentity[color];
                        return (
                          <button
                            key={color}
                            onClick={() => {
                              setSelectedIdentity((prev) => ({ ...prev, [color]: !prev[color] }));
                            }}
                            className={`w-7 h-7 rounded-full transition-all flex items-center justify-center overflow-hidden bg-background ${
                              isActive
                                ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110 shadow-lg opacity-100'
                                : 'border border-border/40 hover:scale-105 hover:border-border/80 opacity-60 hover:opacity-100'
                            }`}
                            title={`Identity ${color}`}
                          >
                            <img
                              src={getManaSymbolUrl(color)}
                              alt={color}
                              className="w-full h-full select-none pointer-events-none object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator className="opacity-30" />

                {/* CMC / Mana Value */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Mana Value (CMC)</span>
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

                  {/* Power */}
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
                        placeholder="Power"
                        value={powValue}
                        onChange={(e) => setPowValue(e.target.value)}
                        className="h-7 text-xs bg-secondary border-border w-full text-center font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Toughness */}
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
                        placeholder="Toughness"
                        value={touValue}
                        onChange={(e) => setTouValue(e.target.value)}
                        className="h-7 text-xs bg-secondary border-border w-full text-center font-mono"
                      />
                    </div>
                  </div>

                  {/* Subtype */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Subtype (e.g. Goblin)</span>
                    <Input
                      placeholder="Elf, Goblin, Aura..."
                      value={subtypeName}
                      onChange={(e) => setSubtypeName(e.target.value)}
                      className="h-7 text-xs bg-secondary border-border w-full"
                    />
                  </div>
                </div>

                <Separator className="opacity-30" />

                {/* Rarity */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Rarity</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['common', 'uncommon', 'rare', 'mythic'].map((rarity) => {
                      const isActive = selectedRarities[rarity];
                      return (
                        <button
                          key={rarity}
                          onClick={() => {
                            setSelectedRarities((prev) => ({ ...prev, [rarity]: !prev[rarity] }));
                          }}
                          className={`px-2 py-1 rounded-md text-[9px] font-bold border transition-all text-center capitalize ${
                            isActive
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'border-border bg-secondary/35 text-muted-foreground hover:text-foreground hover:bg-secondary/75'
                          }`}
                        >
                          {rarity === 'uncommon' ? 'Uncommon' : rarity === 'rare' ? 'Rare' : rarity === 'mythic' ? 'Mythic' : 'Common'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator className="opacity-30" />

                {/* Set & Artist */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Set</span>
                    <Input
                      placeholder="SOS, NEO, MH2..."
                      value={setCode}
                      onChange={(e) => setSetCode(e.target.value)}
                      className="h-7 text-xs bg-secondary border-border font-mono text-center uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Artist</span>
                    <Input
                      placeholder="Rebecca Guay..."
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      className="h-7 text-xs bg-secondary border-border"
                    />
                  </div>
                </div>

                <Separator className="opacity-30" />

                {/* Legality Filter */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
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
                      <option value="pioneer">Pioneer</option>
                      <option value="vintage">Vintage</option>
                    </select>
                  </div>
                  <div className="space-y-1">
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

                {/* Misc Option Toggles */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Misc Filters</span>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                      <input
                        type="checkbox"
                        checked={isLegendary}
                        onChange={(e) => setIsLegendary(e.target.checked)}
                        className="rounded border-border bg-secondary text-primary focus:ring-primary/40"
                      />
                      <span>Legendary</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                      <input
                        type="checkbox"
                        checked={isFoil}
                        onChange={(e) => setIsFoil(e.target.checked)}
                        className="rounded border-border bg-secondary text-primary focus:ring-primary/40"
                      />
                      <span>Available Foil</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                      <input
                        type="checkbox"
                        checked={isPromo}
                        onChange={(e) => setIsPromo(e.target.checked)}
                        className="rounded border-border bg-secondary text-primary focus:ring-primary/40"
                      />
                      <span>Promo</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                      <input
                        type="checkbox"
                        checked={isFullArt}
                        onChange={(e) => setIsFullArt(e.target.checked)}
                        className="rounded border-border bg-secondary text-primary focus:ring-primary/40"
                      />
                      <span>Full Art</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                      <input
                        type="checkbox"
                        checked={isTextless}
                        onChange={(e) => setIsTextless(e.target.checked)}
                        className="rounded border-border bg-secondary text-primary focus:ring-primary/40"
                      />
                      <span>Textless</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                      <input
                        type="checkbox"
                        checked={isReprint}
                        onChange={(e) => setIsReprint(e.target.checked)}
                        className="rounded border-border bg-secondary text-primary focus:ring-primary/40"
                      />
                      <span>Reprint</span>
                    </label>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: RESULTS GRID */}
          <div className="flex-1 border border-border/50 rounded-xl bg-card flex flex-col overflow-hidden">
            
            {/* Header info */}
            <div className="px-4 py-2 border-b border-border/40 bg-secondary/15 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Search Results
              </span>
              {results.length > 0 && lastQuery && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px] sm:max-w-xs md:max-w-md hidden sm:inline" title={lastQuery}>
                    Query: {lastQuery}
                  </span>
                </div>
              )}
            </div>

            {/* Scrollable Results Area */}
            <ScrollArea onMouseMove={handleMouseMove} className="flex-1 p-4">
              {results.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-24 text-center px-6">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-3 animate-fade-in">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground font-semibold">Searching cards in the Scryfall library...</p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center gap-2 max-w-sm">
                      <Info className="w-9 h-9 text-destructive/80" />
                      <p className="text-sm font-semibold text-foreground">{error}</p>
                      <p className="text-xs text-muted-foreground">Adjust filters or type keywords in the search box.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2.5 max-w-xs">
                      <Search className="w-10 h-10 text-muted-foreground/35 mb-1" />
                      <p className="text-sm font-bold text-foreground">Scryfall Search Ready</p>
                      <p className="text-xs text-muted-foreground">
                        Use the filters on the left and click "Search" to fetch cards from the official MTG database.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Results Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center pr-1">
                    {results.map((card) => {
                      const cardImg = getFrontImageUrl(card);
                      const existing = state?.cards.find((c) => c.scryfallId === card.id);
                      const qty = existing ? existing.quantity : 0;
                      const isAdding = addingIds[card.id];

                      return (
                        <div
                          key={card.id}
                          className="relative flex flex-col items-center w-[120px] sm:w-[140px] group/card animate-fade-in-up"
                        >
                          {/* Card Image Container */}
                          <div 
                            onMouseEnter={() => setPreviewCard(card)}
                            onMouseLeave={() => setPreviewCard(null)}
                            onClick={() => handleAddCard(card)}
                            className={`relative w-full aspect-[5/7] rounded-lg overflow-hidden border bg-secondary cursor-pointer shadow-md transition-all duration-300 group-hover/card:scale-[1.03] group-hover/card:shadow-lg ${
                              qty > 0 
                                ? 'border-primary ring-1 ring-primary/45 shadow-primary/10' 
                                : 'border-border/60 hover:border-primary/50'
                            }`}
                          >
                            {cardImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cardImg}
                                alt={card.name}
                                className="w-full h-full object-cover select-none"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col justify-between p-2 text-center bg-muted">
                                <span className="text-[10px] font-bold text-foreground truncate block w-full">{card.name}</span>
                                <span className="text-[8px] text-muted-foreground block">{card.type_line}</span>
                              </div>
                            )}

                            {/* Hover overlay details */}
                            <div className="absolute inset-0 bg-black/85 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2 text-center select-none z-10">
                              <span className="text-[10px] font-bold text-foreground leading-tight truncate px-0.5">
                                {card.name}
                              </span>
                              <span className="text-[8px] text-muted-foreground mt-0.5 truncate block w-full">
                                {card.type_line}
                              </span>
                              
                              <div className="mt-1.5 flex justify-center">
                                <Badge variant="outline" className={`text-[7px] border font-mono font-bold capitalize py-0 px-1 ${RARITY_CLASSES[card.rarity] || 'border-border'}`}>
                                  {card.set.toUpperCase()} · {card.rarity}
                                </Badge>
                              </div>
                            </div>

                            {/* Deck count indicator */}
                            {qty > 0 && (
                              <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground w-5 h-5 rounded-full border border-primary-foreground/20 text-[10px] font-mono font-bold flex items-center justify-center shadow-md z-15">
                                {qty}x
                              </div>
                            )}

                            {/* Color indicators on base */}
                            {card.colors && card.colors.length > 0 && (
                              <div className="absolute top-1.5 left-1.5 flex gap-0.5 z-15">
                                {card.colors.slice(0, 3).map((c) => (
                                  <span key={c} className="w-2.5 h-2.5 rounded-full border border-neutral-900/60 bg-neutral-900 flex items-center justify-center text-[5px] font-bold text-white shadow-sm font-mono leading-none">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quick Info & Quick Add Button */}
                          <div className="w-full mt-2 flex flex-col items-center">
                            <span className="text-[10px] font-bold text-foreground leading-tight text-center truncate w-full select-none" title={card.name}>
                              {card.name}
                            </span>
                            
                            <Button
                              onClick={() => handleAddCard(card)}
                              disabled={isAdding}
                              size="sm"
                              className={`h-6 mt-1.5 w-full text-[9px] font-bold gap-1 rounded-md transition-all active:scale-95 ${
                                isAdding 
                                  ? 'bg-emerald-600/35 text-emerald-300' 
                                  : qty > 0 
                                  ? 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20' 
                                  : 'bg-secondary hover:bg-primary hover:text-primary-foreground text-muted-foreground'
                              }`}
                            >
                              {isAdding ? (
                                <>
                                  <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-400" />
                                  <span>Adding</span>
                                </>
                              ) : qty > 0 ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-primary" />
                                  <span>Add more</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Add</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination / Load More */}
                  {hasMore && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        onClick={() => handleSearch(page + 1)}
                        disabled={isLoading}
                        className="text-xs h-8 px-5 gap-1.5 border-border hover:border-primary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/40 font-semibold"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        Load More Results
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>

        </div>

        {/* Footer actions */}
        <div className="flex justify-end border-t border-border/40 pt-4 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close Searcher
          </Button>
        </div>

        {/* Floating high-res card art preview */}
        {previewCard && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed pointer-events-none z-[9999] w-[250px] aspect-[5/7] rounded-xl overflow-hidden border border-primary/45 bg-neutral-950/95 backdrop-blur-md shadow-[0_25px_60px_rgba(0,0,0,0.85)] transition-all duration-75 ease-out animate-in fade-in zoom-in-95"
            style={{
              left: `${leftPos}px`,
              top: `${topPos}px`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
              <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(previewCard.name)}&format=image&version=normal`}
              alt={previewCard.name}
              className="relative z-10 w-full h-full object-cover rounded-xl transition-opacity duration-200"
              onLoad={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = '1';
              }}
              style={{ opacity: 0 }}
            />
          </div>,
          document.body
        )}
      </DialogContent>
    </Dialog>
  );
}
