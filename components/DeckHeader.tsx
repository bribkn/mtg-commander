'use client';

import { Crown, Layers, Download, Trash2, Plus, ArrowLeft, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeck } from '@/lib/deck-store';

interface DeckHeaderProps {
  onExport: () => void;
  onImportOpen: () => void;
  onCardbackOpen: () => void;
  onClear: () => void;
  isExporting: boolean;
}

export function DeckHeader({ onExport, onImportOpen, onCardbackOpen, onClear, isExporting }: DeckHeaderProps) {
  const { state, totalCards, commander, dispatch } = useDeck();
  const isValid = totalCards === 100;
  const isOver = totalCards > 100;
  const isUnder = totalCards < 100;

  if (!state) return null;

  return (
    <header className="border-b border-border glass-panel sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo / title + Return button */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: 'CLOSE_DECK' })}
            className="gap-1 px-2.5 h-9 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/40 shrink-0"
            title="Back to Decks"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">Back</span>
          </Button>

          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 shrink-0">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 hidden lg:block">
            <h1 className="text-sm font-bold text-gradient-red leading-none truncate">
              MTG TTS Builder
            </h1>
            <p className="text-[10px] text-muted-foreground">Commander</p>
          </div>
        </div>

        {/* Deck name */}
        <div className="hidden md:block flex-1 min-w-0 mx-4">
          <p className="text-sm font-medium truncate text-foreground/90">
            {state.deckName}
          </p>
          {commander && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Crown className="w-3 h-3 text-primary" />
              {commander.name}
            </p>
          )}
        </div>

        {/* Card count */}
        <div className="flex items-center gap-2 ml-auto">
          <Badge
            variant={isValid ? 'default' : 'outline'}
            className={
              isValid
                ? 'bg-primary text-primary-foreground border-primary'
                : isOver
                ? 'border-red-500 text-red-400'
                : isUnder
                ? 'border-yellow-600 text-yellow-400'
                : ''
            }
          >
            <span className="font-mono text-sm">{totalCards}</span>
            <span className="text-xs opacity-70">/100</span>
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={onImportOpen}
            className="gap-2 border-border hover:border-primary/50 hover:text-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onCardbackOpen}
            className="gap-2 border-border hover:border-primary/50 hover:text-primary transition-colors"
            title="Custom cardback image"
          >
            <Images className="w-4 h-4" />
            <span className="hidden sm:inline">Cardback</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Clear deck"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <Button
            onClick={onExport}
            disabled={isExporting || totalCards === 0}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
            size="sm"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            {isExporting ? 'Generating...' : 'Export TTS'}
          </Button>
        </div>
      </div>
    </header>
  );
}
