'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ImageIcon,
  Download,
  Copy,
  Loader2,
  Check,
  AlertCircle,
  Crown
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useDeck } from '@/lib/deck-store';
import { getFrontImageUrl, isDoubleFaced, getManaSymbolUrl, isGameChangerCard } from '@/lib/scryfall';

interface ShareBannerModalProps {
  open: boolean;
  onClose: () => void;
  deckId?: string;
}

interface ThemePreset {
  name: string;
  id: string;
  bgGradStart: string;
  bgGradEnd: string;
  overlayColor: string;
  accentColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  badgeBg: string;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Obsidian cEDH',
    id: 'obsidian',
    bgGradStart: 'rgba(9, 9, 11, 0.97)',
    bgGradEnd: 'rgba(9, 9, 11, 0.35)',
    overlayColor: 'rgba(9, 9, 11, 0.88)',
    accentColor: '#fbbf24', // gold/amber
    borderColor: 'rgba(251, 191, 36, 0.25)',
    textColor: '#ffffff',
    mutedColor: '#a1a1aa',
    badgeBg: 'rgba(251, 191, 36, 0.08)',
  },
  {
    name: 'Aether Blue',
    id: 'aether',
    bgGradStart: 'rgba(15, 23, 42, 0.98)',
    bgGradEnd: 'rgba(15, 23, 42, 0.40)',
    overlayColor: 'rgba(15, 23, 42, 0.9)',
    accentColor: '#38bdf8', // sky blue
    borderColor: 'rgba(56, 189, 248, 0.25)',
    textColor: '#ffffff',
    mutedColor: '#94a3b8',
    badgeBg: 'rgba(56, 189, 248, 0.08)',
  },
  {
    name: 'Boros Crimson',
    id: 'boros',
    bgGradStart: 'rgba(24, 10, 10, 0.98)',
    bgGradEnd: 'rgba(24, 10, 10, 0.45)',
    overlayColor: 'rgba(24, 10, 10, 0.9)',
    accentColor: '#f87171', // soft red
    borderColor: 'rgba(248, 113, 113, 0.3)',
    textColor: '#ffffff',
    mutedColor: '#fca5a5',
    badgeBg: 'rgba(248, 113, 113, 0.08)',
  },
  {
    name: 'Golgari Moss',
    id: 'golgari',
    bgGradStart: 'rgba(9, 15, 12, 0.98)',
    bgGradEnd: 'rgba(9, 15, 12, 0.40)',
    overlayColor: 'rgba(9, 15, 12, 0.91)',
    accentColor: '#4ade80', // emerald green
    borderColor: 'rgba(74, 222, 128, 0.25)',
    textColor: '#ffffff',
    mutedColor: '#a7f3d0',
    badgeBg: 'rgba(74, 222, 128, 0.08)',
  },
];

