'use client';

import { useState } from 'react';
import { Plus, Layers, Copy, Trash2, ShieldAlert, ArrowRight, Columns, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SavedDeck, useDeck } from '@/lib/deck-store';
import { isGameChangerCard } from '@/lib/scryfall';

interface DeckDashboardProps {
  onOpenSplit?: (deckId: string) => void;
  onShareOpen?: (deckId: string) => void;
}

export function DeckDashboard({ onOpenSplit, onShareOpen }: DeckDashboardProps = {}) {
  const { decks, dispatch } = useDeck();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Helper to extract art crop (bypassing WebM video alters for dashboard preview compatibility)
  function getDeckArt(deck: SavedDeck): string {
    // 1. Try custom cover card first
    if (deck.coverCardId) {
      const cover = deck.cards.find((c) => c.scryfallId === deck.coverCardId);
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

    // 2. Fall back to commander
    const commander = deck.cards.find((c) => c.isCommander);
    if (commander?.scryfallData) {
      const data = commander.scryfallData;
      const id = commander.scryfallId;
      const art = data.image_uris?.art_crop || data.card_faces?.[0]?.image_uris?.art_crop || data.image_uris?.normal || '';
      if (art.endsWith('.webm') || art.includes('.webm') || art.includes('catbox.moe') || art.includes('pixeldrain.com') || art.includes('ufs.sh') || art.includes('utfs.io')) {
        return `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
      }
      if (art) return art;
    }
    // Default high-quality dark fantasy MTG card back crop
    return 'https://i.pinimg.com/736x/7e/be/a3/7ebea35ad91c8ee201b0647a7c0d816b.jpg';
  }

  // Helper to get commander name
  function getCommanderName(deck: SavedDeck): string {
    const commander = deck.cards.find((c) => c.isCommander);
    return commander ? commander.name : 'No Commander';
  }

  // Helper to count game changers
  function countGameChangers(deck: SavedDeck): number {
    return deck.cards
      .filter((c) => isGameChangerCard(c.name))
      .reduce((sum, c) => sum + c.quantity, 0);
  }

  // Helper to count banned cards
  function countBannedCards(deck: SavedDeck): number {
    return deck.cards
      .filter((c) => c.scryfallData.legalities?.commander === 'banned')
      .reduce((sum, c) => sum + c.quantity, 0);
  }

  return (
    <div className="flex-1 w-full max-w-screen-2xl mx-auto px-4 py-8 overflow-y-auto">
      {/* Welcome Hero Section */}
      <div className="mb-10 text-center md:text-left md:flex md:items-center md:justify-between p-6 rounded-2xl bg-secondary/30 border border-border/40 backdrop-blur-md relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-red-500/5 blur-3xl" />
        
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-center md:justify-start gap-2.5">
            <Layers className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Your <span className="text-gradient-red">MTG Commander</span> Decks
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg">
            Create, edit, and export your decks directly to Tabletop Simulator. Everything is saved automatically in your browser's local storage.
          </p>
        </div>

        <div className="mt-6 md:mt-0 flex flex-wrap gap-3 justify-center">
          <Button
            onClick={() => dispatch({ type: 'CREATE_DECK' })}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/10"
          >
            <Plus className="w-4 h-4" /> New Deck
          </Button>
        </div>
      </div>

      {/* Grid of Decks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 justify-items-center">
        {/* "Create Deck" Card Option */}
        <Card
          onClick={() => dispatch({ type: 'CREATE_DECK' })}
          className="w-[220px] aspect-[5/7] flex flex-col items-center justify-center border-dashed border-2 border-border/80 hover:border-primary/60 hover:bg-primary/5 cursor-pointer transition-all duration-300 group rounded-xl bg-card/20 shadow-md relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 group-hover:to-black/30 transition-all" />
          <div className="flex flex-col items-center gap-3 relative z-10 text-center p-4">
            <div className="w-12 h-12 rounded-full border border-border/80 group-hover:border-primary/50 group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all duration-300">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground/80 group-hover:text-primary transition-colors">
                Create New Deck
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a deck from scratch
              </p>
            </div>
          </div>
        </Card>

        {/* Existing Decks list */}
        {decks.map((deck) => {
          const totalQty = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
          const gcCount = countGameChangers(deck);
          const bannedCount = countBannedCards(deck);
          const commanderName = getCommanderName(deck);
          const backgroundArt = getDeckArt(deck);
          const isConfirmingDelete = deletingId === deck.id;
 
          const wins = deck.wins || 0;
          const losses = deck.losses || 0;
          const totalGames = wins + losses;
          const winrate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
 
          return (
            <Card
              key={deck.id}
              className="w-[220px] aspect-[5/7] relative overflow-hidden rounded-xl border border-border/60 shadow-lg shadow-black/30 hover:shadow-black/50 hover:border-primary/40 transition-all duration-300 group"
            >
              {/* Background Art Crop */}
              <div
                className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                style={{ backgroundImage: `url(${backgroundArt})` }}
              />
              
              {/* Dark Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30 group-hover:via-black/70 transition-all duration-300" />
 
              {/* Badges top right */}
              <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10 items-end">
                <Badge className="bg-black/70 border border-border/40 font-mono text-[10px]">
                  {totalQty}/100
                </Badge>
                {bannedCount > 0 && (
                  <Badge className="bg-red-950/90 border border-red-500/50 text-red-400 font-mono text-[10px] drop-shadow-sm gap-1 flex items-center animate-pulse">
                    <ShieldAlert className="w-3 h-3 text-red-500" />
                    <span>{bannedCount} Banned</span>
                  </Badge>
                )}
                {totalGames > 0 && (
                  <Badge className="bg-yellow-950/80 border border-yellow-500/30 text-yellow-400 font-mono text-[10px] drop-shadow-sm">
                    {winrate}% WR
                  </Badge>
                )}
                {gcCount > 0 && (
                  <Badge className="bg-red-950/80 border border-red-500/30 text-red-400 font-mono text-[10px] drop-shadow-sm">
                    {gcCount} GC
                  </Badge>
                )}
              </div>

              {/* Card Content (Lower Half) */}
              <div className="absolute bottom-0 left-0 right-0 p-3.5 z-10 flex flex-col h-1/2 justify-end">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {deck.deckName}
                  </h3>
                  <p className="text-[10px] text-muted-foreground truncate font-medium">
                    {commanderName}
                  </p>
                </div>

                {/* Dashboard Actions - Slide Up or Appear on Hover */}
                <div className="mt-3 flex items-center justify-between gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1 w-full bg-destructive/90 rounded p-1 text-[10px] text-destructive-foreground justify-between font-medium">
                      <span>Delete?</span>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch({ type: 'DELETE_DECK', deckId: deck.id });
                            setDeletingId(null);
                          }}
                          className="bg-white text-destructive font-bold px-1.5 py-0.5 rounded hover:bg-white/80"
                        >
                          Yes
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(null);
                          }}
                          className="bg-black/30 font-bold px-1.5 py-0.5 rounded hover:bg-black/50 text-white"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => dispatch({ type: 'OPEN_DECK', deckId: deck.id })}
                        className="flex-1 text-[10px] h-7 bg-white text-black hover:bg-white/90 font-bold gap-1 px-2 shrink-0"
                      >
                        Edit <ArrowRight className="w-3 h-3" />
                      </Button>
                      {onOpenSplit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSplit(deck.id);
                          }}
                          className="w-7 h-7 text-muted-foreground hover:text-foreground border border-border/30 rounded bg-black/40 hover:bg-black/60 shrink-0"
                          title="Open in Split Screen"
                        >
                          <Columns className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: 'DUPLICATE_DECK', deckId: deck.id });
                        }}
                        className="w-7 h-7 text-muted-foreground hover:text-foreground border border-border/30 rounded bg-black/40 hover:bg-black/60 shrink-0"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {onShareOpen && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onShareOpen(deck.id);
                          }}
                          className="w-7 h-7 text-muted-foreground hover:text-emerald-400 border border-border/30 rounded bg-black/40 hover:bg-black/60 shrink-0"
                          title="Share Deck"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(deck.id);
                        }}
                        className="w-7 h-7 text-muted-foreground hover:text-red-400 border border-border/30 rounded bg-black/40 hover:bg-destructive/20 hover:border-destructive/30 shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Empty State message */}
      {decks.length === 0 && (
        <div className="text-center py-16 border border-border/30 rounded-2xl bg-secondary/5 mt-8 max-w-md mx-auto">
          <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
          <h3 className="text-sm font-semibold text-foreground/80">You don't have any saved decks</h3>
          <p className="text-xs text-muted-foreground mt-1 px-4">
            Create a new one using the buttons above to start designing your Commander deck.
          </p>
        </div>
      )}
    </div>
  );
}
