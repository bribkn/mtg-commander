'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Check,
  Plus,
  Loader2,
  X,
  Search,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDeck } from '@/lib/deck-store';
import { getCardByExactName } from '@/lib/scryfall';
import { getEdhrecSlug } from '@/lib/utils';

interface EdhrecSuggestionsModalProps {
  open: boolean;
  onClose: () => void;
  commanderName: string | null;
  deckId?: string;
}

interface EDHRECCardView {
  id: string;
  name: string;
  sanitized: string;
  inclusion: number;
  potential_decks: number;
  label: string;
  synergy?: number;
}

interface EDHRECCardList {
  header: string;
  tag: string;
  cardviews: EDHRECCardView[];
}

interface EDHRECResponse {
  container?: {
    json_dict?: {
      cardlists?: EDHRECCardList[];
    };
  };
}



function formatDeckCount(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

export function EdhrecSuggestionsModal({
  open,
  onClose,
  commanderName,
  deckId,
}: EdhrecSuggestionsModalProps) {
  const { state: globalState, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;

  // Loading and API Data States
  const [data, setData] = useState<EDHRECResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtering & Scrolling States
  const [activeCategoryTag, setActiveCategoryTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addingCardNames, setAddingCardNames] = useState<Record<string, boolean>>({});

  const rightPanelRef = useRef<HTMLDivElement>(null);



  // Fetch suggestions when modal opens
  useEffect(() => {
    if (open && commanderName) {
      setIsLoading(true);
      setError('');
      setData(null);
      setSearchQuery('');

      const slug = getEdhrecSlug(commanderName);
      fetch(`/api/edhrec?slug=${slug}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to load suggestions (Status ${res.status})`);
          }
          return res.json();
        })
        .then((resData) => {
          setData(resData);
          const lists = resData.container?.json_dict?.cardlists ?? [];
          const defaultList = lists.find(
            (l: EDHRECCardList) => l.tag !== 'topcommanders' && l.cardviews?.length > 0
          );
          if (defaultList) {
            setActiveCategoryTag(defaultList.tag);
          } else if (lists.length > 0) {
            setActiveCategoryTag(lists[0].tag);
          }
        })
        .catch((err) => {
          setError(err.message || 'Error loading suggestions from EDHREC.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, commanderName]);



  // Extract raw category lists
  const rawLists = data?.container?.json_dict?.cardlists ?? [];
  const categories = rawLists.filter(
    (list) => list.tag !== 'topcommanders' && list.cardviews && list.cardviews.length > 0
  );

  // Apply card search query filtering across categories
  const categoriesWithFilteredCards = categories.map((cat) => {
    const filtered = cat.cardviews.filter((card) => {
      if (searchQuery.trim()) {
        return card.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
    return {
      ...cat,
      cardviews: filtered,
    };
  }).filter((cat) => cat.cardviews.length > 0);

  // ScrollSpy Intersection Observer
  useEffect(() => {
    const container = rightPanelRef.current;
    if (!container || isLoading || categoriesWithFilteredCards.length === 0) return;

    const observerOptions = {
      root: container,
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const tag = entry.target.getAttribute('data-category-tag');
          if (tag) {
            setActiveCategoryTag(tag);
          }
        }
      });
    }, observerOptions);

    const sections = container.querySelectorAll('[data-category-section]');
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, [isLoading, searchQuery, data, categoriesWithFilteredCards.length]);

  if (!state) return null;

  // Add card to deck helper
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

  // Handle smooth sidebar navigation
  const handleCategoryClick = (tag: string) => {
    const element = document.getElementById(`category-section-${tag}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveCategoryTag(tag);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={true}
        className="w-[95vw] sm:max-w-7xl bg-card border-border h-[85vh] flex flex-col overflow-hidden animate-fade-in-up"
      >
        {/* Header */}
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle className="flex items-center justify-between gap-4 text-gradient-red text-xl font-bold">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-primary animate-pulse" />
              EDHREC Suggestions: {commanderName}
            </div>
          </DialogTitle>
          <DialogDescription>
            Discover and add cards commonly played in {commanderName} Commander decks. Data sourced directly from EDHREC.
          </DialogDescription>
        </DialogHeader>

        {/* Outer Grid */}
        <div className="flex-1 flex flex-col md:flex-row gap-5 overflow-hidden mt-3 min-h-0">
          {/* LEFT SIDEBAR: SUMMARY & CATEGORIES */}
          <div className="w-full md:w-[280px] shrink-0 border border-border/50 rounded-xl bg-secondary/10 p-3.5 flex flex-col overflow-y-auto custom-scrollbar select-none font-sans">


            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
              Suggestion Types
            </h3>
            
            {isLoading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="h-8 rounded bg-secondary/40 animate-pulse" />
                ))}
              </div>
            ) : categoriesWithFilteredCards.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4">No categories found.</div>
            ) : (
              <div className="space-y-1">
                {categoriesWithFilteredCards.map((cat) => {
                  const isActive = cat.tag === activeCategoryTag;
                  return (
                    <button
                      key={cat.tag}
                      onClick={() => handleCategoryClick(cat.tag)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/45'
                      }`}
                    >
                      <span className="truncate">{cat.header}</span>
                      <Badge
                        variant={isActive ? 'default' : 'outline'}
                        className={`text-[9px] font-mono shrink-0 ml-1.5 ${
                          isActive
                            ? 'bg-primary-foreground/20 text-primary-foreground border-transparent'
                            : 'border-border/60 text-muted-foreground'
                        }`}
                      >
                        {cat.cardviews?.length ?? 0}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}

            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mt-6 mb-2">
              Filter Suggestions
            </h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search card name..."
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
          </div>

          {/* RIGHT VIEWPORT: ALL CARD GRIDS VERTICALLY */}
          <div className="flex-1 border border-border/50 rounded-xl bg-card/20 flex flex-col overflow-hidden min-h-0">
            <div
              ref={rightPanelRef}
              className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0 scroll-smooth relative"
            >
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center py-28 text-center gap-3">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-sm font-semibold text-muted-foreground">
                    Fetching recommendations from EDHREC...
                  </p>
                </div>
              ) : error ? (
                <div className="h-full flex flex-col items-center justify-center py-28 text-center gap-2 max-w-sm mx-auto">
                  <AlertCircle className="w-10 h-10 text-destructive/80" />
                  <p className="text-sm font-semibold text-foreground">{error}</p>
                </div>
              ) : categoriesWithFilteredCards.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-28 text-center max-w-xs mx-auto gap-2.5">
                  <BookOpen className="w-10 h-10 text-muted-foreground/35" />
                  <p className="text-sm font-bold text-foreground">No recommendations</p>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? 'Adjust your search query.' : 'No cards found for this Commander.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-10">
                  {categoriesWithFilteredCards.map((cat) => (
                    <div
                      key={cat.tag}
                      id={`category-section-${cat.tag}`}
                      data-category-tag={cat.tag}
                      data-category-section="true"
                      className="scroll-mt-4"
                    >
                      {/* Section Title Header */}
                      <h3 className="text-xs font-bold text-muted-foreground mb-4 pb-2 border-b border-border/30 uppercase tracking-wider flex items-center justify-between">
                        <span>{cat.header}</span>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                          {cat.cardviews.length} cards
                        </Badge>
                      </h3>

                      {/* Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                        {cat.cardviews.map((card) => {
                          const cardName = card.name;
                          const isPresent = state.cards.some(
                            (c) => c.name.toLowerCase() === cardName.toLowerCase()
                          );
                          const isAdding = addingCardNames[cardName];
                          
                          // Inclusion & Synergy Values
                          const inclusionPercent = card.potential_decks > 0 
                            ? Math.round((card.inclusion / card.potential_decks) * 100) 
                            : 0;
                          
                          const synergyVal = typeof card.synergy === 'number' 
                            ? Math.round(card.synergy * 100) 
                            : 0;
                          const synergyText = synergyVal >= 0 ? `+${synergyVal}%` : `${synergyVal}%`;
                          const isNegativeSynergy = synergyVal < 0;

                          return (
                            <div
                              key={card.id || card.sanitized}
                              className={`flex flex-col justify-between p-3.5 rounded-xl border bg-background/50 transition-all duration-300 ${
                                isPresent
                                  ? 'border-emerald-500/20 bg-emerald-500/[0.01]'
                                  : 'border-border/40 hover:border-primary/25 hover:bg-background/80 shadow-sm'
                              }`}
                            >
                              {/* Card Artwork */}
                              <div className="relative w-full aspect-[5/7] rounded-lg overflow-hidden border border-border/40 bg-zinc-950/60 shadow-inner group">
                                <img
                                  src={`https://api.scryfall.com/cards/${card.id}?format=image&version=normal`}
                                  alt={cardName}
                                  className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-300 group-hover:scale-[1.03]"
                                  loading="lazy"
                                />
                                {isPresent && (
                                  <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-extrabold uppercase py-0.5 px-1.5 rounded-full flex items-center gap-0.5 shadow z-10">
                                    <Check className="w-2.5 h-2.5 stroke-[3px]" />
                                    <span>Added</span>
                                  </div>
                                )}
                              </div>

                              {/* Card Info & Statistics */}
                              <div className="mt-3 flex flex-col justify-end flex-grow">
                                <div
                                  className="text-xs font-bold text-foreground truncate block select-text"
                                  title={cardName}
                                >
                                  {cardName}
                                </div>
                                
                                {/* Inclusion Row */}
                                <div className="flex items-center justify-between mt-3 text-xs">
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-base font-extrabold text-foreground">{inclusionPercent}%</span>
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">inclusion</span>
                                  </div>
                                  <div className="flex flex-col items-end text-[10px] text-muted-foreground font-mono leading-none">
                                    <span className="font-bold text-foreground">{formatDeckCount(card.inclusion)} decks</span>
                                    <div className="w-10 h-[1px] bg-muted-foreground/30 my-1" />
                                    <span>{formatDeckCount(card.potential_decks)} decks</span>
                                  </div>
                                </div>

                                {/* Synergy Row */}
                                <div className="text-center mt-2.5 pt-2 border-t border-border/10">
                                  <span className={`text-xs font-extrabold ${isNegativeSynergy ? 'text-red-500' : 'text-[#53b6eb]'}`}>
                                    {synergyText}
                                  </span>
                                  <span 
                                    className={`text-[10px] font-bold uppercase tracking-wider ml-1 border-b border-dashed cursor-help ${
                                      isNegativeSynergy 
                                        ? 'text-red-500/80 border-red-500/40' 
                                        : 'text-[#53b6eb]/80 border-[#53b6eb]/40'
                                    }`}
                                    title="Synergy score compares how often this card is run under this commander vs how often it is run overall in these colors."
                                  >
                                    synergy
                                  </span>
                                </div>

                                {/* Action Button */}
                                <div className="mt-3.5">
                                  {isPresent ? (
                                    <Button
                                      disabled
                                      className="w-full h-8 text-[10px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                                    >
                                      <Check className="w-3 h-3 stroke-[3px] mr-1" />
                                      In Deck
                                    </Button>
                                  ) : (
                                    <Button
                                      onClick={() => handleAddCard(cardName)}
                                      disabled={isAdding}
                                      className="w-full h-8 text-[10px] font-extrabold uppercase bg-yellow-500 hover:bg-yellow-600 text-black rounded shadow shadow-yellow-500/10 active:scale-[0.98] transition-all"
                                    >
                                      {isAdding ? (
                                        <>
                                          <Loader2 className="w-3 animate-spin mr-1" />
                                          Adding...
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="w-3 h-3 stroke-[3px] mr-1" />
                                          Add to Deck
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border/40 pt-4 shrink-0 select-none">
          <Button variant="outline" onClick={onClose}>
            Close Suggestions
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