export function ShareBannerModal({ open, onClose, deckId }: ShareBannerModalProps) {
  const { state: globalState, decks } = useDeck();
  const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [selectedTheme, setSelectedTheme] = useState<string>('obsidian');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Preloaded image references
  const [artCropImage, setArtCropImage] = useState<HTMLImageElement | null>(null);
  const [cardImage, setCardImage] = useState<HTMLImageElement | null>(null);
  const [manaImages, setManaImages] = useState<Record<string, HTMLImageElement>>({});

  if (!state) return null;

  const commanderCard = state.cards.find((c) => c.isCommander) ?? null;
  const totalCards = state.cards.reduce((sum, c) => sum + c.quantity, 0);

  // Stats Parsers
  const nonLandCards = state.cards.filter((c) => !c.scryfallData.type_line?.toLowerCase().includes('land'));
  const nonLandCount = nonLandCards.reduce((sum, c) => sum + c.quantity, 0);
  const totalCMC = nonLandCards.reduce((sum, c) => sum + (c.scryfallData.cmc || 0) * c.quantity, 0);
  const averageCMC = nonLandCount > 0 ? (totalCMC / nonLandCount).toFixed(2) : '0.00';

  // Game Changer Count
  let gameChangerCount = 0;
  for (const card of state.cards) {
    if (isGameChangerCard(card.name)) {
      gameChangerCount += card.quantity;
    }
  }

  const typeCounts = {
    creatures: state.cards.filter((c) => c.scryfallData.type_line?.toLowerCase().includes('creature')).reduce((sum, c) => sum + c.quantity, 0),
    instants: state.cards.filter((c) => c.scryfallData.type_line?.toLowerCase().includes('instant')).reduce((sum, c) => sum + c.quantity, 0),
    sorceries: state.cards.filter((c) => c.scryfallData.type_line?.toLowerCase().includes('sorcery')).reduce((sum, c) => sum + c.quantity, 0),
    lands: state.cards.filter((c) => c.scryfallData.type_line?.toLowerCase().includes('land')).reduce((sum, c) => sum + c.quantity, 0),
    other: state.cards.filter((c) => {
      const type = c.scryfallData.type_line?.toLowerCase() || '';
      return !type.includes('creature') && !type.includes('instant') && !type.includes('sorcery') && !type.includes('land');
    }).reduce((sum, c) => sum + c.quantity, 0),
  };

  const colorIdentity = commanderCard?.scryfallData.color_identity || ['C'];

  // Asynchronously load images when commander changes
  useEffect(() => {
    if (!open || !commanderCard) return;

    setIsLoading(true);
    setError('');
    setArtCropImage(null);
    setCardImage(null);

    const scryCard = commanderCard.scryfallData;
    
    // Extract Image URLs
    let artCropUrl = '';
    let normalUrl = '';

    if (scryCard.image_uris?.art_crop) {
      artCropUrl = scryCard.image_uris.art_crop;
    } else if (scryCard.card_faces?.[0]?.image_uris?.art_crop) {
      artCropUrl = scryCard.card_faces[0].image_uris.art_crop;
    }

    if (scryCard.image_uris?.normal) {
      normalUrl = scryCard.image_uris.normal;
    } else if (scryCard.card_faces?.[0]?.image_uris?.normal) {
      normalUrl = scryCard.card_faces[0].image_uris.normal;
    }

    if (!artCropUrl || !normalUrl) {
      setError('Commander Scryfall image URLs could not be found.');
      setIsLoading(false);
      return;
    }

    // Preload helper
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      });
    };

    // Append a query param to bypass cached non-CORS responses in browser
    const corsArtCropUrl = `${artCropUrl}${artCropUrl.includes('?') ? '&' : '?'}cors=true`;
    const corsNormalUrl = `${normalUrl}${normalUrl.includes('?') ? '&' : '?'}cors=true`;

    const loadManaImages = Promise.all(
      colorIdentity.map((c) => {
        const rawUrl = getManaSymbolUrl(c);
        const corsUrl = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}cors=true`;
        return loadImage(corsUrl)
          .then((img) => ({ symbol: c, img }))
          .catch((err) => {
            console.warn(`Failed to preload mana symbol SVG ${c}:`, err);
            return { symbol: c, img: null };
          });
      })
    );

    Promise.all([
      loadImage(corsArtCropUrl),
      loadImage(corsNormalUrl),
      loadManaImages
    ])
      .then(([artCropImg, normalCardImg, manaImgs]) => {
        setArtCropImage(artCropImg);
        setCardImage(normalCardImg);
        
        const manaMap: Record<string, HTMLImageElement> = {};
        manaImgs.forEach((item) => {
          if (item.img) {
            manaMap[item.symbol] = item.img;
          }
        });
        setManaImages(manaMap);
        
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('CORS/Image preloading error: ', err);
        setError('Error preloading card artwork from Scryfall CDN.');
        setIsLoading(false);
      });
  }, [open, commanderCard]);

  // Redraw Canvas when preloaded images, theme, or state changes
  useEffect(() => {
    if (!open || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, 1546, 432);

    const theme = THEME_PRESETS.find((t) => t.id === selectedTheme) || THEME_PRESETS[0];

    // 1. Draw Background
    if (artCropImage) {
      // Draw Cover Crop
      const scale = Math.max(1546 / artCropImage.width, 432 / artCropImage.height);
      const x = (1546 - artCropImage.width * scale) / 2;
      const y = (432 - artCropImage.height * scale) / 2;
      ctx.drawImage(artCropImage, x, y, artCropImage.width * scale, artCropImage.height * scale);
    } else {
      // Draw Gradient Fallback
      const grad = ctx.createLinearGradient(0, 0, 1546, 432);
      grad.addColorStop(0, '#09090b');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1546, 432);
    }

    // 2. Draw Vignette Gradient Mask (Left Solid to Right Transparent)
    const overlayGrad = ctx.createLinearGradient(0, 0, 1546, 0);
    overlayGrad.addColorStop(0, theme.bgGradStart);
    overlayGrad.addColorStop(0.4, theme.bgGradStart);
    overlayGrad.addColorStop(0.75, theme.bgGradEnd);
    overlayGrad.addColorStop(1, 'rgba(9, 9, 11, 0.05)');

    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, 1546, 432);

    // 3. Setup text shadows & drawing parameters
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Draw Deck Name
    ctx.fillStyle = theme.textColor;
    ctx.font = 'bold 46px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Truncate name if too long
    const rawDeckName = state.deckName || 'New Commander Deck';
    let deckName = rawDeckName;
    if (ctx.measureText(deckName).width > 850) {
      while (ctx.measureText(deckName + '...').width > 850 && deckName.length > 0) {
        deckName = deckName.slice(0, -1);
      }
      deckName += '...';
    }
    ctx.fillText(deckName, 60, 50);

    // Draw Commander Subtitle Label
    ctx.fillStyle = theme.accentColor;
    ctx.font = 'semibold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Commander: ${commanderCard?.name || 'Unknown Commander'}`, 60, 118);

    ctx.restore();

    // Draw Separator Line
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 168);
    ctx.lineTo(800, 168);
    ctx.stroke();

    // 4. Draw Core Stats Badges
    const drawRoundedRect = (c: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, radius: number) => {
      c.beginPath();
      c.moveTo(rx + radius, ry);
      c.arcTo(rx + rw, ry, rx + rw, ry + rh, radius);
      c.arcTo(rx + rw, ry + rh, rx, ry + rh, radius);
      c.arcTo(rx, ry + rh, rx, ry, radius);
      c.arcTo(rx, ry, rx + rw, ry, radius);
      c.closePath();
    };

    // Helper to draw a stats block
    const drawStatsBlock = (xPos: number, yPos: number, titleText: string, valText: string, badgeAccent = false) => {
      ctx.fillStyle = theme.overlayColor;
      drawRoundedRect(ctx, xPos, yPos, 220, 85, 12);
      ctx.fill();

      ctx.strokeStyle = badgeAccent ? theme.borderColor : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, xPos, yPos, 220, 85, 12);
      ctx.stroke();

      // Title
      ctx.fillStyle = theme.mutedColor;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(titleText.toUpperCase(), xPos + 18, yPos + 18);

      // Value
      ctx.fillStyle = badgeAccent ? theme.accentColor : '#ffffff';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText(valText, xPos + 18, yPos + 40);
    };

    ctx.textBaseline = 'top';
    drawStatsBlock(60, 192, 'Game Changers', String(gameChangerCount), gameChangerCount > 0);
    drawStatsBlock(300, 192, 'Average CMC', averageCMC, true);

    // 5. Draw Type breakdown horizontal blocks
    const typesList = [
      { name: 'Creatures', count: typeCounts.creatures },
      { name: 'Instants', count: typeCounts.instants },
      { name: 'Sorceries', count: typeCounts.sorceries },
      { name: 'Lands', count: typeCounts.lands },
      { name: 'Other', count: typeCounts.other },
    ];

    const typeSpacing = 142;
    typesList.forEach((t, i) => {
      const bx = 60 + i * typeSpacing;
      const by = 295;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      drawRoundedRect(ctx, bx, by, 125, 48, 8);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, bx, by, 125, 48, 8);
      ctx.stroke();

      ctx.fillStyle = theme.mutedColor;
      ctx.font = '500 10px system-ui, sans-serif';
      ctx.fillText(t.name.toUpperCase(), bx + 12, by + 10);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(String(t.count), bx + 12, by + 22);
    });

    // 6. Draw Color Identity Mana Circles
    ctx.save();
    const colorMap: Record<string, string> = {
      W: '#f9fafb',
      U: '#3b82f6',
      B: '#18181b',
      R: '#ef4444',
      G: '#22c55e',
      C: '#6b7280',
    };

    const borderMap: Record<string, string> = {
      W: '#fbbf24',
      U: '#60a5fa',
      B: '#3f3f46',
      R: '#f87171',
      G: '#4ade80',
      C: '#9ca3af',
    };

    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;

    colorIdentity.forEach((c, idx) => {
      const cx = 60 + idx * 38;
      const cy = 380;
      const manaImg = manaImages[c];

      if (manaImg) {
        // Draw Magic symbol SVG icon
        ctx.drawImage(manaImg, cx - 14, cy - 14, 28, 28);
      } else {
        // Fallback to beautiful circle
        const colorVal = colorMap[c] || '#6b7280';
        const borderVal = borderMap[c] || '#9ca3af';

        ctx.fillStyle = colorVal;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = borderVal;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = c === 'W' || c === 'C' ? '#000000' : '#ffffff';
        ctx.font = 'bold 11px font-mono, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c, cx, cy);
      }
    });
    ctx.restore();

    // 8. Draw Floating Card Art on the Right Side
    if (cardImage) {
      ctx.save();
      // Draw shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 12;

      // Position Variables
      const cw = 250;
      const ch = 350;
      const cx = 1180 + cw / 2;
      const cy = 41 + ch / 2;

      // Apply subtle rotation
      ctx.translate(cx, cy);
      ctx.rotate(-3 * Math.PI / 180); // Rotate -3 degrees

      // Rounded clipping boundary for the MTG card (similar card corners)
      ctx.beginPath();
      drawRoundedRect(ctx, -cw / 2, -ch / 2, cw, ch, 12);
      ctx.clip();

      // Draw the floating card image inside the clip
      ctx.drawImage(cardImage, -cw / 2, -ch / 2, cw, ch);
      ctx.restore();
    }
  }, [open, artCropImage, cardImage, selectedTheme, state]);

  // Action: Download Banner PNG
  function handleDownload() {
    if (!canvasRef.current || !state) return;
    const canvas = canvasRef.current;
    
    // Trigger download
    const deckName = state.deckName.replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'commander-deck';
    const link = document.createElement('a');
    link.download = `${deckName}-banner.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Action: Copy to Clipboard
  function handleCopyToClipboard() {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    canvas.toBlob((blob) => {
      if (!blob) return;
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        navigator.clipboard.write([item])
          .then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
          })
          .catch((err) => {
            console.error('Clipboard copy failed: ', err);
            alert('Failed to copy image to clipboard automatically. Try downloading it instead!');
          });
      } catch (err) {
        console.error('ClipboardItem not supported or failed: ', err);
        alert('Clipboard write not fully supported by this browser. Please use the Download option!');
      }
    }, 'image/png');
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-4xl bg-card border-border flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <DialogHeader className="shrink-0 select-none">
          <DialogTitle className="flex items-center gap-2 text-gradient-red text-xl font-bold">
            <ImageIcon className="w-5 h-5 text-primary" />
            Deck Share Banner Generator
          </DialogTitle>
          <DialogDescription>
            Generate a stunning, high-resolution 1546 x 432 px banner image of your deck list to share on Discord, Reddit, or social media.
          </DialogDescription>
        </DialogHeader>

        {/* Commander Check Warning */}
        {!commanderCard ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center select-none max-w-sm mx-auto gap-3">
            <AlertCircle className="w-12 h-12 text-yellow-500" />
            <h3 className="text-base font-bold text-foreground">No Commander Selected</h3>
            <p className="text-xs text-muted-foreground">
              To generate a custom card art banner, please select a Commander for your deck by clicking the crown icon on the card list first!
            </p>
            <Button variant="outline" onClick={onClose} className="mt-2">
              Go Back
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-5 overflow-y-auto py-2 pr-1 min-h-0">
            
            {/* ── SECTION 1: CANVAS PREVIEW ────────────────────────── */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block select-none">
                Banner Live Preview (1546 x 432)
              </span>
              
              {/* Canvas viewport wrapper */}
              <div className="relative w-full aspect-[1546/432] rounded-xl overflow-hidden border border-border shadow-2xl bg-neutral-950 flex items-center justify-center">
                {isLoading && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-sm gap-2.5">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-xs font-semibold text-muted-foreground">Loading Scryfall HD images...</p>
                  </div>
                )}
                {error && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-950/90 text-center p-6 gap-2">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                    <p className="text-xs font-bold text-foreground">{error}</p>
                    <p className="text-[10px] text-muted-foreground">Falling back to dark gradient atmosphere.</p>
                  </div>
                )}

                {/* The actual pixel canvas */}
                <canvas
                  ref={canvasRef}
                  width={1546}
                  height={432}
                  className="w-full h-full object-contain rounded-xl select-none"
                />
              </div>
            </div>

            {/* ── SECTION 2: CUSTOMIZE PRESETS ────────────────────── */}
            <div className="space-y-3 select-none">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                Choose Color Palette Theme
              </span>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {THEME_PRESETS.map((t) => {
                  const isActive = selectedTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTheme(t.id)}
                      className={`relative flex flex-col items-start p-3 border rounded-xl bg-secondary/15 hover:bg-secondary/25 transition-all text-left group ${
                        isActive
                          ? 'border-primary shadow shadow-primary/10 bg-primary/5'
                          : 'border-border/60 hover:border-primary/30'
                      }`}
                    >
                      {/* Active border ring */}
                      {isActive && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary/20 border border-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary stroke-[3px]" />
                        </div>
                      )}
                      
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {t.name}
                      </span>
                      
                      {/* Tiny color pills */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.accentColor }} />
                        <span className="w-4 h-1.5 rounded-sm bg-white/20" />
                        <span className="w-4 h-1.5 rounded-sm bg-white/5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="my-1" />

            {/* ── SECTION 3: ACTIONS ──────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                onClick={handleDownload}
                disabled={isLoading}
                className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/15 gap-2 h-11"
              >
                <Download className="w-4 h-4" />
                Download High-Res PNG
              </Button>
              
              <Button
                variant="outline"
                onClick={handleCopyToClipboard}
                disabled={isLoading}
                className={`w-full sm:w-[220px] font-bold border-border hover:border-primary/50 hover:bg-primary/5 transition-colors gap-2 h-11 ${
                  isCopied ? 'text-green-500 border-green-500/50 hover:bg-green-500/5 hover:text-green-500' : ''
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 animate-scale" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>

          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
