'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Download, Layers, Shuffle, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDeck } from '@/lib/deck-store';
import { generateTTSExport, downloadJSON, collectTokens, TokenCard } from '@/lib/tts-export';
import { isDoubleFaced, getFrontImageUrl } from '@/lib/scryfall';

interface ExportPanelProps {
  onExport?: () => void;
}

export function ExportPanel({ onExport }: ExportPanelProps) {
  const { state, totalCards } = useDeck();

  if (!state) return null;
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<{
    mainCount: number;
    tokenCount: number;
    dfcCount: number;
  } | null>(null);

  // Preview data
  const tokens: TokenCard[] = [];
  const dfcCards = state.cards.filter((c) => isDoubleFaced(c.scryfallData));
  const mainCount = totalCards;
  const dfcCount = dfcCards.reduce((s, c) => s + c.quantity, 0);

  async function handleExport() {
    if (!state || state.cards.length === 0) return;
    setIsExporting(true);
    setError('');
    setProgress(0);

    try {
      setProgressLabel('Collecting token data...');
      setProgress(20);

      const result = await generateTTSExport(state.cards);

      setProgress(90);
      setProgressLabel('Writing JSON...');

      const deckName = state.deckName.replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'commander-deck';
      downloadJSON(result.json, `${deckName}-tts.json`);

      setLastResult({
        mainCount: result.mainDeckCount,
        tokenCount: result.tokenCount,
        dfcCount: result.dfcCount,
      });

      setProgress(100);
      setProgressLabel('Done!');
      onExport?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  const isValid = totalCards === 100;

  return (
    <div className="p-4 space-y-5">
      {/* Deck breakdown preview */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          TTS Export Preview
        </h3>

        <div className="space-y-2">
          <SubDeckRow
            icon={<Layers className="w-4 h-4" />}
            label="Main Deck"
            count={mainCount}
            color="text-primary"
            description="Includes commanders and DFCs in a single pile"
          />
          <SubDeckRow
            icon={<Sparkles className="w-4 h-4" />}
            label="Tokens"
            count={'auto'}
            color="text-blue-400"
            description="Auto-detected from Scryfall"
          />
          <SubDeckRow
            icon={<Shuffle className="w-4 h-4" />}
            label="Double-Faced Cards"
            count={dfcCount}
            color="text-purple-400"
            description="Included within the main deck pile"
          />
        </div>
      </div>

      {/* DFC preview */}
      {dfcCards.length > 0 && (
        <div>
          <h4 className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
            DFCs Detected
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {dfcCards.slice(0, 6).map((c) => (
              <div
                key={c.scryfallId}
                className="relative w-10 h-14 rounded overflow-hidden border border-border"
                title={c.name}
              >
                <img
                  src={getFrontImageUrl(c.scryfallData)}
                  alt={c.name}
                  className="w-full h-full object-cover absolute inset-0 select-none"
                />
              </div>
            ))}
            {dfcCards.length > 6 && (
              <div className="w-10 h-14 rounded border border-border bg-secondary flex items-center justify-center text-xs text-muted-foreground">
                +{dfcCards.length - 6}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation warnings */}
      {totalCards > 0 && !isValid && (
        <div className="flex items-start gap-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Not 100 cards</p>
            <p className="text-xs text-yellow-400/80">
              Commander decks need exactly 100 cards. You have {totalCards}.
            </p>
          </div>
        </div>
      )}

      {/* Last export result */}
      {lastResult && (
        <div className="text-xs text-muted-foreground bg-secondary rounded-lg p-3 space-y-1">
          <p className="text-green-400 font-medium mb-2">✓ Last export:</p>
          <p>• {lastResult.mainCount} main deck cards (includes DFCs)</p>
          <p>• {lastResult.tokenCount} tokens</p>
          <p>• {lastResult.dfcCount} double-faced cards</p>
        </div>
      )}

      {/* Progress */}
      {isExporting && (
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground text-center">{progressLabel}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Export button */}
      <Button
        id="export-tts-btn"
        onClick={handleExport}
        disabled={isExporting || !state || state.cards.length === 0}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all gap-2"
        size="lg"
      >
        {isExporting ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Generating TTS JSON...</>
        ) : (
          <><Download className="w-4 h-4" />Export to Tabletop Simulator</>
        )}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
        Downloads a <code>.json</code> file you can import into TTS via{' '}
        <em>Objects → Saved Objects</em> or the in-game import function.
      </p>
    </div>
  );
}

function SubDeckRow({
  icon,
  label,
  count,
  color,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  count: number | string;
  color: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary border border-border">
      <div className={`${color} shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <Badge variant="outline" className="font-mono text-xs border-border">
            {typeof count === 'number' ? count : count}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{description}</p>
      </div>
    </div>
  );
}
