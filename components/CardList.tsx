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
  Zap,
  Copy,
  ArrowRightLeft,
  SlidersHorizontal,
  Swords,
  Gem,
  BookOpen,
  Mountain,
  ShieldAlert,
  HelpCircle,
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
import { CustomCardsModal } from './CustomCardsModal';
import { CATEGORY_ORDER, CardCategory, getThumbnailUrl, ScryfallCard, isDoubleFaced, isGameChangerCard, getManaSymbolUrl } from '@/lib/scryfall';

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
  deckId?: string;
  onTransferCard?: (card: DeckCard, mode: 'copy' | 'move') => void;
}

function CardRow({ card, onVariantOpen, deckId, onTransferCard }: CardRowProps) {
  const { state: globalState, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;
  const [imgError, setImgError] = useState(false);
  const thumbnailUrl = getThumbnailUrl(card.scryfallData);
  const isCover = state?.coverCardId === card.scryfallId;
  const isBanned = card.scryfallData.legalities?.commander === 'banned';

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors animate-fade-in-up"
    >
      {/* Thumbnail */}
      <div className="relative w-8 h-11 rounded shrink-0 overflow-hidden bg-secondary border border-border">
        {thumbnailUrl && !imgError ? (
          <img
            src={thumbnailUrl}
            alt={card.name}
            className="w-full h-full object-cover absolute inset-0 select-none"
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
          <span className={`text-sm font-medium truncate leading-none ${isBanned ? 'text-red-400 line-through' : 'text-foreground'}`}>
            {card.name}
          </span>
          {card.isCommander && (
            <Crown className="w-3.5 h-3.5 text-primary shrink-0" />
          )}
          {isBanned && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-red-500 text-red-400 bg-red-500/5 uppercase font-mono animate-pulse">
              Banned
            </Badge>
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
        {/* Transfer / Copy Card Option */}
        {onTransferCard && (
          <div className="flex gap-0.5 border-r border-border/40 pr-1.5 mr-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-muted-foreground hover:text-primary"
              title="Copy to other deck"
              onClick={() => onTransferCard(card, 'copy')}
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-muted-foreground hover:text-primary animate-pulse"
              title="Move to other deck"
              onClick={() => onTransferCard(card, 'move')}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-green-400" />
            </Button>
          </div>
        )}

        {/* Set as commander */}
        {!card.isCommander && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-muted-foreground hover:text-primary"
            title="Set as Commander"
            onClick={() => dispatch({ type: 'SET_COMMANDER', scryfallId: card.scryfallId, deckId })}
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
              dispatch({ type: 'UNSET_COVER_CARD', deckId });
            } else {
              dispatch({ type: 'SET_COVER_CARD', scryfallId: card.scryfallId, deckId });
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

        {/* View Combos */}
        <a
          href={`https://commanderspellbook.com/?q=card%3A%22${encodeURIComponent(card.name)}%22`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-6 h-6 rounded hover:bg-secondary text-muted-foreground hover:text-primary flex items-center justify-center transition-colors"
          title="View Combos (Spellbook)"
        >
          <Zap className="w-3.5 h-3.5 text-amber-500 hover:scale-110 transition-transform" />
        </a>

        {/* Quantity controls */}
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-muted-foreground hover:text-foreground"
          onClick={() => dispatch({ type: 'DECREMENT_QUANTITY', scryfallId: card.scryfallId, deckId })}
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
          onClick={() => dispatch({ type: 'INCREMENT_QUANTITY', scryfallId: card.scryfallId, deckId })}
        >
          <Plus className="w-3 h-3" />
        </Button>

        {/* Remove */}
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-muted-foreground hover:text-destructive"
          onClick={() => dispatch({ type: 'REMOVE_CARD', scryfallId: card.scryfallId, deckId })}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function PremiumListRow({ 
  card, 
  onVariantOpen, 
  deckId, 
  onTransferCard 
}: { 
  card: DeckCard; 
  onVariantOpen: (card: DeckCard) => void;
  deckId?: string;
  onTransferCard?: (card: DeckCard, mode: 'copy' | 'move') => void;
}) {
  const { customCards, dispatch, state: globalState, decks } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;
  const isCover = state?.coverCardId === card.scryfallId;

  // Check custom alters
  const hasAlter = customCards && customCards.some(
    (cc) => cc.associatedScryfallId === card.scryfallId || cc.associatedName.toLowerCase() === card.name.toLowerCase()
  );

  // Check game changer
  const isGc = isGameChangerCard(card.name);

  // Check banned
  const isBanned = card.scryfallData.legalities?.commander === 'banned';

  // Parse mana symbols
  const manaCost = card.scryfallData.mana_cost || '';
  const symbols = manaCost.replace(/[{}]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return (
    <div className="group flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-secondary/40 transition-colors text-xs select-none">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {/* Quantity */}
        <span className="font-mono font-bold text-neutral-400 w-5 shrink-0 text-left">
          {card.quantity}
        </span>
        
        {/* Card Name with Badges */}
        <div className="flex items-center gap-1 min-w-0 truncate">
          <span className={`font-medium truncate hover:text-primary transition-colors cursor-pointer ${isBanned ? 'text-red-400 line-through' : 'text-foreground'}`} title={card.name} onClick={() => onVariantOpen(card)}>
            {card.name}
          </span>
          {isBanned && (
            <span className="text-[8px] font-bold text-red-500 bg-red-500/10 px-1 py-0.5 rounded shadow-sm border border-red-500/15 shrink-0 animate-pulse" title="Banned in Commander">
              BANNED
            </span>
          )}
          {isGc && (
            <span className="text-[8px] font-bold text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded shadow-sm border border-amber-500/15 shrink-0 animate-pulse" title="Game Changer Card">
              GC
            </span>
          )}
          {hasAlter && (
            <span className="text-[8px] font-bold text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded shadow-sm border border-blue-500/15 shrink-0" title="Custom Alter Art">
              CB
            </span>
          )}
          {isDoubleFaced(card.scryfallData) && (
            <span className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 leading-none" title="Double-Faced Card">
              ⟲
            </span>
          )}
        </div>
      </div>

      {/* Right Column: Mana cost & Actions */}
      <div className="flex items-center gap-2.5 shrink-0 pl-2">
        {/* Mana Cost */}
        {symbols.length > 0 && (
          <div className="flex items-center gap-0.5 select-none">
            {symbols.slice(0, 5).map((s, i) => (
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
        )}

        {/* Quick Hover Action Buttons */}
        <div className="w-0 overflow-hidden group-hover:w-[130px] flex items-center gap-1.5 transition-all duration-300 opacity-0 group-hover:opacity-100 pl-1 border-l border-border/40 ml-1">
          {/* Decrement */}
          <button
            onClick={() => dispatch({ type: 'DECREMENT_QUANTITY', scryfallId: card.scryfallId, deckId })}
            className="p-0.5 rounded bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
            title="Decrease Quantity"
          >
            <Minus className="w-3 h-3" />
          </button>
          
          {/* Increment */}
          <button
            onClick={() => dispatch({ type: 'INCREMENT_QUANTITY', scryfallId: card.scryfallId, deckId })}
            className="p-0.5 rounded bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
            title="Increase Quantity"
          >
            <Plus className="w-3 h-3" />
          </button>

          {/* Commander set */}
          {!card.isCommander && (
            <button
              onClick={() => dispatch({ type: 'SET_COMMANDER', scryfallId: card.scryfallId, deckId })}
              className="p-0.5 rounded bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
              title="Set as Commander"
            >
              <Crown className="w-3 h-3" />
            </button>
          )}

          {/* Cover card set */}
          <button
            onClick={() => {
              if (isCover) {
                dispatch({ type: 'UNSET_COVER_CARD', deckId });
              } else {
                dispatch({ type: 'SET_COVER_CARD', scryfallId: card.scryfallId, deckId });
              }
            }}
            className={`p-0.5 rounded transition-colors ${isCover ? 'bg-primary/30 text-primary border border-primary/40' : 'bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-foreground'}`}
            title={isCover ? 'Remove as Cover' : 'Set as Cover'}
          >
            <Sparkles className="w-3 h-3" />
          </button>

          {/* Change Art */}
          <button
            onClick={() => onVariantOpen(card)}
            className="p-0.5 rounded bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
            title="Change Art Printing"
          >
            <ImageIcon className="w-3 h-3" />
          </button>

          {/* Delete */}
          <button
            onClick={() => dispatch({ type: 'REMOVE_CARD', scryfallId: card.scryfallId, deckId })}
            className="p-0.5 rounded bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-red-400 active:scale-95 transition-transform"
            title="Delete Card"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Commander: Crown,
  Creature: Swords,
  Artifact: Gem,
  Enchantment: Sparkles,
  Instant: Zap,
  Sorcery: BookOpen,
  Land: Mountain,
  Planeswalker: ShieldAlert,
  Battle: HelpCircle,
  Other: HelpCircle,
};

function PremiumListSection({
  category,
  cards,
  onVariantOpen,
  deckId,
  onTransferCard,
}: {
  category: string;
  cards: DeckCard[];
  onVariantOpen: (card: DeckCard) => void;
  deckId?: string;
  onTransferCard?: (card: DeckCard, mode: 'copy' | 'move') => void;
}) {
  const totalQuantity = cards.reduce((sum, c) => sum + c.quantity, 0);

  const IconComponent = CATEGORY_ICONS[category] || HelpCircle;

  return (
    <div className="bg-background/25 border border-border/40 rounded-xl p-3.5 shadow-sm">
      {/* Category Header */}
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2 mb-2 select-none">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
          <IconComponent className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            {category === 'Commander' ? 'COMMANDER' : category === 'Creature' ? 'CREATURE' : category === 'Artifact' ? 'ARTIFACT' : category === 'Enchantment' ? 'ENCHANTMENT' : category === 'Instant' ? 'INSTANT' : category === 'Sorcery' ? 'SORCERY' : category === 'Land' ? 'LAND' : category === 'Planeswalker' ? 'PLANESWALKER' : category === 'Battle' ? 'BATTLE' : 'OTHER'}
            {' '}({totalQuantity})
          </span>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-0.5">
        {cards.map((card) => (
          <PremiumListRow
            key={card.scryfallId}
            card={card}
            onVariantOpen={onVariantOpen}
            deckId={deckId}
            onTransferCard={onTransferCard}
          />
        ))}
      </div>
    </div>
  );
}

type ViewMode = 'grid' | 'text';

interface CategorySectionProps {
  category: CardCategory;
  cards: DeckCard[];
  viewMode: ViewMode;
  onVariantOpen: (card: DeckCard) => void;
  deckId?: string;
  onTransferCard?: (card: DeckCard, mode: 'copy' | 'move') => void;
}

function CategorySection({
  category,
  cards,
  viewMode,
  onVariantOpen,
  deckId,
  onTransferCard,
}: CategorySectionProps) {
  const { state: globalState, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;
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
                <CardRow key={card.scryfallId} card={card} onVariantOpen={onVariantOpen} deckId={deckId} onTransferCard={onTransferCard} />
              ))}
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
                const isBanned = card.scryfallData.legalities?.commander === 'banned';

                return (
                  <div
                    key={card.scryfallId}
                    className={`relative w-[200px] sm:w-[250px] aspect-[5/7] rounded-xl overflow-hidden border shadow-lg bg-secondary group/visual transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl animate-fade-in-up ${isCover ? 'border-primary ring-2 ring-primary/40' : 'border-border/80'
                      }`}
                  >
                    {cardImg ? (
                      <img
                        src={cardImg}
                        alt={card.name}
                        className="w-full h-full object-cover absolute inset-0 select-none"
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

                    {isBanned && (
                      <div className="absolute top-1.5 left-1.5 bg-red-950/95 px-1.5 py-0.5 rounded border border-red-500/40 z-10 flex items-center justify-center gap-1 shadow-md animate-pulse">
                        <ShieldAlert className="w-3 text-red-500 shrink-0" />
                        <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider font-mono">Banned</span>
                      </div>
                    )}

                    {card.isCommander && !isBanned && (
                      <div className="absolute top-1.5 left-1.5 bg-black/85 p-0.5 rounded border border-primary/40 z-10 flex items-center justify-center">
                        <Crown className="w-4 h-4 text-primary" />
                      </div>
                    )}

                    {isCover && !card.isCommander && !isBanned && (
                      <div className="absolute top-1.5 left-1.5 bg-black/85 p-0.5 rounded border border-primary/40 z-10 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                      </div>
                    )}

                    <div className="absolute top-1.5 right-1.5 bg-black/85 p-0.5 px-2 rounded border border-border/40 z-10 text-[10px] font-mono font-bold">
                      {card.quantity}x
                    </div>

                    {/* Dark Crimson Hover Overlay */}
                    <div className="absolute inset-0 bg-black/85 border border-primary/20 opacity-0 group-hover/visual:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2.5 z-10 text-center">
                      <span className={`text-xs sm:text-sm font-bold leading-tight truncate px-0.5 ${isBanned ? 'text-red-400 line-through' : 'text-foreground'}`}>
                        {card.name}
                      </span>
                      {isBanned && (
                        <span className="text-[10px] text-red-500 font-extrabold uppercase tracking-wide bg-red-500/10 py-0.5 rounded border border-red-500/15 animate-pulse mt-0.5">
                          BANNED IN COMMANDER
                        </span>
                      )}

                      <div className="flex flex-col gap-2 w-full mt-1">
                        <div className="flex gap-1.5 justify-center flex-wrap">
                          {/* Copy/Move to other deck */}
                          {onTransferCard && (
                            <>
                              <button
                                onClick={() => onTransferCard(card, 'copy')}
                                className="p-1 rounded bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors border border-blue-500/20"
                                title="Copy to other deck"
                              >
                                <Copy className="w-4 h-4 text-blue-400" />
                              </button>
                              <button
                                onClick={() => onTransferCard(card, 'move')}
                                className="p-1 rounded bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors border border-green-500/20 animate-pulse"
                                title="Move to other deck"
                              >
                                <ArrowRightLeft className="w-4 h-4 text-green-400" />
                              </button>
                            </>
                          )}
                          {!card.isCommander && (
                            <button
                              onClick={() =>
                                dispatch({ type: 'SET_COMMANDER', scryfallId: card.scryfallId, deckId })
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
                                dispatch({ type: 'UNSET_COVER_CARD', deckId });
                              } else {
                                dispatch({ type: 'SET_COVER_CARD', scryfallId: card.scryfallId, deckId });
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
                          <a
                            href={`https://commanderspellbook.com/?q=card%3A%22${encodeURIComponent(card.name)}%22`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-secondary/80 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
                            title="View Combos (Spellbook)"
                          >
                            <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
                          </a>
                          <button
                            onClick={() =>
                              dispatch({ type: 'REMOVE_CARD', scryfallId: card.scryfallId, deckId })
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
                              dispatch({ type: 'DECREMENT_QUANTITY', scryfallId: card.scryfallId, deckId })
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
                              dispatch({ type: 'INCREMENT_QUANTITY', scryfallId: card.scryfallId, deckId })
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
        </>
      )}
    </div>
  );
}

interface CardListProps {
  deckId?: string;
  onTransferCard?: (card: DeckCard, mode: 'copy' | 'move') => void;
}

export function CardList({ deckId, onTransferCard }: CardListProps = {}) {
  const { state: globalState, decks, totalCards: globalTotalCards, customCards, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;
  const totalCards = state ? state.cards.reduce((sum, c) => sum + c.quantity, 0) : globalTotalCards;

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedCmc, setSelectedCmc] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSubtype, setSelectedSubtype] = useState<string>('all');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showOnlyGameChangers, setShowOnlyGameChangers] = useState(false);

  // Variant selector states
  const [variantCard, setVariantCard] = useState<DeckCard | null>(null);
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [loadingPrints, setLoadingPrints] = useState(false);
  const [printsError, setPrintsError] = useState('');
  const [printsFilter, setPrintsFilter] = useState<'all' | 'fullart' | 'borderless' | 'retro'>('all');
  const [printsSetSearch, setPrintsSetSearch] = useState('');

  // Reset print dialog filters when opening a new card
  useEffect(() => {
    setPrintsFilter('all');
    setPrintsSetSearch('');
  }, [variantCard]);

  // Fetch variants from Scryfall when variantCard, printsFilter, or printsSetSearch changes
  useEffect(() => {
    if (!variantCard) {
      setPrintings([]);
      setPrintsError('');
      return;
    }

    setLoadingPrints(true);
    setPrintsError('');

    // Build the query
    let query = `!"${variantCard.name}"`;

    if (printsFilter === 'fullart') {
      query += ' is:fullart';
    } else if (printsFilter === 'borderless') {
      query += ' is:borderless';
    } else if (printsFilter === 'retro') {
      query += ' frame:1997';
    }

    if (printsSetSearch.trim()) {
      const cleanSet = printsSetSearch.trim();
      if (cleanSet.length === 3) {
        query += ` (s:${cleanSet} or set:${cleanSet})`;
      } else {
        query += ` set:"${cleanSet}"`;
      }
    }

    // Fetch printings of card ordered by release date descending (newest first)
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints&order=released`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('No printings found matching the filters.');
          return res.json();
        })
        .then((data) => {
          const results: ScryfallCard[] = data.data ?? [];
          // Filter out cards that are not exactly the same card (name match)
          const exactMatches = results.filter(
            (print) => print.name.toLowerCase() === variantCard.name.toLowerCase()
          );
          setPrintings(exactMatches);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setPrintsError('Error fetching variants: ' + err.message);
          }
        })
        .finally(() => {
          setLoadingPrints(false);
        });
    }, 300); // 300ms debounce to avoid spamming the Scryfall API

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [variantCard, printsFilter, printsSetSearch]);

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

  // Dynamically extract all unique subtypes present in the deck's cards
  const allSubtypes = Array.from(
    new Set(
      state.cards.flatMap((card) => {
        const typeLine = card.scryfallData.type_line || '';
        const typeLines = card.scryfallData.card_faces
          ? card.scryfallData.card_faces.map((f) => f.type_line || '')
          : [typeLine];

        return typeLines.flatMap((line) => {
          if (!line.includes('—')) return [];
          const parts = line.split('—');
          const rightPart = parts[1] || '';
          return rightPart.trim().split(/\s+/).filter(Boolean);
        });
      })
    )
  ).sort();

  // Filter cards by name, CMC, card type, and subtype
  const filteredCards = state.cards.filter((card) => {
    // Name filter
    const matchesName = card.name.toLowerCase().includes(filterQuery.toLowerCase());
    if (!matchesName) return false;

    // Game Changer filter
    if (showOnlyGameChangers) {
      if (!isGameChangerCard(card.name)) return false;
    }

    // CMC filter
    if (selectedCmc !== 'all') {
      const cardCmc = card.scryfallData.cmc ?? 0;
      if (selectedCmc === '7+') {
        if (cardCmc < 7) return false;
      } else {
        if (cardCmc !== parseInt(selectedCmc, 10)) return false;
      }
    }

    // Type filter
    if (selectedType !== 'all') {
      if (card.category !== selectedType) return false;
    }

    // Subtype filter
    if (selectedSubtype !== 'all') {
      const typeLine = card.scryfallData.type_line || '';
      const typeLines = card.scryfallData.card_faces
        ? card.scryfallData.card_faces.map((f) => f.type_line || '')
        : [typeLine];

      const hasSubtype = typeLines.some((line) => {
        if (!line.includes('—')) return false;
        const parts = line.split('—');
        const rightPart = parts[1] || '';
        const subtypes = rightPart.trim().split(/\s+/).filter(Boolean);
        return subtypes.includes(selectedSubtype);
      });

      if (!hasSubtype) return false;
    }

    // Color filter
    if (selectedColor !== 'all') {
      const colors = card.scryfallData.colors || [];
      if (selectedColor === 'C') {
        if (colors.length > 0) return false;
      } else if (selectedColor === 'multicolor') {
        if (colors.length <= 1) return false;
      } else {
        if (!colors.includes(selectedColor)) return false;
      }
    }

    return true;
  });

  // Group cards by category
  const grouped = new Map<string, DeckCard[]>();
  grouped.set('Commander', []);
  for (const cat of CATEGORY_ORDER) {
    grouped.set(cat, []);
  }
  for (const card of filteredCards) {
    if (viewMode === 'text' && card.isCommander) {
      grouped.get('Commander')?.push(card);
    } else {
      grouped.get(card.category)?.push(card);
    }
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
      <div className="px-4 py-3 border-b border-border bg-secondary/10 flex flex-col gap-3 shrink-0">
        {/* Top Row: Search input and View Mode tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:max-w-xs">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter cards in deck..."
                className="pl-8 h-8 text-xs bg-secondary/50 border-border focus:border-primary/50 focus:ring-primary/20 w-full"
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`h-8 text-xs gap-1.5 shrink-0 px-2.5 border-border hover:border-primary/50 hover:text-primary transition-colors ${
                showAdvancedFilters || selectedCmc !== 'all' || selectedType !== 'all' || selectedSubtype !== 'all'
                  ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/15'
                  : 'hover:bg-secondary'
              }`}
              title="Toggle Advanced Filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {(selectedCmc !== 'all' || selectedType !== 'all' || selectedSubtype !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
              )}
            </Button>
          </div>

          <div className="flex bg-secondary p-0.5 rounded-lg border border-border/60 self-end sm:self-auto shrink-0">
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
              onClick={() => setViewMode('text')}
              className={`p-1 px-2.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${viewMode === 'text'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Mana Value and Card Type filters */}
        {showAdvancedFilters && (
          <div className="flex flex-col gap-2 border-t border-border/20 pt-2 bg-background/5 p-2 rounded-lg border border-border/30 animate-fade-in-up">
            {/* Converted Mana Cost Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-w-[75px]">Mana Value:</span>
              <div className="flex flex-wrap gap-0.5 bg-secondary/30 p-0.5 rounded-md border border-border/40">
                {['all', '0', '1', '2', '3', '4', '5', '6', '7+'].map((cmcVal) => {
                  const isActive = selectedCmc === cmcVal;
                  return (
                    <button
                      key={cmcVal}
                      onClick={() => setSelectedCmc(cmcVal)}
                      className={`h-5 px-2 rounded text-[9px] font-bold transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                      }`}
                    >
                      {cmcVal === 'all' ? 'All' : cmcVal}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mana Colors Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-w-[75px]">Mana Colors:</span>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setSelectedColor('all')}
                  className={`h-5 px-2 rounded text-[9px] font-bold transition-all border ${
                    selectedColor === 'all'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                  }`}
                >
                  All
                </button>
                {['W', 'U', 'B', 'R', 'G', 'C'].map((color) => {
                  const isActive = selectedColor === color;
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(isActive ? 'all' : color)}
                      className={`w-5 h-5 rounded-full transition-all flex items-center justify-center overflow-hidden bg-background ${
                        isActive
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110 shadow-sm opacity-100'
                          : 'border border-border/40 hover:scale-105 opacity-60 hover:opacity-100'
                      }`}
                      title={`Filter by ${color}`}
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
                <button
                  onClick={() => setSelectedColor(selectedColor === 'multicolor' ? 'all' : 'multicolor')}
                  className={`h-5 px-2 rounded text-[9px] font-bold transition-all border ${
                    selectedColor === 'multicolor'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                  }`}
                >
                  Multi
                </button>
              </div>
            </div>

            {/* Card Type Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-w-[75px]">Card Type:</span>
              <div className="flex flex-wrap gap-0.5 bg-secondary/30 p-0.5 rounded-md border border-border/40">
                {['all', 'Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land', 'Other'].map((typeVal) => {
                  const isActive = selectedType === typeVal;
                  const displayLabel = typeVal === 'all' ? 'All' : typeVal === 'Planeswalker' ? 'PW' : typeVal;
                  return (
                    <button
                      key={typeVal}
                      onClick={() => setSelectedType(typeVal)}
                      className={`h-5 px-2 rounded text-[9px] font-bold transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                      }`}
                    >
                      {displayLabel}
                    </button>
                  );
                })}
              </div>
            </div>

             {/* Subtype Filter */}
            {allSubtypes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-w-[75px]">Subtype:</span>
                <select
                  value={selectedSubtype}
                  onChange={(e) => setSelectedSubtype(e.target.value)}
                  className="h-6 px-2 rounded text-[10px] font-bold bg-secondary/50 border border-border/40 text-foreground hover:bg-secondary/80 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all w-full max-w-[160px]"
                >
                  <option value="all">All Subtypes</option>
                  {allSubtypes.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Special Filters */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border/20 pt-2 mt-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-w-[75px]">Special:</span>
              <button
                onClick={() => setShowOnlyGameChangers(!showOnlyGameChangers)}
                className={`h-5.5 px-3 rounded-full text-[9px] font-bold transition-all border flex items-center gap-1.5 ${
                  showOnlyGameChangers
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold shadow-sm shadow-amber-500/10'
                    : 'border-border/60 text-muted-foreground hover:border-amber-500/30 hover:text-amber-400 hover:bg-secondary/40'
                }`}
              >
                <Crown className="w-3 h-3 text-amber-500" />
                <span>Game Changers Only</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 overflow-hidden">
        <div className="pb-4">
          {/* Card count summary */}
          <div className="px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {selectedCmc !== 'all' || selectedType !== 'all' || selectedSubtype !== 'all' || selectedColor !== 'all' || filterQuery || showOnlyGameChangers ? (
                  <span>
                    {filteredCards.length} filtered (of {state.cards.length})
                  </span>
                ) : (
                  <span>{state.cards.length} unique cards</span>
                )}
              </span>
              {(selectedCmc !== 'all' || selectedType !== 'all' || selectedSubtype !== 'all' || selectedColor !== 'all' || filterQuery || showOnlyGameChangers) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary gap-1 rounded-md"
                  onClick={() => {
                    setFilterQuery('');
                    setSelectedCmc('all');
                    setSelectedType('all');
                    setSelectedSubtype('all');
                    setSelectedColor('all');
                    setShowOnlyGameChangers(false);
                  }}
                >
                  <X className="w-3 h-3" />
                  Clear Filters
                </Button>
              )}
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {selectedCmc !== 'all' || selectedType !== 'all' || selectedSubtype !== 'all' || selectedColor !== 'all' || filterQuery || showOnlyGameChangers ? (
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
          ) : viewMode === 'text' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 py-2 items-start">
              {/* Column 1 */}
              <div className="space-y-6">
                {['Commander', 'Creature', 'Artifact', 'Planeswalker'].map((cat) => {
                  const cards = grouped.get(cat) ?? [];
                  if (cards.length === 0) return null;
                  return (
                    <PremiumListSection
                      key={cat}
                      category={cat}
                      cards={cards}
                      onVariantOpen={(card) => setVariantCard(card)}
                      deckId={deckId}
                      onTransferCard={onTransferCard}
                    />
                  );
                })}
              </div>

              {/* Column 2 */}
              <div className="space-y-6">
                {['Instant', 'Enchantment', 'Battle'].map((cat) => {
                  const cards = grouped.get(cat) ?? [];
                  if (cards.length === 0) return null;
                  return (
                    <PremiumListSection
                      key={cat}
                      category={cat}
                      cards={cards}
                      onVariantOpen={(card) => setVariantCard(card)}
                      deckId={deckId}
                      onTransferCard={onTransferCard}
                    />
                  );
                })}
              </div>

              {/* Column 3 */}
              <div className="space-y-6">
                {['Sorcery', 'Land', 'Other'].map((cat) => {
                  const cards = grouped.get(cat) ?? [];
                  if (cards.length === 0) return null;
                  return (
                    <PremiumListSection
                      key={cat}
                      category={cat}
                      cards={cards}
                      onVariantOpen={(card) => setVariantCard(card)}
                      deckId={deckId}
                      onTransferCard={onTransferCard}
                    />
                  );
                })}
              </div>
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
                    deckId={deckId}
                    onTransferCard={onTransferCard}
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
            <DialogDescription className="flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-3 text-muted-foreground mt-1">
              <span className="max-w-xl">
                Choose your preferred printing for{' '}
                <strong className="text-foreground">{variantCard?.name}</strong>. This will update the
                card art across the builder and exported files.
              </span>
              {variantCard && (
                <Button
                  onClick={() => setIsAddCustomOpen(true)}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-dashed gap-1.5 shrink-0 text-primary border-primary/45 hover:bg-primary/5 hover:border-primary active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Custom Alter
                </Button>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-6">
            {/* Search & Filter Bar */}
            {variantCard && (
              <div className="bg-secondary/20 p-3 rounded-xl border border-border/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-2 animate-fade-in-up">
                {/* Quick Filters for Basic Lands */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-w-[70px]">
                    {['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'].includes(variantCard.name.toLowerCase()) ? 'Land Style:' : 'Filter Type:'}
                  </span>
                  <div className="flex flex-wrap gap-0.5 bg-secondary/50 p-0.5 rounded-lg border border-border/40">
                    {[
                      { id: 'all', label: 'All Printings' },
                      { id: 'fullart', label: 'Full Art Only' },
                      { id: 'borderless', label: 'Borderless' },
                      { id: 'retro', label: 'Retro Frame' },
                    ].map((filt) => {
                      const isActive = printsFilter === filt.id;
                      return (
                        <button
                          key={filt.id}
                          onClick={() => setPrintsFilter(filt.id as any)}
                          className={`h-5.5 px-2.5 rounded-md text-[9px] font-bold transition-all ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                          }`}
                        >
                          {filt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Set Code/Name Search Input */}
                <div className="relative w-full sm:max-w-[240px] flex items-center">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={printsSetSearch}
                    onChange={(e) => setPrintsSetSearch(e.target.value)}
                    placeholder="Search Set (e.g. NEO, UST, Kamigawa)..."
                    className="pl-8 h-7 text-xs bg-secondary/50 border-border focus:border-primary/50 focus:ring-primary/20 w-full"
                  />
                  {printsSetSearch && (
                    <button
                      onClick={() => setPrintsSetSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Custom Alters / Proxies Section */}
            {variantCard && customCards && (
              (() => {
                const matchingCustomCards = customCards.filter(
                  (c) =>
                    c.associatedScryfallId === variantCard.scryfallId ||
                    c.associatedName.toLowerCase() === variantCard.name.toLowerCase()
                );
                if (matchingCustomCards.length === 0) return null;

                return (
                  <div className="space-y-3 bg-secondary/10 p-3.5 rounded-xl border border-border/30 animate-fade-in-up">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      Custom Alters & Proxies ({matchingCustomCards.length})
                    </h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 justify-items-center">
                      {matchingCustomCards.map((custom) => {
                        const isCurrent =
                          variantCard.scryfallData.image_uris?.normal === custom.imageUrl ||
                          variantCard.scryfallData.card_faces?.[0]?.image_uris?.normal === custom.imageUrl;

                        return (
                          <div
                            key={custom.id}
                            onClick={() => {
                              // Override the ScryfallCard image_uris with the custom URL
                              const updatedScryfallData = {
                                ...variantCard.scryfallData,
                                image_uris: {
                                  ...variantCard.scryfallData.image_uris,
                                  small: custom.imageUrl,
                                  normal: custom.imageUrl,
                                  large: custom.imageUrl,
                                  png: custom.imageUrl,
                                  art_crop: custom.imageUrl,
                                },
                                // Support DFC card faces if present
                                card_faces: variantCard.scryfallData.card_faces?.map((face, index) =>
                                  index === 0
                                    ? {
                                        ...face,
                                        image_uris: {
                                          ...face.image_uris,
                                          small: custom.imageUrl,
                                          normal: custom.imageUrl,
                                          large: custom.imageUrl,
                                          png: custom.imageUrl,
                                          art_crop: custom.imageUrl,
                                        },
                                      }
                                    : face
                                ),
                              };
                              dispatch({
                                type: 'UPDATE_CARD_DATA',
                                scryfallId: variantCard.scryfallId,
                                newCardData: updatedScryfallData,
                              });
                              setVariantCard(null);
                            }}
                            className={`relative w-[150px] sm:w-[200px] aspect-[5/7] rounded-xl overflow-hidden cursor-pointer border transition-all duration-300 group/print ${
                              isCurrent
                                ? 'border-primary ring-2 ring-primary bg-primary/5 shadow-lg shadow-primary/20 scale-[1.03]'
                                : 'border-border/60 hover:border-primary/50 hover:scale-[1.02]'
                            }`}
                          >
                            <img
                              src={custom.imageUrl}
                              alt={custom.name}
                              className="w-full h-full object-cover select-none"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://i.imgur.com/Hg8CwwU.jpeg';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/85 opacity-0 group-hover/print:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5 text-center z-10">
                              <span className="text-xs font-bold text-foreground leading-tight truncate">
                                {custom.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold font-mono mt-0.5">
                                Custom Art Alter
                              </span>
                            </div>
                            {isCurrent && (
                              <div className="absolute top-2 right-2 bg-primary p-0.5 rounded-full z-10 flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-2 text-[10px] text-muted-foreground">
                      <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                      <span>These are your local custom designs. Official printings from Scryfall are listed below.</span>
                    </div>
                    <Separator className="my-4 opacity-40" />
                  </div>
                );
              })()
            )}

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
                        <img
                          src={printImg}
                          alt={print.name}
                          className="w-full h-full object-cover absolute inset-0 select-none"
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

      {/* Custom Cards Modal for quick prepopulated adding */}
      <CustomCardsModal
        open={isAddCustomOpen}
        onClose={() => setIsAddCustomOpen(false)}
        prepopulatedCard={
          variantCard
            ? { id: variantCard.scryfallId, name: variantCard.name }
            : null
        }
      />
    </div>
  );
}
