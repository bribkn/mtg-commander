'use client';

import { Crown, Layers, Download, Trash2, Plus, ArrowLeft, Images, Sparkles, Columns, Flame, Share2, Archive, Save, Loader2, CheckCircle2, Dices, Star, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeck } from '@/lib/deck-store';
import { useState } from 'react';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface DeckHeaderProps {
  deckId?: string;
  onExport: () => void;
  onImportOpen: () => void;
  onCardbackOpen: () => void;
  onCustomOpen: () => void;
  onClear: () => void;
  onSplitOpen?: () => void;
  splitMode?: boolean;
  onCombosOpen: () => void;
  onShareOpen: () => void;
  onSave?: () => Promise<boolean | void>;
  onPlaytestOpen: () => void;
  onApplyFavorites?: () => void;
}

export function DeckHeader({
  deckId,
  onExport,
  onImportOpen,
  onCardbackOpen,
  onCustomOpen,
  onClear,
  onSplitOpen,
  splitMode,
  onCombosOpen,
  onShareOpen,
  onSave,
  onPlaytestOpen,
  onApplyFavorites,
}: DeckHeaderProps) {
  const { state: globalState, decks, dispatch, favoriteArts } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;
  const totalCards = state ? state.cards.reduce((sum, c) => sum + c.quantity, 0) : 0;
  const commander = state ? state.cards.find((c) => c.isCommander) ?? null : null;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

          <DropdownMenu
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-border hover:border-primary/50 hover:text-primary transition-colors"
                title="Deck customization and graphics"
              >
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                <span className="hidden sm:inline">Customize</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </Button>
            }
          >
            <DropdownMenuItem
              onClick={onCustomOpen}
              title="Custom card library (Alters / Proxies)"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Custom Cards</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={onCardbackOpen}
              title="Custom cardback image"
            >
              <Images className="w-4 h-4 text-blue-400" />
              <span>Cardback Image</span>
            </DropdownMenuItem>

            {favoriteArts && favoriteArts.length > 0 && onApplyFavorites && (
              <DropdownMenuItem
                onClick={onApplyFavorites}
                title="Apply global favorite arts to all cards in this deck"
              >
                <Star className="w-4 h-4 text-amber-500 fill-amber-500/10" />
                <span>Apply Favorites</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={onShareOpen}
              disabled={!commander}
              title={commander ? "Share deck or generate card art visuals" : "Share deck or generate card art visuals (requires a selected commander)"}
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span>Share & Graphics</span>
            </DropdownMenuItem>
          </DropdownMenu>

          <DropdownMenu
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-border hover:border-primary/50 hover:text-primary transition-colors"
                title="Deck simulation and analysis tools"
              >
                <Dices className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">Tools</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </Button>
            }
          >
            <DropdownMenuItem
              onClick={onPlaytestOpen}
              title="Sample hand playtester"
            >
              <Dices className="w-4 h-4 text-indigo-400" />
              <span>Playtest Hand</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={onCombosOpen}
              title="Deck combos and synergies finder"
            >
              <Flame className="w-4 h-4 text-primary" />
              <span>Synergies & Combos</span>
            </DropdownMenuItem>

            {!splitMode && onSplitOpen && (
              <DropdownMenuItem
                onClick={onSplitOpen}
                title="Open split view side-by-side"
              >
                <Columns className="w-4 h-4 text-primary" />
                <span>Split View</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={onClear}
              variant="destructive"
              title="Clear deck"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Deck</span>
            </DropdownMenuItem>
          </DropdownMenu>

          {onSave && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setSaving(true);
                setSaved(false);
                await onSave();
                setSaving(false);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
              disabled={saving}
              className={`gap-2 transition-colors ${
                saved
                  ? 'border-green-500/50 text-green-400 bg-green-500/10 hover:bg-green-500/20'
                  : 'border-border hover:border-primary/50 hover:text-primary'
              }`}
              title="Save deck to storage"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{saved ? 'Saved!' : 'Save'}</span>
            </Button>
          )}

          <Button
            onClick={onExport}
            disabled={totalCards === 0}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all font-semibold"
            size="sm"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>
    </header>
  );
}
