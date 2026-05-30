'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Crown,
  Minus,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Grid,
  Layers3,
  AlignJustify,
  List,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Search,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useDeck, DeckCard } from '@/lib/deck-store';
import { CATEGORY_ORDER, CardCategory, getThumbnailUrl, ScryfallCard } from '@/lib/scryfall';

// Mana symbol colors
const MANA_COLORS: Record<string, string> = {
  W: 'bg-yellow-100 text-yellow-900',
  U: 'bg-blue-500 text-white',
  B: 'bg-gray-800 text-gray-200',
  R: 'bg-red-600 text-white',
  G: 'bg-green-600 text-white',
  C: 'bg-gray-500 text-white',
};

function ManaCost({ cost }: { cost?: string }) {
  if (!cost) return null;
  const symbols = cost.replace(/[{}]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return (
    <div className="flex items-center gap-0.5">
      {symbols.slice(0, 6).map((s, i) => {
        const colorKey = s.toUpperCase();
        const colorClass = MANA_COLORS[colorKey];
        return (
          <span
            key={i}
            className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold border border-black/20 ${colorClass ?? 'bg-gray-600 text-white'
              }`}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

interface CardRowProps {
  card: DeckCard;
  onVariantOpen: (card: DeckCard) => void;
}

function CardRow({ card, onVariantOpen }: CardRowProps) {
  const { state, dispatch } = useDeck();
  const [imgError, setImgError] = useState(false);
  const thumbnailUrl = getThumbnailUrl(card.scryfallData);
  const isCover = state?.coverCardId === card.scryfallId;

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors animate-fade-in-up"
    >
      {/* Thumbnail */}
      <div className="relative w-8 h-11 rounded shrink-0 overflow-hidden bg-secondary border border-border">
        {thumbnailUrl && !imgError ? (
          <Image
            src={thumbnailUrl}
            alt={card.name}
            fill
            className="object-cover"
            sizes="32px"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-[8px] text-muted-foreground text-center leading-tight px-0.5">
              {card.name.slice(0, 4)}
            </span>
          </div>
        )}
        {card.isCommander && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <Crown className="w-3.5 h-3.5 text-primary drop-shadow" />
          </div>
        )}
      </div>

      {/* Card name & mana */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate text-foreground leading-none">
            {card.name}
          </span>
          {card.isCommander && (
            <Crown className="w-3.5 h-3.5 text-primary shrink-0" />
          )}
          {isCover && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary text-primary bg-primary/5 uppercase font-mono">
              Cover
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <ManaCost cost={card.scryfallData.mana_cost} />
          <span className="text-[10px] text-muted-foreground truncate hidden sm:block">
            {card.scryfallData.type_line?.split('—')[0]?.trim()}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Set as commander */}
        {!card.isCommander && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-muted-foreground hover:text-primary"
            title="Set as Commander"
            onClick={() => dispatch({ type: 'SET_COMMANDER', scryfallId: card.scryfallId })}
          >
            <Crown className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* Set as cover image */}
        <Button
          variant="ghost"
          size="icon"
          className={`w-6 h-6 transition-colors ${isCover ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'
            }`}
          title={isCover ? 'Remove as Deck Cover' : 'Set as Deck Cover'}
          onClick={() => {
            if (isCover) {
              dispatch({ type: 'UNSET_COVER_CARD' });
            } else {
              dispatch({ type: 'SET_COVER_CARD', scryfallId: card.scryfallId });
            }
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </Button>

        {/* Change Variant Art */}
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-muted-foreground hover:text-primary"
          title="Change Art Variant"
          onClick={() => onVariantOpen(card)}
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </Button>

        {/* Quantity controls */}
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-muted-foreground hover:text-foreground"
          onClick={() => dispatch({ type: 'DECREMENT_QUANTITY', scryfallId: card.scryfallId })}
        >
          <Minus className="w-3 h-3" />
        </Button>

        <span className="w-6 text-center text-sm font-mono font-semibold text-foreground">
          {card.quantity}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-muted-foreground hover:text-foreground"
          onClick={() => dispatch({ type: 'INCREMENT_QUANTITY', scryfallId: card.scryfallId })}
        >
          <Plus className="w-3 h-3" />
        </Button>

        {/* Remove */}
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-muted-foreground hover:text-destructive"
          onClick={() => dispatch({ type: 'REMOVE_CARD', scryfallId: card.scryfallId })}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

type ViewMode = 'grid' | 'stack' | 'text' | 'condensed';

interface CategorySectionProps {
  category: CardCategory;
  cards: DeckCard[];
  viewMode: ViewMode;
  onVariantOpen: (card: DeckCard) => void;
}

function CategorySection({
  category,
  cards,
  viewMode,
  onVariantOpen,
}: CategorySectionProps) {
  const { state, dispatch } = useDeck();
  const [expanded, setExpanded] = useState(true);
  const total = cards.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors border-b border-border/20 mb-2 bg-secondary/5"
      >
        <span>{category}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono border-border">
            {total}
          </Badge>
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </div>
      </button>

      {expanded && (
        <>
          {/* 1. TEXT VIEW (Standard rows with thumbnail) */}
          {viewMode === 'text' && (
            <div className="space-y-0.5">
              {cards.map((card) => (
                <CardRow key={card.scryfallId} card={card} onVariantOpen={onVariantOpen} />
              ))}
            </div>
          )}

          {/* 2. CONDENSED VIEW (Super tight grid with quantity + name) */}
          {viewMode === 'condensed' && (
            <div className="px-3 divide-y divide-border/20 space-y-0.5">
              {cards.map((card) => {
                const isCover = state?.coverCardId === card.scryfallId;
                return (
                  <div
                    key={card.scryfallId}
                    className="group flex items-center justify-between py-1 text-xs hover:bg-secondary/40 rounded px-1.5 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-semibold text-primary w-5 shrink-0">
                        {card.quantity}x
                      </span>
                      <span className="font-medium text-foreground truncate">
                        {card.name}
                      </span>
                      {card.isCommander && <Crown className="w-3 h-3 text-primary shrink-0" />}
                      {isCover && <Sparkles className="w-3 h-3 text-primary shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => dispatch({ type: 'DECREMENT_QUANTITY', scryfallId: card.scryfallId })}
                        className="w-4 h-4 rounded hover:bg-secondary hover:text-foreground text-muted-foreground flex items-center justify-center font-bold text-[10px]"
                      >
                        -
                      </button>
                      <button
                        onClick={() => dispatch({ type: 'INCREMENT_QUANTITY', scryfallId: card.scryfallId })}
                        className="w-4 h-4 rounded hover:bg-secondary hover:text-foreground text-muted-foreground flex items-center justify-center font-bold text-[10px]"
                      >
                        +
                      </button>
                      <button
                        onClick={() => {
                          if (isCover) {
                            dispatch({ type: 'UNSET_COVER_CARD' });
                          } else {
                            dispatch({ type: 'SET_COVER_CARD', scryfallId: card.scryfallId });
                          }
                        }}
                        className={`p-0.5 rounded transition-colors ${isCover ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                          }`}
                        title={isCover ? 'Remove Cover' : 'Set as Cover'}
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onVariantOpen(card)}
                        className="text-muted-foreground hover:text-primary p-0.5"
                        title="Change Variant"
                      >
                        <ImageIcon className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => dispatch({ type: 'REMOVE_CARD', scryfallId: card.scryfallId })}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. VISUAL GRID VIEW (5:7 Ratio high-res card faces - EXTRA LARGE size) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2 px-2 py-2 justify-items-center">
              {cards.map((card) => {
                const cardImg =
                  card.scryfallData.image_uris?.normal ||
                  card.scryfallData.card_faces?.[0]?.image_uris?.normal ||
                  '';
                const isCover = state?.coverCardId === card.scryfallId;

                return (
                  <div
                    key={card.scryfallId}
                    className={`relative w-[200px] sm:w-[250px] aspect-[5/7] rounded-xl overflow-hidden border shadow-lg bg-secondary group/visual transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl animate-fade-in-up ${isCover ? 'border-primary ring-2 ring-primary/40' : 'border-border/80'
                      }`}
                  >
                    {cardImg ? (
                      <Image
                        src={cardImg}
                        alt={card.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 200px, 250px"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted p-3 flex flex-col justify-between items-center text-center">
                        <span className="text-[11px] font-bold text-foreground truncate w-full">
                          {card.name}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{card.category}</span>
                      </div>
                    )}

                    {card.isCommander && (
                      <div className="absolute top-1.5 left-1.5 bg-black/85 p-0.5 rounded border border-primary/40 z-10 flex items-center justify-center">
                        <Crown className="w-4 h-4 text-primary" />
                      </div>
                    )}

                    {isCover && !card.isCommander && (
                      <div className="absolute top-1.5 left-1.5 bg-black/85 p-0.5 rounded border border-primary/40 z-10 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                      </div>
                    )}

                    <div className="absolute top-1.5 right-1.5 bg-black/85 p-0.5 px-2 rounded border border-border/40 z-10 text-[10px] font-mono font-bold">
                      {card.quantity}x
                    </div>

                    {/* Dark Crimson Hover Overlay */}
                    <div className="absolute inset-0 bg-black/85 border border-primary/20 opacity-0 group-hover/visual:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2.5 z-10 text-center">
                      <span className="text-xs sm:text-sm font-bold text-foreground leading-tight truncate px-0.5">
                        {card.name}
                      </span>

                      <div className="flex flex-col gap-2 w-full mt-1">
                        <div className="flex gap-1.5 justify-center">
                          {!card.isCommander && (
                            <button
                              onClick={() =>
                                dispatch({ type: 'SET_COMMANDER', scryfallId: card.scryfallId })
                              }
                              className="p-1 rounded bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                              title="Set as Commander"
                            >
                              <Crown className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (isCover) {
                                dispatch({ type: 'UNSET_COVER_CARD' });
                              } else {
                                dispatch({ type: 'SET_COVER_CARD', scryfallId: card.scryfallId });
                              }
                            }}
                            className={`p-1 rounded transition-colors ${isCover
                                ? 'bg-primary/30 text-primary border border-primary/40'
                                : 'bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary'
                              }`}
                            title={isCover ? 'Remove as Cover' : 'Set as Cover'}
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onVariantOpen(card)}
                            className="p-1 rounded bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                            title="Change Art"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              dispatch({ type: 'REMOVE_CARD', scryfallId: card.scryfallId })
                            }
                            className="p-1 rounded bg-secondary/80 hover:bg-destructive/20 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between bg-black/60 border border-border/30 rounded py-0.5 px-2">
                          <button
                            onClick={() =>
                              dispatch({ type: 'DECREMENT_QUANTITY', scryfallId: card.scryfallId })
                            }
                            className="text-muted-foreground hover:text-foreground font-bold text-sm px-1.5"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono font-bold text-foreground">
                            {card.quantity}
                          </span>
                          <button
                            onClick={() =>
                              dispatch({ type: 'INCREMENT_QUANTITY', scryfallId: card.scryfallId })
                            }
                            className="text-muted-foreground hover:text-foreground font-bold text-sm px-1.5"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. VISUAL STACK VIEW (Overlapping piles showing top art - HEROIC size) */}
          {viewMode === 'stack' && (
            <div className="flex flex-col px-4 py-8 space-y-[-325px] sm:space-y-[-390px] hover:space-y-[-300px] sm:hover:space-y-[-360px] transition-all duration-300">
              {cards.map((card, idx) => {
                const cardImg =
                  card.scryfallData.image_uris?.normal ||
                  card.scryfallData.card_faces?.[0]?.image_uris?.normal ||
                  '';
                const isCover = state?.coverCardId === card.scryfallId;

                return (
                  <div
                    key={card.scryfallId}
                    style={{ zIndex: 10 + idx }}
                    className={`relative w-[260px] sm:w-[310px] aspect-[5/7] rounded-xl overflow-hidden border shadow-lg bg-secondary group/stack hover:border-primary/60 hover:shadow-2xl hover:translate-y-[-40px] hover:scale-[1.05] transition-all duration-300 shrink-0 ${isCover ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                      }`}
                  >
                    {cardImg ? (
                      <Image
                        src={cardImg}
                        alt={card.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 260px, 310px"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted p-3 flex flex-col justify-between items-center text-center">
                        <span className="text-sm font-bold text-foreground truncate w-full">
                          {card.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{card.category}</span>
                      </div>
                    )}

                    {card.isCommander && (
                      <div className="absolute top-2 left-2 bg-black/85 p-0.5 rounded border border-primary/40 z-10 flex items-center justify-center">
                        <Crown className="w-4 h-4 text-primary" />
                      </div>
                    )}

                    {isCover && !card.isCommander && (
                      <div className="absolute top-2 left-2 bg-black/85 p-0.5 rounded border border-primary/40 z-10 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                      </div>
                    )}

                    <div className="absolute top-2 right-2 bg-black/85 p-0.5 px-2 rounded border border-border/40 z-10 text-[11px] font-mono font-bold">
                      {card.quantity}x
                    </div>

                    {/* Dark Crimson Hover Overlay */}
                    <div className="absolute inset-0 bg-black/85 border border-primary/20 opacity-0 group-hover/stack:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 z-10 text-center">
                      <span className="text-sm font-bold text-foreground leading-tight truncate px-0.5">
                        {card.name}
                      </span>

                      <div className="flex flex-col gap-2 w-full mt-1">
                        <div className="flex gap-1.5 justify-center">
                          {!card.isCommander && (
                            <button
                              onClick={() =>
                                dispatch({ type: 'SET_COMMANDER', scryfallId: card.scryfallId })
                              }
                              className="p-1 rounded bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                              title="Set as Commander"
                            >
                              <Crown className="w-4.5 h-4.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (isCover) {
                                dispatch({ type: 'UNSET_COVER_CARD' });
                              } else {
                                dispatch({ type: 'SET_COVER_CARD', scryfallId: card.scryfallId });
                              }
                            }}
                            className={`p-1 rounded transition-colors ${isCover
                                ? 'bg-primary/30 text-primary border border-primary/40'
                                : 'bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary'
                              }`}
                            title={isCover ? 'Remove as Cover' : 'Set as Cover'}
                          >
                            <Sparkles className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => onVariantOpen(card)}
                            className="p-1 rounded bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                            title="Cambiar Arte"
                          >
                            <ImageIcon className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() =>
                              dispatch({ type: 'REMOVE_CARD', scryfallId: card.scryfallId })
                            }
                            className="p-1 rounded bg-secondary/80 hover:bg-destructive/20 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between bg-black/60 border border-border/30 rounded py-0.5 px-2">
                          <button
                            onClick={() =>
                              dispatch({ type: 'DECREMENT_QUANTITY', scryfallId: card.scryfallId })
                            }
                            className="text-muted-foreground hover:text-foreground font-bold text-sm px-2"
                          >
                            -
                          </button>
                          <span className="text-sm font-mono font-bold text-foreground">
                            {card.quantity}
                          </span>
                          <button
                            onClick={() =>
                              dispatch({ type: 'INCREMENT_QUANTITY', scryfallId: card.scryfallId })
                            }
                            className="text-muted-foreground hover:text-foreground font-bold text-sm px-2"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CardList() {
  const { state, totalCards, dispatch } = useDeck();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterQuery, setFilterQuery] = useState('');

  // Variant selector states
  const [variantCard, setVariantCard] = useState<DeckCard | null>(null);
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [loadingPrints, setLoadingPrints] = useState(false);
  const [printsError, setPrintsError] = useState('');

  // Fetch variants from Scryfall when variantCard changes
  useEffect(() => {
    if (!variantCard) {
      setPrintings([]);
      setPrintsError('');
      return;
    }

    setLoadingPrints(true);
    setPrintsError('');

    // Fetch all printings of card
    const url = `https://api.scryfall.com/cards/search?q=!%22${encodeURIComponent(
      variantCard.name
    )}%22&unique=prints`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('No printings found.');
        return res.json();
      })
      .then((data) => {
        setPrintings(data.data ?? []);
      })
      .catch((err) => {
        setPrintsError('Error fetching variants: ' + err.message);
      })
      .finally(() => {
        setLoadingPrints(false);
      });
  }, [variantCard]);

  if (!state) return null;

  if (state.cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Crown className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No cards yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Search for cards above, import from Moxfield/Archidekt, or paste a bulk list.
        </p>
      </div>
    );
  }

  // Filter cards by name
  const filteredCards = state.cards.filter((card) =>
    card.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  // Group cards by category
  const grouped = new Map<CardCategory, DeckCard[]>();
  for (const cat of CATEGORY_ORDER) {
    grouped.set(cat, []);
  }
  for (const card of filteredCards) {
    const list = grouped.get(card.category);
    if (list) list.push(card);
  }

  // Sort within each category: commander first, then alphabetically
  for (const [, cards] of grouped) {
    cards.sort((a, b) => {
      if (a.isCommander && !b.isCommander) return -1;
      if (!a.isCommander && b.isCommander) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* View Mode Selection & Local Filtering Bar */}
      <div className="px-4 py-2 border-b border-border bg-secondary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter cards in deck..."
            className="pl-8 h-8 text-xs bg-secondary/50 border-border focus:border-primary/50 focus:ring-primary/20"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex bg-secondary p-0.5 rounded-lg border border-border/60 self-end sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 px-2.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${viewMode === 'grid'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Visual Grid</span>
          </button>
          <button
            onClick={() => setViewMode('stack')}
            className={`p-1 px-2.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${viewMode === 'stack'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Layers3 className="w-3.5 h-3.5" />
            <span>Visual Stack</span>
          </button>
          <button
            onClick={() => setViewMode('text')}
            className={`p-1 px-2.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${viewMode === 'text'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <AlignJustify className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
          <button
            onClick={() => setViewMode('condensed')}
            className={`p-1 px-2.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${viewMode === 'condensed'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Condensed</span>
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-hidden">
        <div className="pb-4">
          {/* Card count summary */}
          <div className="px-3 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {filterQuery ? (
                <span>
                  {filteredCards.length} filtered (of {state.cards.length})
                </span>
              ) : (
                <span>{state.cards.length} unique cards</span>
              )}
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              {filterQuery ? (
                <span>
                  {filteredCards.reduce((sum, c) => sum + c.quantity, 0)} total filtered
                </span>
              ) : (
                <span>{totalCards} total</span>
              )}
            </span>
          </div>
          <Separator className="mb-2" />

          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <Search className="w-10 h-10 text-muted-foreground/45 mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">No matches</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                No cards found matching &ldquo;{filterQuery}&rdquo; in this deck.
              </p>
            </div>
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const cards = grouped.get(cat) ?? [];
              if (cards.length === 0) return null;
              return (
                <div key={cat}>
                  <CategorySection
                    category={cat}
                    cards={cards}
                    viewMode={viewMode}
                    onVariantOpen={(card) => setVariantCard(card)}
                  />
                  <Separator className="my-1 opacity-30" />
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Art Printing Variant Selector Dialog */}
      <Dialog open={variantCard !== null} onOpenChange={() => setVariantCard(null)}>
        <DialogContent className="w-[95vw] sm:max-w-5xl bg-card border-border max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gradient-red text-xl font-bold">
              <ImageIcon className="w-5 h-5 text-primary" />
              Art & Printing Variants
            </DialogTitle>
            <DialogDescription>
              Choose your preferred printing for{' '}
              <strong className="text-foreground">{variantCard?.name}</strong>. This will update the
              card art across the builder and exported files.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-4">
            {loadingPrints ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground animate-pulse">
                  Fetching printings from Scryfall...
                </p>
              </div>
            ) : printsError ? (
              <div className="text-center py-12 text-sm text-destructive border border-destructive/20 bg-destructive/5 rounded-xl">
                {printsError}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 justify-items-center">
                {printings.map((print) => {
                  const printImg =
                    print.image_uris?.normal || print.card_faces?.[0]?.image_uris?.normal || '';
                  const isCurrent = variantCard?.scryfallId === print.id;

                  return (
                    <div
                      key={print.id}
                      onClick={() => {
                        if (variantCard) {
                          dispatch({
                            type: 'UPDATE_CARD_DATA',
                            scryfallId: variantCard.scryfallId,
                            newCardData: print,
                          });
                          setVariantCard(null);
                        }
                      }}
                      className={`relative w-[150px] sm:w-[200px] aspect-[5/7] rounded-xl overflow-hidden cursor-pointer border transition-all duration-300 group/print ${isCurrent
                          ? 'border-primary ring-2 ring-primary bg-primary/5 shadow-lg shadow-primary/20 scale-[1.03]'
                          : 'border-border/60 hover:border-primary/50 hover:scale-[1.02]'
                        }`}
                    >
                      {printImg ? (
                        <Image
                          src={printImg}
                          alt={print.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 150px, 200px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs bg-secondary">
                          {print.set.toUpperCase()}
                        </div>
                      )}

                      {/* Dark overlay showing Set Code on hover */}
                      <div className="absolute inset-0 bg-black/85 opacity-0 group-hover/print:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5 text-center z-10">
                        <span className="text-xs font-bold text-foreground leading-tight truncate">
                          {print.set_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold font-mono mt-0.5">
                          {print.set} · {print.rarity}
                        </span>
                      </div>

                      {/* Active indicator */}
                      {isCurrent && (
                        <div className="absolute top-2 right-2 bg-primary p-0.5 rounded-full z-10 flex items-center justify-center">
                          <Crown className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-border/40 pt-4">
            <Button variant="outline" onClick={() => setVariantCard(null)}>
            Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
