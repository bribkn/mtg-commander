'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Minus, Check, Map, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeck } from '@/lib/deck-store';
import { getCardByExactName, getManaSymbolUrl } from '@/lib/scryfall';
import tierrasJson from '@/todas_las_tierras_.json';
import landColors from '@/lib/land-colors.json';

interface AddLandModalProps {
  open: boolean;
  onClose: () => void;
  deckId?: string;
}

interface JsonCard {
  Nickname?: string;
}

const UNIQUE_BARNY_LANDS = Array.from(
  new Set(
    ((tierrasJson.ObjectStates?.[0]?.ContainedObjects ?? []) as JsonCard[])
      .map((card) => card.Nickname)
  )
)
  .filter((name): name is string => typeof name === 'string' && name.length > 0)
  .sort((a, b) => a.localeCompare(b));

const LAND_COLOR_MAP = landColors as Record<string, string[]>;

export function AddLandModal({ open, onClose, deckId }: AddLandModalProps) {
  const { state: globalState, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [loadingLandName, setLoadingLandName] = useState<string | null>(null);
  const [previewLand, setPreviewLand] = useState<string | null>(null);
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: React.MouseEvent) {
    setMouseCoords({
      x: e.clientX,
      y: e.clientY,
    });
  }

  if (!state) return null;

  const totalLandsInDeck = state.cards
    .filter((c) => c.category === 'Land')
    .reduce((sum, c) => sum + c.quantity, 0);

  async function handleAddLand(landName: string) {
    const existing = state?.cards.find((c) => c.name === landName);
    if (existing) {
      // If it exists in the deck, increment quantity directly (Fast, 0 API calls)
      dispatch({
        type: 'INCREMENT_QUANTITY',
        scryfallId: existing.scryfallId,
        deckId,
      });
      return;
    }

    // Otherwise, fetch card from API
    setLoadingLandName(landName);
    try {
      const card = await getCardByExactName(landName);
      if (card) {
        dispatch({
          type: 'ADD_CARD',
          card,
          quantity: 1,
          deckId,
        });
      }
    } catch (err) {
      console.error('Error adding land card: ', err);
    } finally {
      setLoadingLandName(null);
    }
  }

  function handleRemoveLand(landName: string) {
    const existing = state?.cards.find((c) => c.name === landName);
    if (existing) {
      dispatch({
        type: 'DECREMENT_QUANTITY',
        scryfallId: existing.scryfallId,
        deckId,
      });
    }
  }

  // Calculate preview position to keep it inside screen boundaries
  const previewWidth = 250;
  const previewHeight = 350;
  let leftPos = mouseCoords.x + 8;
  if (typeof window !== 'undefined' && mouseCoords.x + previewWidth + 24 > window.innerWidth) {
    leftPos = mouseCoords.x - previewWidth - 8;
  }
  let topPos = mouseCoords.y - previewHeight / 2;
  if (typeof window !== 'undefined') {
    if (topPos < 10) {
      topPos = 10;
    } else if (topPos + previewHeight > window.innerHeight - 10) {
      topPos = window.innerHeight - previewHeight - 10;
    }
  }

  const filteredLands = UNIQUE_BARNY_LANDS
    .map((landName) => {
      const colors = LAND_COLOR_MAP[landName] || ['C'];
      return { name: landName, colors };
    })
    .filter((land) => {
      if (searchQuery.trim() !== '') {
        if (!land.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }
      if (colorFilter !== null) {
        return land.colors.includes(colorFilter);
      }
      return true;
    });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        showCloseButton={false} 
        onMouseMove={handleMouseMove}
        className="w-[95vw] sm:max-w-5xl bg-card border-border h-[650px] max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 text-gradient-red text-xl font-bold">
            <div className="flex items-center gap-2">
              <Map className="w-5 h-5 text-primary" />
              Add Barny Lands to Deck
            </div>
            <Badge variant="outline" className="text-xs font-mono border-primary text-primary bg-primary/5 uppercase px-2 py-0.5 shrink-0">
              Total Lands: {totalLandsInDeck}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Quickly adjust your deck&apos;s custom Barny lands. Use the search bar or filter by color, then add or remove lands in one click.
          </DialogDescription>
        </DialogHeader>

        {/* Search bar & statistics */}
        <div className="flex flex-col sm:flex-row items-center gap-3 border-b border-border/40 pb-3 mt-2 shrink-0">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search custom lands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-full bg-secondary/20 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-xs text-muted-foreground font-medium">
            <span>Showing {filteredLands.length} lands</span>
          </div>
        </div>

        {/* Color Identity Filter */}
        <div className="flex items-center gap-2.5 border-b border-border/40 pb-3 pt-2 shrink-0 select-none">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Filter by Mana:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setColorFilter(null)}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all border ${
                colorFilter === null
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              All Colors
            </button>
            {['W', 'U', 'B', 'R', 'G', 'C'].map((color) => {
              const isActive = colorFilter === color;
              return (
                <button
                  key={color}
                  onClick={() => setColorFilter(isActive ? null : color)}
                  className={`w-7 h-7 rounded-full transition-all flex items-center justify-center overflow-hidden bg-background ${
                    isActive
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110 shadow-lg opacity-100'
                      : 'border border-border/40 hover:scale-105 hover:border-border/80 opacity-60 hover:opacity-100'
                  }`}
                  title={`Show lands producing ${color}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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

        {/* Land selection grid */}
        <div onMouseMove={handleMouseMove} className="flex-1 overflow-y-auto pr-2 py-4 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pr-1">
            {filteredLands.map((land) => {
              const cardInDeck = state?.cards.find((c) => c.name === land.name);
              const qty = cardInDeck ? cardInDeck.quantity : 0;
              const isLoading = loadingLandName === land.name;

              return (
                <div
                  key={land.name}
                  onMouseEnter={() => setPreviewLand(land.name)}
                  onMouseLeave={() => setPreviewLand(null)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                    qty > 0
                      ? 'bg-primary/5 border-primary/30 shadow-sm'
                      : 'bg-secondary/25 border-border/60 hover:border-border/80'
                  }`}
                >
                  {/* Land Info */}
                  <div 
                    onClick={() => {
                      if (previewLand === land.name) {
                        setPreviewLand(null);
                      } else {
                        setPreviewLand(land.name);
                      }
                    }}
                    className="min-w-0 pr-2 flex-1 cursor-pointer select-none py-1 group"
                  >
                    <span className="text-sm font-semibold text-foreground truncate block leading-tight group-hover:text-primary transition-colors">
                      {land.name}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      {land.colors.map((c) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={c}
                          src={getManaSymbolUrl(c)}
                          alt={c}
                          className="w-3.5 h-3.5 select-none pointer-events-none"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-background/40 p-1 border border-border/40 rounded-lg">
                    {qty > 0 && (
                      <button
                        onClick={() => handleRemoveLand(land.name)}
                        className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Remove 1"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span className="w-6 text-center text-xs font-mono font-bold text-foreground">
                      {qty}
                    </span>

                    <button
                      onClick={() => handleAddLand(land.name)}
                      disabled={isLoading}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                        isLoading
                          ? 'bg-secondary'
                          : qty > 0
                          ? 'bg-primary/20 text-primary hover:bg-primary/30'
                          : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                      }`}
                      title="Add 1"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      ) : qty > 0 ? (
                        <Check className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-border/40 pt-4 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Floating Land Image Preview */}
        {previewLand && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed pointer-events-none z-[9999] w-[250px] aspect-[5/7] rounded-xl overflow-hidden border border-primary/40 bg-neutral-950/95 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-all duration-75 ease-out animate-in fade-in zoom-in-95"
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
              src={`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(previewLand)}&format=image&version=normal`}
              alt={previewLand}
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
