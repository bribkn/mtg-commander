'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Flame,
  Check,
  Plus,
  Loader2,
  X,
  Search,
  BookOpen,
  Zap,
  HelpCircle,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useDeck } from '@/lib/deck-store';
import { getCardByExactName, getManaSymbolUrl, ScryfallCard } from '@/lib/scryfall';
import { findMyCombos, FindMyCombosResponse, SpellbookCombo } from '@/lib/spellbook';

interface CombosModalProps {
  open: boolean;
  onClose: () => void;
  deckId?: string;
}

export function CombosModal({ open, onClose, deckId }: CombosModalProps) {
  const { state: globalState, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;

  // Loading and API Data States
  const [data, setData] = useState<FindMyCombosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtering States
  const [presenceFilter, setPresenceFilter] = useState<'included' | 'almostIncluded'>('included');
  const [sizeFilter, setSizeFilter] = useState<'all' | '2' | '3' | '4+'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Adding loading states per card name
  const [addingCardNames, setAddingCardNames] = useState<Record<string, boolean>>({});

  // Hover Card Previews State
  const [previewCardName, setPreviewCardName] = useState<string | null>(null);
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: React.MouseEvent) {
    setMouseCoords({
      x: e.clientX,
      y: e.clientY,
    });
  }

  // Fetch combos on modal open
  useEffect(() => {
    if (open && state?.cards) {
      setIsLoading(true);
      setError('');
      findMyCombos(state.cards)
        .then((res) => {
          setData(res);
        })
        .catch((err) => {
          setError('Error loading combos from Commander Spellbook: ' + err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, state?.cards]);

  if (!state) return null;

  // Add missing card helper
  async function handleAddCard(cardName: string) {
    setAddingCardNames((prev) => ({ ...prev, [cardName]: true }));
    try {
      const card = await getCardByExactName(cardName);
      if (card) {
        dispatch({
          type: 'ADD_CARD',
          card,
          quantity: 1,
          deckId,
        });
      }
    } catch (err) {
      console.error('Error fetching card details from Scryfall: ', err);
    } finally {
      setAddingCardNames((prev) => ({ ...prev, [cardName]: false }));
    }
  }

  // Bracket Level Badge Styling
  const getBracketClass = (tag?: string) => {
    switch (tag) {
      case 'S':
        return 'bg-amber-500/25 text-amber-400 border-amber-500/30 font-extrabold animate-pulse';
      case 'A':
        return 'bg-purple-500/25 text-purple-400 border-purple-500/30 font-bold';
      case 'B':
        return 'bg-blue-500/25 text-blue-400 border-blue-500/30';
      case 'C':
        return 'bg-emerald-500/25 text-emerald-400 border-emerald-500/30';
      case 'D':
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/30';
      default:
        return 'bg-neutral-600/20 text-neutral-400 border-neutral-600/30';
    }
  };

  // Process and filter lists
  const rawList = data
    ? presenceFilter === 'included'
      ? data.included
      : data.almostIncluded
    : [];

  const filteredCombos = rawList.filter((combo) => {
    // 1. Size Filter
    const cardCount = combo.uses.length;
    if (sizeFilter === '2' && cardCount !== 2) return false;
    if (sizeFilter === '3' && cardCount !== 3) return false;
    if (sizeFilter === '4+' && cardCount < 4) return false;

    // 2. Search Query (matches card names or produced features)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCard = combo.uses.some((u) => u.card.name.toLowerCase().includes(q));
      const matchFeature = combo.produces.some((p) => p.feature.name.toLowerCase().includes(q));
      const matchDesc = combo.description.toLowerCase().includes(q);
      return matchCard || matchFeature || matchDesc;
    }

    return true;
  });

  // Calculate coordinates for hover preview portal
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

  // Parse custom activation mana cost strings to SVGs
  const renderManaCost = (manaStr?: string) => {
    if (!manaStr) return null;
    const symbols = manaStr.replace(/[{}]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (symbols.length === 0) return <span className="font-semibold text-foreground text-xs">{manaStr}</span>;

    return (
      <div className="flex items-center gap-0.5 select-none shrink-0">
        {symbols.slice(0, 8).map((s, i) => (
          <img
            key={i}
            src={getManaSymbolUrl(s)}
            alt={s}
            className="w-3.5 h-3.5 select-none pointer-events-none"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        onMouseMove={handleMouseMove}
        className="w-[95vw] sm:max-w-7xl bg-card border-border h-[85vh] flex flex-col overflow-hidden animate-fade-in-up"
      >
        {/* Header */}
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between gap-4 text-gradient-red text-xl font-bold">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-primary animate-pulse" />
              Deck Synergies & Combos
            </div>
            {data && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono border-primary text-primary bg-primary/5 uppercase px-2 py-0.5 shrink-0">
                  Full Combos: {data.included.length}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono border-yellow-500/30 text-yellow-500 bg-yellow-500/5 uppercase px-2 py-0.5 shrink-0">
                  Potential: {data.almostIncluded.length}
                </Badge>
              </div>
            )}
          </DialogTitle>
          <DialogDescription>
            Identify fully realized combos in your current deck list or discover potential additions that synergize with your build. Powered by Commander Spellbook.
          </DialogDescription>
        </DialogHeader>

        {/* Outer Grid */}
        <div className="flex-1 flex flex-col md:flex-row gap-5 overflow-hidden mt-3 min-h-0">
          {/* LEFT SIDEBAR: FILTERS */}
          <div className="w-full md:w-[280px] shrink-0 border border-border/50 rounded-xl bg-secondary/10 p-3.5 flex flex-col overflow-y-auto custom-scrollbar select-none">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Combo Presence</h3>
            <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-lg bg-secondary/40 border border-border/40 mb-5">
              <button
                onClick={() => setPresenceFilter('included')}
                className={`py-1.5 rounded-md text-xs font-bold transition-all ${
                  presenceFilter === 'included'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                In Deck
              </button>
              <button
                onClick={() => setPresenceFilter('almostIncluded')}
                className={`py-1.5 rounded-md text-xs font-bold transition-all ${
                  presenceFilter === 'almostIncluded'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Potential
              </button>
            </div>

            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Card Sizes</h3>
            <div className="grid grid-cols-4 gap-1.5 p-0.5 rounded-lg bg-secondary/40 border border-border/40 mb-5">
              {(['all', '2', '3', '4+'] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setSizeFilter(sz)}
                  className={`py-1.5 rounded-md text-xs font-bold transition-all ${
                    sizeFilter === sz
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {sz === 'all' ? 'All' : sz === '4+' ? '4+' : `${sz}x`}
                </button>
              ))}
            </div>

            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Search Text</h3>
            <div className="relative mb-5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search card name, produces..."
                className="pl-8 h-8 text-xs bg-secondary border-border"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick stats board */}
            <div className="mt-auto border border-border/40 p-3 rounded-lg bg-card/40 space-y-2">
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block"> Synergies Stats</span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Active combos:</span>
                <span className="font-bold text-primary font-mono">{data?.included.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Missing 1 card:</span>
                <span className="font-bold text-yellow-500 font-mono">{data?.almostIncluded.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-border/30 pt-1.5">
                <span className="text-muted-foreground">Showing under filters:</span>
                <span className="font-bold text-foreground font-mono">{filteredCombos.length}</span>
              </div>
            </div>
          </div>

          {/* RIGHT VIEWPORT: LIST */}
          <div className="flex-1 border border-border/50 rounded-xl bg-card/20 flex flex-col overflow-hidden min-h-0">
            {/* Header section info */}
            <div className="px-4 py-2 border-b border-border/40 bg-secondary/10 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {presenceFilter === 'included' ? 'Combos fully assembled in your deck' : 'Potential Combos (missing exactly 1 card)'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center py-28 text-center gap-3">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-sm font-semibold text-muted-foreground">Analyzing deck list synergies in Commander Spellbook...</p>
                </div>
              ) : error ? (
                <div className="h-full flex flex-col items-center justify-center py-28 text-center gap-2 max-w-sm mx-auto">
                  <AlertCircle className="w-10 h-10 text-destructive/80" />
                  <p className="text-sm font-semibold text-foreground">{error}</p>
                </div>
              ) : filteredCombos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-28 text-center max-w-xs mx-auto gap-2.5">
                  <BookOpen className="w-10 h-10 text-muted-foreground/35" />
                  <p className="text-sm font-bold text-foreground">No matches found</p>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? 'Adjust your search term or filters to locate combos.' : 'No combos found under this configuration.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-5 pb-4">
                  {filteredCombos.map((combo) => {
                    return (
                      <div
                        key={combo.id}
                        className="p-4 border border-border/50 hover:border-primary/25 bg-background/30 rounded-xl space-y-4 transition-all hover:shadow-sm"
                      >
                        {/* Upper Section: Bracket tier and outputs */}
                        <div className="flex flex-wrap items-center justify-between gap-3 select-none">
                          <div className="flex items-center gap-2 flex-wrap">
                            {combo.bracketTag && (
                              <Badge className={`text-[10px] font-mono border py-0.5 px-2 tracking-wide uppercase shrink-0 ${getBracketClass(combo.bracketTag)}`}>
                                Tier {combo.bracketTag}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {combo.produces.map((p) => (
                                <Badge
                                  key={p.feature.id}
                                  variant="outline"
                                  className="text-[9px] font-bold border-border/60 bg-secondary/15 hover:bg-secondary/25 transition-colors tracking-wide py-0.5 px-2 text-neutral-200 capitalize"
                                >
                                  {p.feature.name}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Mana Needed */}
                          {combo.manaNeeded && (
                            <div className="flex items-center gap-1.5 bg-secondary/15 px-2 py-0.5 rounded border border-border/30">
                              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Mana Cost:</span>
                              {renderManaCost(combo.manaNeeded)}
                            </div>
                          )}
                        </div>

                        {/* Mid Section: Cards in combo layout */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Required Cards</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {combo.uses.map((use) => {
                              const cardName = use.card.name;
                              const isMissing = presenceFilter === 'almostIncluded' && !state.cards.some((c) => c.name.toLowerCase() === cardName.toLowerCase());
                              const isAdding = addingCardNames[cardName];
                              const cardThumbnail = use.card.imageUriFrontSmall;

                              return (
                                <div
                                  key={use.card.id}
                                  className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                                    isMissing
                                      ? 'border-yellow-500/35 bg-yellow-500/5 shadow-sm'
                                      : 'border-border/40 bg-secondary/10'
                                  }`}
                                >
                                  {/* Info */}
                                  <div
                                    onMouseEnter={() => setPreviewCardName(cardName)}
                                    onMouseLeave={() => setPreviewCardName(null)}
                                    className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none"
                                  >
                                    <div className="relative w-6 h-8 rounded shrink-0 overflow-hidden bg-secondary border border-border/40 shadow-sm">
                                      {cardThumbnail ? (
                                        <img
                                          src={cardThumbnail}
                                          alt={cardName}
                                          className="w-full h-full object-cover absolute inset-0 select-none pointer-events-none"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-muted flex items-center justify-center text-[6px] text-muted-foreground font-mono">
                                          MTG
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs font-semibold text-foreground truncate block hover:text-primary transition-colors leading-tight" title={cardName}>
                                        {cardName}
                                      </span>
                                      <span className="text-[8px] text-muted-foreground truncate block leading-none mt-0.5">
                                        {use.card.typeLine}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Checkmark or Add Quick Button */}
                                  <div className="shrink-0 pl-1 select-none">
                                    {isMissing ? (
                                      <Button
                                        onClick={() => handleAddCard(cardName)}
                                        disabled={isAdding}
                                        size="xs"
                                        className="h-6 text-[8px] font-extrabold uppercase gap-1 bg-yellow-500 hover:bg-yellow-600 text-black rounded shadow shadow-yellow-500/10 active:scale-95 transition-all"
                                      >
                                        {isAdding ? (
                                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        ) : (
                                          <Plus className="w-2.5 h-2.5 stroke-[3px]" />
                                        )}
                                        <span>Add</span>
                                      </Button>
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/35 flex items-center justify-center" title="Present in Deck">
                                        <Check className="w-3 h-3 text-emerald-400 stroke-[3px]" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Prerequisites & Steps description */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/30 pt-3 text-xs">
                          {/* Instructions */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Execution Steps</span>
                            <p className="text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap pl-1 border-l-2 border-primary/20 bg-secondary/5 p-2 rounded">
                              {combo.description}
                            </p>
                          </div>

                          {/* Prerequisites */}
                          <div className="space-y-3">
                            {/* Prerequisites box */}
                            {(combo.easyPrerequisites || combo.notablePrerequisites) && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Prerequisites</span>
                                <p className="text-neutral-400 font-sans leading-relaxed whitespace-pre-wrap bg-secondary/5 p-2 rounded">
                                  {combo.easyPrerequisites || combo.notablePrerequisites}
                                </p>
                              </div>
                            )}

                            {/* Additional requirements info */}
                            {combo.requires.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Required Templates</span>
                                <div className="flex flex-wrap gap-1">
                                  {combo.requires.map((r, i) => (
                                    <Badge key={i} variant="outline" className="text-[8px] font-mono border-dashed border-border text-muted-foreground capitalize bg-secondary/5 py-0.5 px-1.5">
                                      {r.template.name} ({r.quantity}x)
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border/40 pt-4 shrink-0 select-none">
          <Button variant="outline" onClick={onClose}>
            Close Combos Pane
          </Button>
        </div>

        {/* Floating Card Art Preview */}
        {previewCardName && typeof document !== 'undefined' && createPortal(
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
              src={`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(previewCardName)}&format=image&version=normal`}
              alt={previewCardName}
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
