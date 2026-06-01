'use client';
 
import { useState } from 'react';
import { Trophy, Plus, Minus, ShieldAlert } from 'lucide-react';
import { useDeck } from '@/lib/deck-store';
import { CATEGORY_ORDER, isGameChangerCard } from '@/lib/scryfall';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const MANA_COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
const MANA_LABELS: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};
const MANA_STYLES: Record<string, { bar: string; bg: string; text: string }> = {
  W: { bar: 'bg-yellow-200', bg: 'bg-yellow-200/10', text: 'text-yellow-200' },
  U: { bar: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  B: { bar: 'bg-gray-400', bg: 'bg-gray-400/10', text: 'text-gray-400' },
  R: { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
  G: { bar: 'bg-green-500', bg: 'bg-green-500/10', text: 'text-green-400' },
};

export function StatsPanel({ deckId }: { deckId?: string } = {}) {
  const { state: activeDeck, decks, dispatch } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : activeDeck;
  const [editingStats, setEditingStats] = useState(false);
 
  if (!state) return null;
 
  const totalCards = state.cards.reduce((sum, c) => sum + c.quantity, 0);
  const wins = state.wins || 0;
  const losses = state.losses || 0;
  const totalGames = wins + losses;
  const winrate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const wrString = totalGames > 0 ? `${winrate}%` : '—';
 
  function handleUpdateStats(newWins: number, newLosses: number) {
    dispatch({ type: 'UPDATE_DECK_STATS', wins: newWins, losses: newLosses, deckId });
  }
 
  // ── Mana Curve (Non-lands) ──────────────────────────────────────────────────────────
  const curve: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  for (const card of state.cards) {
    if (card.category !== 'Land') {
      const cmc = Math.min(Math.floor(card.scryfallData.cmc ?? 0), 7);
      curve[cmc] = (curve[cmc] ?? 0) + card.quantity;
    }
  }
  const maxCurve = Math.max(...Object.values(curve), 1);
 
  // ── Color Distribution ──────────────────────────────────────────────────
  const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const card of state.cards) {
    const colors = card.scryfallData.color_identity ?? [];
    for (const c of colors) {
      if (c in colorCounts) colorCounts[c] += card.quantity;
    }
  }
  const maxColor = Math.max(...Object.values(colorCounts), 1);
 
  // ── Type Breakdown ───────────────────────────────────────────────────────
  const typeCounts = new Map<string, number>();
  for (const cat of CATEGORY_ORDER) {
    typeCounts.set(cat, 0);
  }
  for (const card of state.cards) {
    typeCounts.set(card.category, (typeCounts.get(card.category) ?? 0) + card.quantity);
  }
 
  // ── Average CMC (non-land) ────────────────────────────────────────────────
  let totalCmc = 0;
  let nonLandCount = 0;
  for (const card of state.cards) {
    if (card.category !== 'Land') {
      totalCmc += (card.scryfallData.cmc ?? 0) * card.quantity;
      nonLandCount += card.quantity;
    }
  }
  const avgCmc = nonLandCount > 0 ? (totalCmc / nonLandCount).toFixed(2) : '—';
 
  // ── Game Changers Count ────────────────────────────────────────────────
  let gameChangerCount = 0;
  for (const card of state.cards) {
    if (isGameChangerCard(card.name)) {
      gameChangerCount += card.quantity;
    }
  }
  const gameChangersInDeck = state.cards
    .filter((card) => isGameChangerCard(card.name))
    .map((card) => ({ name: card.name, quantity: card.quantity }));

  // ── Banned Cards Count ────────────────────────────────────────────────
  let bannedCount = 0;
  const bannedCardsList: Array<{ name: string; quantity: number }> = [];
  for (const card of state.cards) {
    if (card.scryfallData.legalities?.commander === 'banned') {
      bannedCount += card.quantity;
      bannedCardsList.push({ name: card.name, quantity: card.quantity });
    }
  }

  // ── Lands & Opening Hand Expectations ─────────────────────────────────────
  let landCount = 0;
  for (const card of state.cards) {
    if (card.category === 'Land') {
      landCount += card.quantity;
    }
  }
  const avgOpeningLands = totalCards > 0 ? ((landCount / totalCards) * 7).toFixed(2) : '—';
 
  return (
    <div className="space-y-6 p-4">
      {/* Banned Cards warning */}
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

      {/* Summary row - 3x2 grid for better space utilization in sidebar */}
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
 
      {/* Winrate Stats Panel Card */}
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
 
      {/* Mana Curve */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Mana Curve
        </h3>
        <div className="flex items-end gap-1.5 h-24">
          {Object.entries(curve).map(([cmc, count]) => (
            <div key={cmc} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-mono text-muted-foreground">
                {count > 0 ? count : ''}
              </span>
              <div className="w-full rounded-t" style={{ height: `${(count / maxCurve) * 72}px`, minHeight: count > 0 ? '4px' : '0' }}>
                <div
                  className="w-full h-full rounded-t bg-primary/80 hover:bg-primary transition-colors"
                  style={{ height: '100%' }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {cmc === '7' ? '7+' : cmc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Color Distribution */}
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
                <span className={`text-xs font-bold w-4 shrink-0 ${styles.text}`}>
                  {color}
                </span>
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

      {/* Type Breakdown */}
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
