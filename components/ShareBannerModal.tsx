'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ImageIcon,
  Download,
  Copy,
  Loader2,
  Check,
  AlertCircle,
  Crown,
  Share2,
  Link as LinkIcon
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useDeck } from '@/lib/deck-store';
import { getFrontImageUrl, isDoubleFaced, getManaSymbolUrl, isGameChangerCard } from '@/lib/scryfall';
import { compressDeck } from '@/lib/share';

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
  const decklistCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [selectedTheme, setSelectedTheme] = useState<string>('obsidian');
  const [activeTab, setActiveTab] = useState<'link' | 'banner' | 'decklist'>('banner');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isUrlCopied, setIsUrlCopied] = useState(false);
  const [isShortening, setIsShortening] = useState(false);
  const [isShortened, setIsShortened] = useState(false);
  const [shortenError, setShortenError] = useState('');

  // Generate and auto-shorten share URL when modal opens
  useEffect(() => {
    setIsUrlCopied(false);
    setIsShortening(false);
    setIsShortened(false);
    setShortenError('');
    setShareUrl('');

    if (!open || !state) return;

    const generate = async () => {
      try {
        const compressed = compressDeck(state);
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const longUrl = `${origin}/share?d=${compressed}`;
        setShareUrl(longUrl);
        setIsShortening(true);
        try {
          const resp = await fetch(`/api/shorten?url=${encodeURIComponent(longUrl)}`);
          if (!resp.ok) throw new Error(`status ${resp.status}`);
          const short = await resp.text();
          if (short && short.startsWith('http')) {
            setShareUrl(short);
            setIsShortened(true);
          }
        } catch (shortenErr) {
          console.warn('Auto-shortening failed, keeping long URL:', shortenErr);
          setShortenError('El acortador no está disponible. Puedes copiar el enlace largo.');
          setTimeout(() => setShortenError(''), 6000);
        } finally {
          setIsShortening(false);
        }
      } catch (err) {
        console.error('Error generating share link:', err);
      }
    };

    generate();
  }, [open, state]);

  const handleCopyUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsUrlCopied(true);
      setTimeout(() => setIsUrlCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

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

  // Asynchronously load images and all unique mana symbols when commander or decklist changes
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

    // Bypass WebM / Custom alters for banner canvas creation (use static Scryfall base art)
    if (artCropUrl && (artCropUrl.endsWith('.webm') || artCropUrl.includes('.webm') || artCropUrl.includes('catbox.moe') || artCropUrl.includes('pixeldrain.com'))) {
      artCropUrl = `https://cards.scryfall.io/art_crop/front/${scryCard.id[0]}/${scryCard.id[1]}/${scryCard.id}.jpg`;
    }
    if (normalUrl && (normalUrl.endsWith('.webm') || normalUrl.includes('.webm') || normalUrl.includes('catbox.moe') || normalUrl.includes('pixeldrain.com'))) {
      normalUrl = `https://cards.scryfall.io/normal/front/${scryCard.id[0]}/${scryCard.id[1]}/${scryCard.id}.jpg`;
    }

    if (!artCropUrl || !normalUrl) {
      setError('Commander Scryfall image URLs could not be found.');
      setIsLoading(false);
      return;
    }

    // Collect all unique mana symbols in the decklist to preload them all!
    const uniqueSymbols = new Set<string>();
    state.cards.forEach((card) => {
      const manaCost = card.scryfallData.mana_cost || '';
      const matches = manaCost.match(/{[^{}]+}/g) || [];
      matches.forEach((sym) => {
        const symClean = sym.replace(/[{}]/g, ''); // e.g. '3', 'U'
        uniqueSymbols.add(symClean);
      });
    });
    // Add color identity symbols as well
    colorIdentity.forEach((c) => uniqueSymbols.add(c));
    const symbolsArray = Array.from(uniqueSymbols);

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
      symbolsArray.map((sym) => {
        const rawUrl = getManaSymbolUrl(sym);
        const corsUrl = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}cors=true`;
        return loadImage(corsUrl)
          .then((img) => ({ symbol: sym, img }))
          .catch((err) => {
            console.warn(`Failed to preload mana symbol SVG ${sym}:`, err);
            return { symbol: sym, img: null };
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
  }, [open, commanderCard, state]);

  // Redraw Promo Banner Canvas when preloaded images, theme, or state changes
  useEffect(() => {
    if (!open || !canvasRef.current || activeTab !== 'banner') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, 1546, 432);

    const theme = THEME_PRESETS.find((t) => t.id === selectedTheme) || THEME_PRESETS[0];

    const drawRoundedRect = (c: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, radius: number) => {
      c.beginPath();
      c.moveTo(rx + radius, ry);
      c.arcTo(rx + rw, ry, rx + rw, ry + rh, radius);
      c.arcTo(rx + rw, ry + rh, rx, ry + rh, radius);
      c.arcTo(rx, ry + rh, rx, ry, radius);
      c.arcTo(rx, ry, rx + rw, ry, radius);
      c.closePath();
    };

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
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Commander: ${commanderCard?.name || 'Unknown Commander'}`, 60, 118);

    ctx.restore();

    // Draw Tags capsules (if any)
    const tags = state.tags || [];
    if (tags.length > 0) {
      let tagX = 60;
      const tagY = 144;
      ctx.save();
      // Apply subtle shadow for capsules
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      tags.slice(0, 4).forEach((tag) => {
        ctx.font = '600 10px system-ui, -apple-system, sans-serif';
        const tagText = tag.toUpperCase();
        const textWidth = ctx.measureText(tagText).width;
        const badgeWidth = textWidth + 14;
        const badgeHeight = 19;

        // Draw capsule background using a semi-transparent version of accent color or border color
        ctx.fillStyle = theme.borderColor || 'rgba(255, 255, 255, 0.12)';
        drawRoundedRect(ctx, tagX, tagY, badgeWidth, badgeHeight, 5);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.8;
        drawRoundedRect(ctx, tagX, tagY, badgeWidth, badgeHeight, 5);
        ctx.stroke();

        // Draw tag text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, tagX + badgeWidth / 2, tagY + badgeHeight / 2 + 1); // +1 fine-tunes vertical alignment

        tagX += badgeWidth + 6;
      });
      ctx.restore();
    }

    // Draw Separator Line
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 172);
    ctx.lineTo(800, 172);
    ctx.stroke();

    // 4. Draw Core Stats Badges
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
  }, [open, artCropImage, cardImage, selectedTheme, state, activeTab]);

  // Redraw Decklist Infographic Canvas when preloaded images, theme, or state changes
  useEffect(() => {
    if (!open || !decklistCanvasRef.current || activeTab !== 'decklist') return;

    const canvas = decklistCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, 1200, 1500);

    const theme = THEME_PRESETS.find((t) => t.id === selectedTheme) || THEME_PRESETS[0];

    const drawRoundedRect = (c: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, radius: number) => {
      c.beginPath();
      c.moveTo(rx + radius, ry);
      c.arcTo(rx + rw, ry, rx + rw, ry + rh, radius);
      c.arcTo(rx + rw, ry + rh, rx, ry + rh, radius);
      c.arcTo(rx, ry + rh, rx, ry, radius);
      c.arcTo(rx, ry, rx + rw, ry, radius);
      c.closePath();
    };

    // Helper to draw mana symbols in card rows
    const drawManaCost = (c: CanvasRenderingContext2D, manaStr: string, rx: number, ry: number) => {
      if (!manaStr) return;
      const symbols = manaStr.match(/{[^{}]+}/g) || [];
      let symbolX = rx; // Starting from the right and drawing leftwards!
      
      c.save(); // Save canvas context to isolate textBaseline and textAlign alterations
      // Reverse symbols to draw right-to-left
      [...symbols].reverse().forEach((sym) => {
        const symClean = sym.replace(/[{}]/g, ''); // e.g. '3', 'U', 'B'
        const img = manaImages[symClean];

        if (img) {
          // Draw official Magic symbol SVG icon preloaded from Scryfall!
          c.drawImage(img, symbolX - 7, ry - 7, 14, 14);
        } else {
          // Draw small circle fallback
          c.fillStyle = 'rgba(255, 255, 255, 0.08)';
          c.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          c.beginPath();
          c.arc(symbolX, ry, 7, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          
          // Draw symbol letter/number
          c.fillStyle = '#ffffff';
          c.font = 'bold 8px font-mono, system-ui, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(symClean, symbolX, ry);
        }
        
        symbolX -= 16; // Shift left for next symbol
      });
      c.restore(); // Revert any baseline/alignment changes
    };

    // 1. Draw Blurred Cover Art Image Background
    if (artCropImage) {
      const scale = Math.max(1200 / artCropImage.width, 1500 / artCropImage.height);
      const x = (1200 - artCropImage.width * scale) / 2;
      const y = (1500 - artCropImage.height * scale) / 2;
      ctx.drawImage(artCropImage, x, y, artCropImage.width * scale, artCropImage.height * scale);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 1200, 1500);
      grad.addColorStop(0, '#09090b');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 1500);
    }

    // Dark glassmorphism overlay to cover the background nicely
    ctx.fillStyle = 'rgba(9, 9, 11, 0.88)';
    ctx.fillRect(0, 0, 1200, 1500);

    // 2. Draw Left Sidebar Panel background
    ctx.fillStyle = theme.bgGradStart;
    ctx.fillRect(0, 0, 420, 1500);
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(420, 0);
    ctx.lineTo(420, 1500);
    ctx.stroke();

    // 3. Draw Left Sidebar Content
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Deck Name
    ctx.fillStyle = theme.textColor;
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const rawDeckName = state.deckName || 'New Commander Deck';
    let deckName = rawDeckName;
    if (ctx.measureText(deckName).width > 300) {
      while (ctx.measureText(deckName + '...').width > 300 && deckName.length > 0) {
        deckName = deckName.slice(0, -1);
      }
      deckName += '...';
    }
    ctx.fillText(deckName, 60, 60);

    // Subtitle COMMANDER
    ctx.fillStyle = theme.mutedColor;
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('COMMANDER DECKLIST', 60, 120);

    ctx.fillStyle = theme.accentColor;
    ctx.font = '600 20px system-ui, -apple-system, sans-serif';
    const commanderName = commanderCard?.name || 'Unknown Commander';
    let dispCommName = commanderName;
    if (ctx.measureText(dispCommName).width > 300) {
      while (ctx.measureText(dispCommName + '...').width > 300 && dispCommName.length > 0) {
        dispCommName = dispCommName.slice(0, -1);
      }
      dispCommName += '...';
    }
    ctx.fillText(dispCommName, 60, 140);
    ctx.restore();

    // Custom Tags
    const tags = state.tags || [];
    if (tags.length > 0) {
      let tagX = 60;
      ctx.save();
      tags.slice(0, 3).forEach((tag) => {
        ctx.font = '600 9px system-ui, -apple-system, sans-serif';
        const tagText = tag.toUpperCase();
        const textWidth = ctx.measureText(tagText).width;
        const badgeWidth = textWidth + 10;
        const badgeHeight = 16;
        ctx.fillStyle = theme.borderColor || 'rgba(255, 255, 255, 0.12)';
        drawRoundedRect(ctx, tagX, 180, badgeWidth, badgeHeight, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        drawRoundedRect(ctx, tagX, 180, badgeWidth, badgeHeight, 4);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, tagX + badgeWidth / 2, 180 + badgeHeight / 2 + 0.5);
        tagX += badgeWidth + 5;
      });
      ctx.restore();
    }

    // Divider Line
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 215);
    ctx.lineTo(360, 215);
    ctx.stroke();

    // Commander Card Visual
    if (cardImage) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 8;

      const cw = 300;
      const ch = 420;
      const cx = 60;
      const cy = 240;

      ctx.beginPath();
      drawRoundedRect(ctx, cx, cy, cw, ch, 14);
      ctx.clip();
      ctx.drawImage(cardImage, cx, cy, cw, ch);
      ctx.restore();
    }

    // Stats Blocks
    const drawLeftStatsBlock = (yPos: number, title: string, value: string, iconType: 'cmc' | 'crown' | 'ratio', highlight = false) => {
      ctx.save();
      ctx.fillStyle = theme.overlayColor;
      drawRoundedRect(ctx, 60, yPos, 300, 65, 10);
      ctx.fill();
      ctx.strokeStyle = highlight ? theme.borderColor : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, 60, yPos, 300, 65, 10);
      ctx.stroke();

      ctx.textBaseline = 'top';
      ctx.fillStyle = theme.mutedColor;
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText(title.toUpperCase(), 76, yPos + 12);

      ctx.fillStyle = highlight ? theme.accentColor : '#ffffff';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(value, 76, yPos + 26);

      // Draw premium vector icon on the right (centered at x = 315, y = yPos + 32)
      ctx.strokeStyle = highlight ? theme.accentColor : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      const ix = 315;
      const iy = yPos + 32;

      if (iconType === 'cmc') {
        // Lightning bolt icon for CMC/Speed
        ctx.beginPath();
        ctx.moveTo(ix - 4, iy - 10);
        ctx.lineTo(ix + 1, iy - 2);
        ctx.lineTo(ix - 3, iy - 1);
        ctx.lineTo(ix + 4, iy + 10);
        ctx.lineTo(ix - 1, iy + 2);
        ctx.lineTo(ix + 3, iy + 1);
        ctx.closePath();
        ctx.stroke();
      } else if (iconType === 'crown') {
        // Beautiful crown icon for Game Changers
        ctx.beginPath();
        ctx.moveTo(ix - 10, iy + 8);
        ctx.lineTo(ix - 12, iy - 5);
        ctx.lineTo(ix - 6, iy + 2);
        ctx.lineTo(ix, iy - 8);
        ctx.lineTo(ix + 6, iy + 2);
        ctx.lineTo(ix + 12, iy - 5);
        ctx.lineTo(ix + 10, iy + 8);
        ctx.closePath();
        ctx.stroke();
      } else if (iconType === 'ratio') {
        // Split composition scale / circles icon for lands vs spells
        ctx.beginPath();
        ctx.arc(ix - 6, iy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ix + 6, iy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ix - 12, iy + 8);
        ctx.lineTo(ix + 12, iy + 8);
        ctx.stroke();
      }

      ctx.restore();
    };

    // Calculate Lands vs Spells Ratio
    const landsCount = state.cards.filter(c => c.category === 'Land').reduce((sum, c) => sum + c.quantity, 0);
    const spellsCount = totalCards - landsCount;

    drawLeftStatsBlock(675, 'Average CMC', averageCMC, 'cmc', true);
    drawLeftStatsBlock(750, 'Game Changers', String(gameChangerCount), 'crown', gameChangerCount > 0);
    drawLeftStatsBlock(825, 'Deck Composition', `${spellsCount} Spl / ${landsCount} Lnd`, 'ratio', false);

    // Drop Shadow Filter for Curve & Curves
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Mana Curve Horizontal Bar Chart
    ctx.save();
    ctx.fillStyle = theme.textColor;
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('DECK MANA CURVE (SPELLS)', 60, 910);

    // Calculate curve counts (Excluding lands bulletproofly!)
    const cmcCounts = [0, 0, 0, 0, 0, 0, 0, 0]; // 0 to 7+
    state.cards.forEach((c) => {
      if (c.isCommander) return;
      if (c.category === 'Land') return;
      const cVal = Math.min(Math.floor(c.scryfallData.cmc || 0), 7);
      cmcCounts[cVal] += c.quantity;
    });
    const maxCmcCount = Math.max(...cmcCounts, 1);

    cmcCounts.forEach((count, i) => {
      const cy = 940 + i * 22;
      
      // Label
      ctx.fillStyle = theme.mutedColor;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(i === 7 ? '7+' : String(i), 60, cy + 6);

      // Bar
      const maxBarWidth = 190;
      const barWidth = (count / maxCmcCount) * maxBarWidth;
      
      if (count > 0) {
        ctx.fillStyle = theme.accentColor;
        drawRoundedRect(ctx, 80, cy, Math.max(barWidth, 4), 12, 3);
        ctx.fill();

        // Count number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.fillText(String(count), 86 + Math.max(barWidth, 4), cy + 6);
      } else {
        // Flat line fallback for empty curve values
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(80, cy + 5, 20, 2);
      }
    });
    ctx.restore();

    // Color Identity Symbols under the curve
    ctx.save();
    ctx.fillStyle = theme.textColor;
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('COLOR IDENTITY', 60, 1135);

    colorIdentity.forEach((c, idx) => {
      const cx = 74 + idx * 36;
      const cy = 1175;
      const manaImg = manaImages[c];

      if (manaImg) {
        ctx.drawImage(manaImg, cx - 14, cy - 14, 28, 28);
      } else {
        // Draw fallbacks
        const colorMap: Record<string, string> = { W: '#f9fafb', U: '#3b82f6', B: '#18181b', R: '#ef4444', G: '#22c55e', C: '#6b7280' };
        ctx.fillStyle = colorMap[c] || '#6b7280';
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c === 'W' || c === 'C' ? '#000000' : '#ffffff';
        ctx.font = 'bold 11px font-mono, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c, cx, cy);
      }
    });
    ctx.restore();
    // 4. Draw Right Column categorized decklist
    // Card categories sorting
    const cards = state.cards || [];
    const sortedCards = [...cards].sort((a, b) => a.name.localeCompare(b.name));

    const creatures = sortedCards.filter((c) => c.category === 'Creature' && !c.isCommander);
    const planeswalkers = sortedCards.filter((c) => c.category === 'Planeswalker' && !c.isCommander);
    const battles = sortedCards.filter((c) => c.category === 'Battle' && !c.isCommander);
    const artifacts = sortedCards.filter((c) => c.category === 'Artifact' && !c.isCommander);
    const enchantments = sortedCards.filter((c) => c.category === 'Enchantment' && !c.isCommander);
    const instants = sortedCards.filter((c) => c.category === 'Instant' && !c.isCommander);
    const sorceries = sortedCards.filter((c) => c.category === 'Sorcery' && !c.isCommander);
    const lands = sortedCards.filter((c) => c.category === 'Land' && !c.isCommander);
    const other = sortedCards.filter((c) => c.category === 'Other' && !c.isCommander);

    // Dynamic drawer helper
    const drawCategoryList = (cx: number, startY: number, title: string, list: typeof cards) => {
      if (list.length === 0) return startY;
      
      let y = startY;
      
      ctx.fillStyle = theme.accentColor;
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const headerText = `${title.toUpperCase()} (${list.reduce((sum, c) => sum + c.quantity, 0)})`;
      ctx.fillText(headerText, cx, y);
      
      y += 18;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx + 320, y);
      ctx.stroke();
      
      y += 8;
      
      list.forEach((c) => {
        ctx.fillStyle = '#ffffff';
        ctx.font = '500 12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top'; // Explicitly assert top baseline for every card row to guarantee stable vertical padding
        
        ctx.fillStyle = theme.accentColor;
        ctx.fillText(`${c.quantity}x`, cx, y);
        
        ctx.fillStyle = '#ffffff';
        const nameX = cx + 24;
        const nameWidth = 190;
        let nameStr = c.name;
        if (ctx.measureText(nameStr).width > nameWidth) {
          while (ctx.measureText(nameStr + '...').width > nameWidth && nameStr.length > 0) {
            nameStr = nameStr.slice(0, -1);
          }
          nameStr += '...';
        }
        ctx.fillText(nameStr, nameX, y);
        
        const rawMana = c.scryfallData.mana_cost || '';
        drawManaCost(ctx, rawMana, cx + 320, y + 6);
        
        y += 20;
      });
      
      return y + 16;
    };

    // Sub-column 1: Creatures, Planeswalkers, Battles, Artifacts, Enchantments, Others
    let col1Y = 60;
    col1Y = drawCategoryList(460, col1Y, 'Creatures', creatures);
    col1Y = drawCategoryList(460, col1Y, 'Planeswalkers', planeswalkers);
    col1Y = drawCategoryList(460, col1Y, 'Battles', battles);
    col1Y = drawCategoryList(460, col1Y, 'Artifacts', artifacts);
    col1Y = drawCategoryList(460, col1Y, 'Enchantments', enchantments);
    col1Y = drawCategoryList(460, col1Y, 'Other Spells', other);

    // Sub-column 2: Instants, Sorceries, Lands
    let col2Y = 60;
    col2Y = drawCategoryList(810, col2Y, 'Instants', instants);
    col2Y = drawCategoryList(810, col2Y, 'Sorceries', sorceries);
    col2Y = drawCategoryList(810, col2Y, 'Lands', lands);

  }, [open, artCropImage, cardImage, selectedTheme, state, activeTab]);

  // Action: Download Banner PNG
  function handleDownload() {
    const isBanner = activeTab === 'banner';
    const canvas = isBanner ? canvasRef.current : decklistCanvasRef.current;
    if (!canvas || !state) return;
    
    // Trigger download
    const deckName = state.deckName.replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'commander-deck';
    const filename = isBanner ? `${deckName}-banner.png` : `${deckName}-decklist.png`;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Action: Copy to Clipboard
  function handleCopyToClipboard() {
    const isBanner = activeTab === 'banner';
    const canvas = isBanner ? canvasRef.current : decklistCanvasRef.current;
    if (!canvas) return;

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
            <Share2 className="w-5 h-5 text-primary" />
            Deck Share & Export Portal
          </DialogTitle>
          <DialogDescription>
            Share your Commander deck via an interactive web link or generate stunning, high-resolution visuals.
          </DialogDescription>
        </DialogHeader>

        {/* Commander Check Warning */}
        {!commanderCard ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center select-none max-w-sm mx-auto gap-3">
            <AlertCircle className="w-12 h-12 text-yellow-500" />
            <h3 className="text-base font-bold text-foreground">No Commander Selected</h3>
            <p className="text-xs text-muted-foreground">
              To share your deck or generate custom card artwork, please select a Commander for your deck by clicking the crown icon on the card list first!
            </p>
            <Button variant="outline" onClick={onClose} className="mt-2">
              Go Back
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="banner" value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full bg-secondary shrink-0 select-none">
              <TabsTrigger value="banner" className="flex-1 gap-2 py-2 text-xs font-bold">
                <ImageIcon className="w-4 h-4" />
                <span>Promo Banner</span>
              </TabsTrigger>
              <TabsTrigger value="decklist" className="flex-1 gap-2 py-2 text-xs font-bold">
                <Crown className="w-4 h-4" />
                <span>Decklist Poster</span>
              </TabsTrigger>
              <TabsTrigger value="link" className="flex-1 gap-2 py-2 text-xs font-bold">
                <LinkIcon className="w-4 h-4" />
                <span>Share Link</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 flex flex-col gap-4 overflow-y-auto py-3 pr-1 min-h-0">
              
              <TabsContent value="link" className="flex-1 flex flex-col gap-4 mt-0 animate-fade-in-up">
                <div className="bg-secondary/15 rounded-xl border border-border/40 p-5 flex flex-col gap-4 relative overflow-hidden select-none">
                  <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-primary/5 blur-2xl animate-pulse" />
                  
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                      <Share2 className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Interactive Deck Share Link</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        A permanent, database-free link that preserves all selected art printings, alterations, stats, and custom tags.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-black/60 border border-border/60 rounded-lg p-2.5 mt-2">
                    {isShortening ? (
                      <div className="flex items-center gap-2 flex-1 text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span className="text-xs font-mono truncate">Acortando enlace...</span>
                      </div>
                    ) : (
                      <Input
                        value={shareUrl}
                        readOnly
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="bg-transparent border-0 h-6 text-xs text-foreground/80 focus-visible:ring-0 focus-visible:ring-offset-0 select-all font-mono w-full"
                      />
                    )}
                    <Button
                      size="xs"
                      onClick={handleCopyUrl}
                      disabled={isShortening || !shareUrl}
                      className={`h-8 px-3.5 shrink-0 font-bold shadow-sm transition-all active:scale-95 ${
                        isUrlCopied ? 'bg-green-500 hover:bg-green-500 text-white' : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      }`}
                    >
                      {isUrlCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>

                  {shortenError && (
                    <p className="text-amber-400 text-[10.5px] mt-0.5 flex items-center gap-1 select-none animate-fade-in">
                      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{shortenError}</span>
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 select-none">
                    <div className="p-3.5 rounded-lg bg-secondary/5 border border-border/30 text-xs leading-relaxed space-y-1">
                      <strong className="text-foreground flex items-center gap-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Interactive Showcase
                      </strong>
                      <p className="text-muted-foreground text-[10.5px]">
                        Recipients can browse your cards, view visual art grids, check mana curves, and inspect combos without needing an account.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-lg bg-secondary/5 border border-border/30 text-xs leading-relaxed space-y-1">
                      <strong className="text-foreground flex items-center gap-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        One-Click Cloning
                      </strong>
                      <p className="text-muted-foreground text-[10.5px]">
                        Other players can copy the entire deck structure and card selections directly into their browser with a single button click.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="banner" className="flex-1 flex flex-col gap-3 mt-0">
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
              </TabsContent>

              <TabsContent value="decklist" className="flex-1 flex flex-col gap-3 mt-0">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block select-none">
                    Poster Live Preview (1200 x 1500)
                  </span>
                  
                  {/* Canvas scroll viewport wrapper */}
                  <div className="relative w-full max-h-[350px] overflow-y-auto rounded-xl border border-border shadow-2xl bg-neutral-950 flex flex-col items-center custom-scrollbar p-2">
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

                    {/* The actual pixel canvas, scaled for high-density display */}
                    <canvas
                      ref={decklistCanvasRef}
                      width={1200}
                      height={1500}
                      className="w-full max-w-[600px] h-auto object-contain rounded-lg select-none shadow-xl bg-card border border-border/50"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ── SECTION 2: CUSTOMIZE PRESETS ────────────────────── */}
              {activeTab !== 'link' && (
                <div className="space-y-3 select-none mt-1 animate-fade-in-up">
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
              )}

              {activeTab !== 'link' && <Separator className="my-1" />}

              {/* ── SECTION 3: ACTIONS ──────────────────────────────── */}
              {activeTab !== 'link' && (
                <div className="flex flex-col sm:flex-row items-center gap-3 animate-fade-in-up">
                  <Button
                    onClick={handleDownload}
                    disabled={isLoading}
                    className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/15 gap-2 h-11"
                  >
                    <Download className="w-4 h-4" />
                    {activeTab === 'banner' ? 'Download Promo Banner PNG' : 'Download Decklist Poster PNG'}
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
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy to Clipboard
                      </>
                    )}
                  </Button>
                </div>
              )}

            </div>
          </Tabs>
        )}

      </DialogContent>
    </Dialog>
  );
}
