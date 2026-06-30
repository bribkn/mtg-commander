'use client';

import { useState } from 'react';
import { Download, Layers, Shuffle, Sparkles, Loader2, AlertCircle, Archive, Copy, Check, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDeck } from '@/lib/deck-store';
import { generateTTSExport, downloadJSON } from '@/lib/tts-export';
import { isDoubleFaced, getFrontImageUrl } from '@/lib/scryfall';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  deckId?: string;
}

export function ExportModal({ open, onClose, deckId }: ExportModalProps) {
  const { state: globalState, decks } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;

  if (!state) return null;

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<{
    mainCount: number;
    tokenCount: number;
    dfcCount: number;
    sideCount: number;
  } | null>(null);

  // Text export states
  const [copied, setCopied] = useState(false);

  // Preview data
  const dfcCards = state.cards.filter((c) => isDoubleFaced(c.scryfallData));
  const totalCards = state.cards.reduce((sum, c) => sum + c.quantity, 0);
  const mainCount = totalCards;
  const dfcCount = dfcCards.reduce((s, c) => s + c.quantity, 0);
  const sideCount = state.sidedeck ? state.sidedeck.reduce((sum, c) => sum + c.quantity, 0) : 0;
  const tokenCount = state.tokens ? state.tokens.reduce((sum, c) => sum + c.quantity, 0) : 0;

  async function handleTTSExport() {
    if (!state || state.cards.length === 0) return;
    setIsExporting(true);
    setError('');
    setProgress(0);

    try {
      setProgressLabel('Generating export file...');
      setProgress(50);

      const result = await generateTTSExport(
        state.cards,
        state.customCardbackUrl,
        state.tokens || [],
        state.isSideDeckEnabled ? (state.sidedeck || []) : []
      );

      setProgress(90);
      setProgressLabel('Writing JSON...');

      const deckName = state.deckName.replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'commander-deck';
      downloadJSON(result.json, `${deckName}-tts.json`);

      setLastResult({
        mainCount: result.mainDeckCount,
        tokenCount: result.tokenCount,
        dfcCount: result.dfcCount,
        sideCount: result.sideDeckCount,
      });

      setProgress(100);
      setProgressLabel('Done!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  // Generate decklist string in [Quantity] [Name] format
  const generateDecklistText = (): string => {
    if (!state) return '';
    const lines: string[] = [];

    // 1. Commanders
    const commanders = state.cards.filter((c) => c.isCommander);
    if (commanders.length > 0) {
      commanders.forEach((c) => {
        lines.push(`${c.quantity} ${c.name}`);
      });
    }

    // 2. Main Deck (excluding commanders)
    const mainCards = state.cards.filter((c) => !c.isCommander);
    if (mainCards.length > 0) {
      // Sort alphabetically for clean look
      const sortedMain = [...mainCards].sort((a, b) => a.name.localeCompare(b.name));
      sortedMain.forEach((c) => {
        lines.push(`${c.quantity} ${c.name}`);
      });
    }

    // 3. Side Deck (Sidedeck)
    if (state.isSideDeckEnabled && state.sidedeck && state.sidedeck.length > 0) {
      const sortedSide = [...state.sidedeck].sort((a, b) => a.name.localeCompare(b.name));
      sortedSide.forEach((c) => {
        lines.push(`${c.quantity} ${c.name}`);
      });
    }

    return lines.join('\n').trim();
  };

  const handleDownloadText = () => {
    if (!state) return;
    const text = generateDecklistText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const deckName = state.deckName.replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'commander-deck';
    a.download = `${deckName}-decklist.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    const text = generateDecklistText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const isValid = totalCards === 100;
  const decklistText = generateDecklistText();

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="max-w-2xl bg-card border-border shadow-2xl flex flex-col max-h-[85vh] p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Download className="w-5 h-5 text-primary" />
            Export Deck: {state.deckName}
          </DialogTitle>
          <DialogDescription>
            Choose your preferred export format below.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="tts" className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-lg mb-4 shrink-0">
            <TabsTrigger value="tts" className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md">
              <Layers className="w-3.5 h-3.5" />
              Tabletop Simulator (JSON)
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md">
              <FileText className="w-3.5 h-3.5" />
              Text List (TXT)
            </TabsTrigger>
          </TabsList>

          {/* TABLETOP SIMULATOR TAB */}
          <TabsContent value="tts" className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            <div className="space-y-4">
              {/* Deck breakdown preview */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  TTS Export Preview
                </h3>

                <div className="space-y-2">
                  <SubDeckRow
                    icon={<Layers className="w-4 h-4" />}
                    label="Main Deck"
                    count={mainCount}
                    color="text-primary"
                    description="Includes commanders and DFCs (standard cardbacks)"
                  />
                  {state.isSideDeckEnabled && (
                    <SubDeckRow
                      icon={<Archive className="w-4 h-4" />}
                      label="Side Deck"
                      count={sideCount}
                      color="text-amber-500"
                      description="Separate face-down deck"
                    />
                  )}
                  <SubDeckRow
                    icon={<Sparkles className="w-4 h-4" />}
                    label="Tokens"
                    count={tokenCount}
                    color="text-blue-400"
                    description="Auto-detected from Scryfall"
                  />
                  <SubDeckRow
                    icon={<Shuffle className="w-4 h-4" />}
                    label="Double-Faced Cards"
                    count={dfcCount}
                    color="text-purple-400"
                    description="Double-sided references generated next to deck"
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
                    {dfcCards.slice(0, 8).map((c) => (
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
                    {dfcCards.length > 8 && (
                      <div className="w-10 h-14 rounded border border-border bg-secondary flex items-center justify-center text-[10px] text-muted-foreground font-semibold">
                        +{dfcCards.length - 8}
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
                <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3 space-y-1 border border-border/40">
                  <p className="text-green-400 font-medium mb-1">✓ Last export:</p>
                  <p>• {lastResult.mainCount} main deck cards (includes DFCs)</p>
                  {lastResult.sideCount > 0 && (
                    <p>• {lastResult.sideCount} side deck cards</p>
                  )}
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
              <div className="pt-2">
                <Button
                  id="export-tts-btn"
                  onClick={handleTTSExport}
                  disabled={isExporting || state.cards.length === 0}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all gap-2"
                  size="lg"
                >
                  {isExporting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Generating TTS JSON...</>
                  ) : (
                    <><Download className="w-4 h-4" />Export to Tabletop Simulator</>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed mt-2.5">
                  Downloads a <code>.json</code> file you can import into TTS via{' '}
                  <em>Objects → Saved Objects</em> or the in-game import function.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* TEXT LIST TAB */}
          <TabsContent value="text" className="flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 shrink-0">
                Decklist Preview
              </h3>
              
              <div className="flex-1 min-h-0 rounded-lg border border-border bg-secondary/30 relative flex flex-col">
                <textarea
                  readOnly
                  value={decklistText}
                  className="w-full h-full p-3 text-xs font-mono bg-transparent text-foreground outline-none resize-none overflow-y-auto custom-scrollbar"
                  placeholder="The deck is empty."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 shrink-0">
              <Button
                variant="outline"
                onClick={handleCopyToClipboard}
                disabled={!decklistText}
                className="gap-2 border-border hover:bg-secondary transition-all"
              >
                {copied ? (
                  <><Check className="w-4 h-4 text-green-400" />Copied!</>
                ) : (
                  <><Copy className="w-4 h-4" />Copy to Clipboard</>
                )}
              </Button>
              <Button
                onClick={handleDownloadText}
                disabled={!decklistText}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow shadow-primary/10 transition-all"
              >
                <Download className="w-4 h-4" />
                Download TXT
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed mt-1 shrink-0">
              This list format is standard and can be directly pasted into Moxfield, Archidekt, MTG Arena, etc.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
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
