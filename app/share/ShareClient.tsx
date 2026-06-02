/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Crown,
  Layers,
  Sparkles,
  Download,
  Zap,
  Mountain,
  Swords,
  Gem,
  BookOpen,
  HelpCircle,
  ShieldAlert,
  Loader2,
  AlertCircle,
  Check,
  LayoutGrid,
  List,
  ChevronUp,
  ChevronDown,
  ArrowLeft
} from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DeckProvider, useDeck, SavedDeck, DeckCard } from '@/lib/deck-store';
import { decompressDeck, fetchSharedDeckDetails } from '@/lib/share';
import { isGameChangerCard, getManaSymbolUrl, getFrontImageUrl } from '@/lib/scryfall';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CardMedia } from '@/components/CardMedia';

function SharePageLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-6 select-none">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-red-500/5 blur-3xl -z-10" />
      <div className="space-y-4 max-w-sm p-8 rounded-2xl bg-card/25 border border-border/40 backdrop-blur-xl shadow-2xl animate-fade-in-up">
        <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Reassembling Deck</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Retrieving exact card prints, art variants, and custom altered images directly from the Scryfall API...
        </p>
      </div>
    </div>
  );
}

function SharePageError({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-6 select-none">
      <div className="space-y-4 max-w-md p-8 rounded-2xl bg-card/25 border border-destructive/20 backdrop-blur-xl shadow-2xl text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Failed to Load Deck</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
        <Button onClick={() => router.push('/')} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <ArrowLeft className="w-4 h-4" /> Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

// Mana Symbol Display Helper
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
    <div className="flex items-center gap-0.5 select-none">
      {symbols.slice(0, 8).map((s, i) => {
        const colorKey = s.toUpperCase();
        const colorClass = MANA_COLORS[colorKey];
        return (
          <span
            key={i}
            className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8.5px] font-extrabold border border-black/20 ${
              colorClass ?? 'bg-neutral-700 text-white'
            }`}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

// Format oracle text symbol icons
function formatOracleText(text?: string) {
  if (!text) return null;
  const parts = text.split(/({[^{}]+})/g);
  return parts.map((part, index) => {
    if (part.startsWith('{') && part.endsWith('}')) {
      const symbol = part.slice(1, -1);
      const url = getManaSymbolUrl(symbol);
      return (
        <img
          key={index}
          src={url}
          alt={part}
          className="inline-block w-3.5 h-3.5 align-text-bottom mx-0.5 select-none"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function CardOracleText({ cardData }: { cardData: any }) {
  if (!cardData) return null;

  if (cardData.card_faces && cardData.card_faces.length > 0) {
    return (
      <div className="space-y-2 text-left pl-1">
        {cardData.card_faces.map((face: any, idx: number) => (
          <div key={idx} className="border-l border-primary/30 pl-2 py-0.5">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[10px] font-bold text-foreground truncate max-w-[130px]">
                {face.name}
              </span>
              {face.mana_cost && <ManaCost cost={face.mana_cost} />}
            </div>
            {face.type_line && (
              <div className="text-[8px] text-muted-foreground font-semibold italic truncate mb-1">
                {face.type_line}
              </div>
            )}
            {face.oracle_text && face.oracle_text.split('\n').map((para: string, pIdx: number) => (
              <p key={pIdx} className="text-[9.5px] text-foreground/80 leading-normal mb-1 font-sans break-words">
                {formatOracleText(para)}
              </p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-left pl-1">
      {cardData.type_line && (
        <div className="text-[8px] text-muted-foreground font-semibold italic mb-1.5 flex items-center justify-between gap-1 border-b border-border/10 pb-0.5">
          <span className="truncate max-w-[130px]">{cardData.type_line}</span>
          {cardData.mana_cost && <ManaCost cost={cardData.mana_cost} />}
        </div>
      )}
      {cardData.oracle_text && cardData.oracle_text.split('\n').map((para: string, pIdx: number) => (
        <p key={pIdx} className="text-[9.5px] text-foreground/80 leading-normal mb-1 font-sans break-words">
          {formatOracleText(para)}
        </p>
      ))}
    </div>
  );
}

// Category lists with icons
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

// Main share page inner content
function SharePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dispatch, customCards } = useDeck();
  
  const [deck, setDeck] = useState<SavedDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'text'>('text');
  const [hoveredCard, setHoveredCard] = useState<DeckCard | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Commander: true,
    Creature: true,
    Planeswalker: true,
    Battle: true,
    Instant: true,
    Sorcery: true,
    Enchantment: true,
    Artifact: true,
    Land: true,
    Other: true,
  });

  const [isCloning, setIsCloning] = useState(false);
  const [isCloned, setIsCloned] = useState(false);

  const payloadStr = searchParams.get('d');

  useEffect(() => {
    if (!payloadStr) {
      setErrorMsg('No deck sharing data found in the URL. Please verify the link.');
      setLoading(false);
      return;
    }

    const payload = decompressDeck(payloadStr);
    if (!payload) {
      setErrorMsg('The deck share link appears to be corrupted or invalid.');
      setLoading(false);
      return;
    }

    // Set page title dynamically
    if (typeof document !== 'undefined') {
      document.title = `${payload.n} | Shared Commander Deck`;
    }

    setLoading(true);
    fetchSharedDeckDetails(payload)
      .then((resolvedDeck) => {
        setDeck(resolvedDeck);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading shared deck:', err);
        setErrorMsg('Scryfall API bulk collection query failed. Please try again.');
        setLoading(false);
      });
  }, [payloadStr]);

  if (loading) return <SharePageLoading />;
  if (errorMsg || !deck) return <SharePageError message={errorMsg} />;

  const commanderCard = deck.cards.find((c) => c.isCommander) || null;
  const totalCards = deck.cards.reduce((sum, c) => sum + c.quantity, 0);

  // Stats Breakdown
  const nonLandCards = deck.cards.filter((c) => !c.scryfallData.type_line?.toLowerCase().includes('land'));
  const nonLandCount = nonLandCards.reduce((sum, c) => sum + c.quantity, 0);
  const totalCMC = nonLandCards.reduce((sum, c) => sum + (c.scryfallData.cmc || 0) * c.quantity, 0);
  const averageCMC = nonLandCount > 0 ? (totalCMC / nonLandCount).toFixed(2) : '0.00';

  const landsCount = deck.cards.filter(c => c.category === 'Land').reduce((sum, c) => sum + c.quantity, 0);
  const spellsCount = totalCards - landsCount;

  let gameChangerCount = 0;
  for (const card of deck.cards) {
    if (isGameChangerCard(card.name)) {
      gameChangerCount += card.quantity;
    }
  }

  // Get banner cover art
  let bannerArt = 'https://i.pinimg.com/736x/7e/be/a3/7ebea35ad91c8ee201b0647a7c0d816b.jpg';
  if (deck.coverCardId) {
    const coverCard = deck.cards.find((c) => c.scryfallId === deck.coverCardId);
    if (coverCard?.scryfallData) {
      bannerArt = coverCard.scryfallData.image_uris?.art_crop || coverCard.scryfallData.card_faces?.[0]?.image_uris?.art_crop || bannerArt;
    }
  } else if (commanderCard?.scryfallData) {
    bannerArt = commanderCard.scryfallData.image_uris?.art_crop || commanderCard.scryfallData.card_faces?.[0]?.image_uris?.art_crop || bannerArt;
  }

  // Sort and group cards by category
  const categoriesList: Record<string, DeckCard[]> = {
    Commander: deck.cards.filter((c) => c.isCommander),
    Creature: deck.cards.filter((c) => !c.isCommander && c.category === 'Creature'),
    Planeswalker: deck.cards.filter((c) => !c.isCommander && c.category === 'Planeswalker'),
    Battle: deck.cards.filter((c) => !c.isCommander && c.category === 'Battle'),
    Instant: deck.cards.filter((c) => !c.isCommander && c.category === 'Instant'),
    Sorcery: deck.cards.filter((c) => !c.isCommander && c.category === 'Sorcery'),
    Enchantment: deck.cards.filter((c) => !c.isCommander && c.category === 'Enchantment'),
    Artifact: deck.cards.filter((c) => !c.isCommander && c.category === 'Artifact'),
    Land: deck.cards.filter((c) => !c.isCommander && c.category === 'Land'),
    Other: deck.cards.filter((c) => !c.isCommander && c.category === 'Other'),
  };

  const activeCategories = Object.keys(categoriesList).filter((cat) => categoriesList[cat].length > 0);

  // Clone Deck Local Storage Trigger
  const handleCloneDeck = async () => {
    setIsCloning(true);
    try {
      const newDeckId = `deck-${Date.now()}`;
      
      // 1. Dispatch deck creation
      dispatch({ type: 'CREATE_DECK', name: deck.deckName, id: newDeckId });

      // 2. Dispatch Bulk Add Cards
      const cardsToAdd = deck.cards.map((c) => ({
        card: c.scryfallData,
        quantity: c.quantity,
        isCommander: c.isCommander,
      }));
      dispatch({ type: 'BULK_ADD_CARDS', cards: cardsToAdd, deckId: newDeckId });

      // 3. Set metadata
      dispatch({ type: 'SET_DECK_TAGS', tags: deck.tags || [], deckId: newDeckId });
      if (deck.coverCardId) {
        dispatch({ type: 'SET_COVER_CARD', scryfallId: deck.coverCardId, deckId: newDeckId });
      }
      if (deck.customCardbackUrl) {
        dispatch({ type: 'SET_CUSTOM_CARDBACK', url: deck.customCardbackUrl, deckId: newDeckId });
      }
      if (deck.wins || deck.losses) {
        dispatch({ type: 'UPDATE_DECK_STATS', wins: deck.wins || 0, losses: deck.losses || 0, deckId: newDeckId });
      }

      // 4. Auto-register alters to their global Alters list if they don't have them
      deck.cards.forEach((card) => {
        const url = card.scryfallData.image_uris?.normal || '';
        if (url && !url.includes('scryfall.io') && !url.includes('scryfall.com')) {
          const alreadyHas = customCards && customCards.some((cc) => cc.imageUrl === url);
          if (!alreadyHas) {
            dispatch({
              type: 'ADD_CUSTOM_CARD',
              name: card.name.includes('Alter') ? card.name : `${card.name} Alter`,
              imageUrl: url,
              associatedScryfallId: card.scryfallId,
              associatedName: card.scryfallData.name !== card.name ? card.scryfallData.name : card.name,
            });
          }
        }
      });

      // 5. Open it locally
      dispatch({ type: 'OPEN_DECK', deckId: newDeckId });
      
      setIsCloned(true);
      setTimeout(() => {
        router.push('/');
      }, 1200);
    } catch (err) {
      console.error('Cloning failed:', err);
      alert('Error cloning deck. Please try again.');
    } finally {
      setIsCloning(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };
  return (
    <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
      {/* Top Banner Header controls */}
      <header className="border-b border-border glass-panel sticky top-0 z-40 bg-background/80 backdrop-blur-md shrink-0">
        <div className="max-w-[1850px] w-full mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="gap-1 px-2.5 h-9 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/40 shrink-0"
              title="Go to Decks Manager"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Dashboard</span>
            </Button>
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 shrink-0">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-extrabold text-gradient-red leading-none truncate uppercase tracking-wider">
                MTG TTS Showroom
              </h1>
              <p className="text-[10px] text-muted-foreground">Interactive Deck View</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Glowing Import Button */}
            <Button
              onClick={handleCloneDeck}
              disabled={isCloning || isCloned}
              className={`gap-2 h-9 font-bold px-4 shadow-lg text-xs transition-all shrink-0 active:scale-95 ${
                isCloned
                  ? 'bg-green-500 hover:bg-green-500 text-white border border-green-500 shadow-green-500/10'
                  : 'bg-primary hover:bg-primary/95 text-primary-foreground shadow-primary/20 animate-pulse hover:animate-none'
              }`}
            >
              {isCloned ? (
                <>
                  <Check className="w-4 h-4" />
                  Imported! Opening...
                </>
              ) : isCloning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Clone & Edit Deck
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main body with stats sidebar & scrollable lists */}
      <div className="flex-1 flex overflow-hidden w-full max-w-full px-2 sm:px-4 max-h-full">
        {/* Left Side: Stats Breakdown Panel */}
        <aside className="hidden lg:flex w-68 shrink-0 flex-col border-r border-border overflow-hidden bg-secondary/5">
          <div className="px-4.5 pt-4 pb-2 shrink-0">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Shared Deck Analytics
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4.5 space-y-5">
            {/* Core Stats Badges */}
            <div className="grid grid-cols-1 gap-3.5">
              <div className="rounded-xl border border-border/60 bg-card/25 p-3.5 space-y-1 select-none">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Average CMC</span>
                <p className="text-3xl font-extrabold text-primary font-mono leading-none">{averageCMC}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/25 p-3.5 space-y-1 select-none">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Game Changers</span>
                <p className="text-3xl font-extrabold text-foreground font-mono leading-none">{gameChangerCount}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/25 p-3.5 space-y-1 select-none">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Deck Composition</span>
                <p className="text-sm font-bold text-foreground font-mono leading-tight">{spellsCount} Spells / {landsCount} Lands</p>
              </div>
              {deck.wins !== undefined && deck.losses !== undefined && (deck.wins + deck.losses > 0) && (
                <div className="rounded-xl border border-border/60 bg-card/25 p-3.5 space-y-1 select-none">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Win/Loss Record</span>
                  <p className="text-lg font-bold text-yellow-400 font-mono leading-none">
                    {deck.wins}W - {deck.losses}L ({Math.round((deck.wins / (deck.wins + deck.losses)) * 100)}% WR)
                  </p>
                </div>
              )}
            </div>

            <Separator className="border-border/40" />

            {/* Custom alterations count */}
            {deck.cards.some((c) => {
              const url = c.scryfallData.image_uris?.normal || '';
              return url && !url.includes('scryfall.io') && !url.includes('scryfall.com');
            }) && (
              <div className="bg-primary/5 rounded-xl border border-primary/25 p-4 flex flex-col gap-2 select-none">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                  <span>Custom Alters Included</span>
                </div>
                <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                  This deck features custom alterations and card designs that are beautifully bundled inside the share link. Cloning the deck will automatically copy these alters directly to your dashboard!
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Center/Right Main scrollable viewport */}
        <main className="flex-1 flex flex-col overflow-hidden max-h-full h-full">
          {/* Panoramic Hero Banner */}
          <div className="relative w-full h-44 shrink-0 border-b border-border flex flex-col justify-end p-6 select-none overflow-hidden group shrink-0">
            {/* Background art illustration crop */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 scale-105 group-hover:scale-[1.07]"
              style={{ backgroundImage: `url(${bannerArt})` }}
            />
            {/* High-end gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-black/35" />
            <div className="absolute inset-0 bg-black/15" />

            {/* Content */}
            <div className="relative z-10 space-y-1.5 max-w-full">
              <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate max-w-full">
                {deck.deckName}
              </h2>

              {commanderCard && (
                <div className="flex items-center gap-1.5 text-xs text-white/90 font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  <Crown className="w-3.5 h-3.5 text-primary shrink-0 animate-pulse" />
                  <span>
                    Led by <strong className="text-white">{commanderCard.name}</strong>
                  </span>
                </div>
              )}

              {/* Tag capsules */}
              {deck.tags && deck.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 select-none animate-fade-in-up">
                  {deck.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="bg-primary/15 border-primary/30 text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sub-Banner Switcher Toolbar */}
          <div className="border-b border-border bg-secondary/15 py-2 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                View Mode:
              </span>
              <div className="flex items-center gap-0.5 bg-secondary/80 p-0.5 rounded-lg border border-border/60 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('text')}
                  className={`h-7 px-3 text-[10px] font-bold rounded gap-1.5 transition-all ${
                    viewMode === 'text'
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                  }`}
                  title="Compact List View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>List View</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`h-7 px-3 text-[10px] font-bold rounded gap-1.5 transition-all ${
                    viewMode === 'grid'
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                  }`}
                  title="Visual Card Grid"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Visual Grid</span>
                </Button>
              </div>
            </div>

            <div className="text-[10px] font-semibold text-muted-foreground font-mono hidden sm:block">
              {totalCards} Cards • {spellsCount} Spells / {landsCount} Lands
            </div>
          </div>

          {/* Cards List Display Section */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 max-h-full">
            <div className="max-w-[1850px] w-full mx-auto pb-10">
              
              <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-start max-w-full animate-fade-in-up">
                
                {/* Unified Sticky Card Previewer (Left Side) */}
                <div className="hidden lg:flex w-[360px] shrink-0 sticky top-4 flex-col items-center gap-3 bg-secondary/15 border border-border/40 rounded-2xl p-4 select-none h-fit shadow-xl backdrop-blur-md animate-fade-in-up">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                    {hoveredCard ? 'Card Preview' : 'Commander View'}
                  </span>
                  
                  {/* High-Resolution card preview */}
                  <div className="relative w-[270px] aspect-[5/7] rounded-xl overflow-hidden border border-border shadow-2xl bg-neutral-950 flex items-center justify-center">
                    <CardMedia
                      src={
                        hoveredCard 
                          ? getFrontImageUrl(hoveredCard.scryfallData) 
                          : commanderCard 
                          ? getFrontImageUrl(commanderCard.scryfallData) 
                          : 'https://i.imgur.com/Hg8CwwU.jpeg'
                      }
                      alt={hoveredCard ? hoveredCard.name : commanderCard ? commanderCard.name : 'Cardback'}
                      className="w-full h-full object-cover absolute inset-0 select-none"
                    />
                    {(hoveredCard?.isCommander || (!hoveredCard && commanderCard)) && (
                      <div className="absolute top-2 left-2 bg-black/85 p-0.5 rounded border border-primary/45 z-10 flex items-center justify-center shadow">
                        <Crown className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Metadata text below */}
                  <div className="text-center w-full mt-1.5 space-y-1.5">
                    <h4 className="text-sm font-bold text-foreground truncate px-1">
                      {hoveredCard ? hoveredCard.name : commanderCard ? commanderCard.name : 'No Commander'}
                    </h4>
                    <p className="text-[10px] text-muted-foreground truncate uppercase font-semibold italic">
                      {hoveredCard 
                        ? hoveredCard.scryfallData.type_line?.split('—')[0]?.trim() 
                        : commanderCard 
                        ? commanderCard.scryfallData.type_line?.split('—')[0]?.trim() 
                        : 'Commander Card'}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-1 pt-1">
                      {(() => {
                        const activeCard = hoveredCard || commanderCard;
                        if (!activeCard) return null;
                        const isGc = isGameChangerCard(activeCard.name);
                        const isBanned = activeCard.scryfallData.legalities?.commander === 'banned';
                        const url = activeCard.scryfallData.image_uris?.normal || '';
                        const hasAlter = url && !url.includes('scryfall.io') && !url.includes('scryfall.com');

                        return (
                          <>
                            {isBanned && (
                              <Badge variant="outline" className="text-[8px] font-bold text-red-500 bg-red-500/10 px-2 py-0 border-red-500/15">
                                Banned
                              </Badge>
                            )}
                            {isGc && (
                              <Badge variant="outline" className="text-[8px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0 border-amber-500/15">
                                Game Changer
                              </Badge>
                            )}
                            {hasAlter && (
                              <Badge variant="outline" className="text-[8px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0 border-blue-500/15">
                                Alter
                              </Badge>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right Side Cards Area */}
                <div className="flex-1 min-w-0">
                  {/* 1. VISUAL GRID VIEW */}
                  {viewMode === 'grid' && (
                    <div className="space-y-6">
                      {activeCategories.map((category) => {
                        const cards = categoriesList[category];
                        const totalQty = cards.reduce((sum, c) => sum + c.quantity, 0);
                        const IconComponent = CATEGORY_ICONS[category] || HelpCircle;
                        const isExpanded = expandedCategories[category] !== false;

                        return (
                          <div key={category} className="bg-secondary/5 border border-border/45 rounded-xl p-3.5 shadow-sm transition-all duration-300">
                            {/* Category Title bar */}
                            <button
                              onClick={() => toggleCategory(category)}
                              className="w-full flex items-center justify-between text-xs font-extrabold text-foreground hover:text-primary transition-colors uppercase tracking-wider select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <IconComponent className="w-4 h-4 text-purple-400 shrink-0" />
                                <span>
                                  {category === 'Commander' ? 'COMMANDER' : category === 'Creature' ? 'CREATURE' : category === 'Artifact' ? 'ARTIFACT' : category === 'Enchantment' ? 'ENCHANTMENT' : category === 'Instant' ? 'INSTANT' : category === 'Sorcery' ? 'SORCERY' : category === 'Land' ? 'LAND' : category === 'Planeswalker' ? 'PLANESWALKER' : category === 'Battle' ? 'BATTLE' : 'OTHER'}
                                  {' '}({totalQty})
                                </span>
                              </div>
                              <Badge variant="outline" className="text-[10px] font-mono border-border shrink-0 gap-1.5 flex items-center">
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Badge>
                            </button>

                            {isExpanded && (
                              <div className="mt-3.5">
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3 justify-items-center">
                                  {cards.map((card) => {
                                    const cardImg = getFrontImageUrl(card.scryfallData);
                                    const isGc = isGameChangerCard(card.name);
                                    const isBanned = card.scryfallData.legalities?.commander === 'banned';
                                    const url = card.scryfallData.image_uris?.normal || '';
                                    const hasAlter = url && !url.includes('scryfall.io') && !url.includes('scryfall.com');

                                    return (
                                      <div
                                        key={card.scryfallId}
                                        onMouseEnter={() => setHoveredCard(card)}
                                        onMouseLeave={() => setHoveredCard(null)}
                                        className="relative w-[140px] sm:w-[190px] aspect-[5/7] rounded-xl overflow-hidden border border-border/80 shadow-md bg-secondary group/visual transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl cursor-pointer"
                                      >
                                        {cardImg ? (
                                          <CardMedia
                                            src={cardImg}
                                            alt={card.name}
                                            className="w-full h-full object-cover absolute inset-0 select-none"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="w-full h-full bg-muted p-3 flex flex-col justify-between items-center text-center">
                                            <span className="text-[10px] font-bold text-foreground truncate w-full">{card.name}</span>
                                          </div>
                                        )}

                                        {isBanned && (
                                          <div className="absolute top-1.5 left-1.5 bg-red-950/95 px-1.5 py-0.5 rounded border border-red-500/40 z-10 flex items-center justify-center gap-1 shadow shadow-black/80 animate-pulse">
                                            <ShieldAlert className="w-2.5 h-2.5 text-red-500 shrink-0" />
                                            <span className="text-[8px] font-bold text-red-400 uppercase tracking-wider font-mono">Banned</span>
                                          </div>
                                        )}

                                        {card.isCommander && !isBanned && (
                                          <div className="absolute top-1.5 left-1.5 bg-black/85 p-0.5 rounded border border-primary/45 z-10 flex items-center justify-center shadow shadow-black/80">
                                            <Crown className="w-3.5 h-3.5 text-primary" />
                                          </div>
                                        )}

                                        {hasAlter && !card.isCommander && !isBanned && (
                                          <div className="absolute top-1.5 left-1.5 bg-black/85 p-0.5 rounded border border-primary/45 z-10 flex items-center justify-center shadow shadow-black/80">
                                            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                                          </div>
                                        )}

                                        <div className="absolute top-1.5 right-1.5 bg-black/85 p-0.5 px-2 rounded border border-border/40 z-10 text-[9px] font-mono font-bold shadow shadow-black/80">
                                          {card.quantity}x
                                        </div>

                                        {/* Glassmorphic Description Overlay */}
                                        <div className="absolute inset-0 bg-black/90 border border-primary/30 opacity-0 group-hover/visual:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2.5 z-10 text-center select-text">
                                          <div className="flex flex-col w-full border-b border-border/20 pb-1">
                                            <span className={`text-[11px] sm:text-xs font-bold leading-tight truncate px-0.5 ${isBanned ? 'text-red-400 line-through' : 'text-foreground'}`}>
                                              {card.name}
                                            </span>
                                            {isBanned && (
                                              <span className="text-[7.5px] text-red-500 font-extrabold uppercase tracking-wide bg-red-500/10 py-0.5 rounded border border-red-500/15 mt-0.5 select-none">
                                                Banned in Commander
                                              </span>
                                            )}
                                            {isGc && !isBanned && (
                                              <span className="text-[7.5px] text-amber-500 font-extrabold uppercase tracking-wide bg-amber-500/10 py-0.5 rounded border border-amber-500/15 mt-0.5 select-none">
                                                High Impact / Game Changer
                                              </span>
                                            )}
                                            {hasAlter && !isBanned && (
                                              <span className="text-[7.5px] text-blue-400 font-extrabold uppercase tracking-wide bg-blue-500/10 py-0.5 rounded border border-blue-500/15 mt-0.5 select-none">
                                                Custom Card Alter Art
                                              </span>
                                            )}
                                          </div>

                                          {/* Oracle Text */}
                                          <div className="flex-1 overflow-y-auto my-1.5 pr-0.5 text-left scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                                            <CardOracleText cardData={card.scryfallData} />
                                          </div>

                                          <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider select-none">
                                            {card.scryfallData.set?.toUpperCase()} • {card.scryfallData.rarity}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. TEXT LIST VIEW (Moxfield Split-Layout) */}
                  {viewMode === 'text' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
                      {/* Column 1: Commander, Planeswalker, Creature */}
                      <div className="space-y-6">
                        {['Commander', 'Planeswalker', 'Creature'].map((category) => {
                          const cards = categoriesList[category] || [];
                          if (cards.length === 0) return null;
                          const totalQty = cards.reduce((sum, c) => sum + c.quantity, 0);
                          const IconComponent = CATEGORY_ICONS[category] || HelpCircle;

                          return (
                            <div key={category} className="bg-secondary/5 border border-border/45 rounded-xl p-3.5 shadow-sm h-fit">
                              {/* Category Header */}
                              <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-border/20 text-xs font-extrabold text-foreground uppercase tracking-wider select-none">
                                <IconComponent className="w-4 h-4 text-purple-400 shrink-0" />
                                <span>{category === 'Commander' ? 'COMMANDER' : category === 'Creature' ? 'CREATURE' : category === 'Artifact' ? 'ARTIFACT' : category === 'Enchantment' ? 'ENCHANTMENT' : category === 'Instant' ? 'INSTANT' : category === 'Sorcery' ? 'SORCERY' : category === 'Land' ? 'LAND' : category === 'Planeswalker' ? 'PLANESWALKER' : category === 'Battle' ? 'BATTLE' : 'OTHER'} ({totalQty})</span>
                              </div>

                              {/* List Cards in category */}
                              <div className="divide-y divide-border/10 select-text">
                                {cards.map((card) => {
                                  const isGc = isGameChangerCard(card.name);
                                  const isBanned = card.scryfallData.legalities?.commander === 'banned';
                                  const url = card.scryfallData.image_uris?.normal || '';
                                  const hasAlter = url && !url.includes('scryfall.io') && !url.includes('scryfall.com');
                                  const symbols = (card.scryfallData.mana_cost || '').replace(/[{}]/g, ' ').trim().split(/\s+/).filter(Boolean);

                                  return (
                                    <div
                                      key={card.scryfallId}
                                      onMouseEnter={() => setHoveredCard(card)}
                                      onMouseLeave={() => setHoveredCard(null)}
                                      className="flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-secondary/40 transition-colors text-xs cursor-pointer group/row animate-fade-in-up"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="font-mono font-bold text-neutral-400 w-5 shrink-0 text-left">
                                          {card.quantity}
                                        </span>
                                        <span className={`font-semibold truncate group-hover/row:text-primary transition-colors ${isBanned ? 'text-red-400 line-through' : 'text-foreground'}`}>
                                          {card.name}
                                        </span>
                                        
                                        {/* Small indicator badges */}
                                        <div className="flex items-center gap-0.5 shrink-0 select-none">
                                          {isBanned && (
                                            <span className="text-[7.5px] font-extrabold text-red-500 bg-red-500/10 px-1 py-0 rounded border border-red-500/15" title="Banned">
                                              B
                                            </span>
                                          )}
                                          {isGc && (
                                            <span className="text-[7.5px] font-extrabold text-amber-500 bg-amber-500/10 px-1 py-0 rounded border border-amber-500/15" title="Game Changer">
                                              G
                                            </span>
                                          )}
                                          {hasAlter && (
                                            <span className="text-[7.5px] font-extrabold text-blue-400 bg-blue-500/10 px-1 py-0 rounded border border-blue-500/15" title="Custom Alter">
                                              A
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right side: mana cost symbols */}
                                      <div className="flex items-center gap-2 shrink-0 pl-1.5 select-none">
                                        {symbols.length > 0 && (
                                          <div className="flex items-center gap-0.5">
                                            {symbols.slice(0, 5).map((s, i) => (
                                              <img
                                                key={i}
                                                src={getManaSymbolUrl(s)}
                                                alt={s}
                                                className="w-3.5 h-3.5 pointer-events-none"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Column 2: Sorcery, Instant, Artifact */}
                      <div className="space-y-6">
                        {['Sorcery', 'Instant', 'Artifact'].map((category) => {
                          const cards = categoriesList[category] || [];
                          if (cards.length === 0) return null;
                          const totalQty = cards.reduce((sum, c) => sum + c.quantity, 0);
                          const IconComponent = CATEGORY_ICONS[category] || HelpCircle;

                          return (
                            <div key={category} className="bg-secondary/5 border border-border/45 rounded-xl p-3.5 shadow-sm h-fit">
                              {/* Category Header */}
                              <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-border/20 text-xs font-extrabold text-foreground uppercase tracking-wider select-none">
                                <IconComponent className="w-4 h-4 text-purple-400 shrink-0" />
                                <span>{category === 'Commander' ? 'COMMANDER' : category === 'Creature' ? 'CREATURE' : category === 'Artifact' ? 'ARTIFACT' : category === 'Enchantment' ? 'ENCHANTMENT' : category === 'Instant' ? 'INSTANT' : category === 'Sorcery' ? 'SORCERY' : category === 'Land' ? 'LAND' : category === 'Planeswalker' ? 'PLANESWALKER' : category === 'Battle' ? 'BATTLE' : 'OTHER'} ({totalQty})</span>
                              </div>

                              {/* List Cards in category */}
                              <div className="divide-y divide-border/10 select-text">
                                {cards.map((card) => {
                                  const isGc = isGameChangerCard(card.name);
                                  const isBanned = card.scryfallData.legalities?.commander === 'banned';
                                  const url = card.scryfallData.image_uris?.normal || '';
                                  const hasAlter = url && !url.includes('scryfall.io') && !url.includes('scryfall.com');
                                  const symbols = (card.scryfallData.mana_cost || '').replace(/[{}]/g, ' ').trim().split(/\s+/).filter(Boolean);

                                  return (
                                    <div
                                      key={card.scryfallId}
                                      onMouseEnter={() => setHoveredCard(card)}
                                      onMouseLeave={() => setHoveredCard(null)}
                                      className="flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-secondary/40 transition-colors text-xs cursor-pointer group/row animate-fade-in-up"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="font-mono font-bold text-neutral-400 w-5 shrink-0 text-left">
                                          {card.quantity}
                                        </span>
                                        <span className={`font-semibold truncate group-hover/row:text-primary transition-colors ${isBanned ? 'text-red-400 line-through' : 'text-foreground'}`}>
                                          {card.name}
                                        </span>
                                        
                                        {/* Small indicator badges */}
                                        <div className="flex items-center gap-0.5 shrink-0 select-none">
                                          {isBanned && (
                                            <span className="text-[7.5px] font-extrabold text-red-500 bg-red-500/10 px-1 py-0 rounded border border-red-500/15" title="Banned">
                                              B
                                            </span>
                                          )}
                                          {isGc && (
                                            <span className="text-[7.5px] font-extrabold text-amber-500 bg-amber-500/10 px-1 py-0 rounded border border-amber-500/15" title="Game Changer">
                                              G
                                            </span>
                                          )}
                                          {hasAlter && (
                                            <span className="text-[7.5px] font-extrabold text-blue-400 bg-blue-500/10 px-1 py-0 rounded border border-blue-500/15" title="Custom Alter">
                                              A
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right side: mana cost symbols */}
                                      <div className="flex items-center gap-2 shrink-0 pl-1.5 select-none">
                                        {symbols.length > 0 && (
                                          <div className="flex items-center gap-0.5">
                                            {symbols.slice(0, 5).map((s, i) => (
                                              <img
                                                key={i}
                                                src={getManaSymbolUrl(s)}
                                                alt={s}
                                                className="w-3.5 h-3.5 pointer-events-none"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Column 3: Enchantment, Land, Battle, Other */}
                      <div className="space-y-6">
                        {['Enchantment', 'Land', 'Battle', 'Other'].map((category) => {
                          const cards = categoriesList[category] || [];
                          if (cards.length === 0) return null;
                          const totalQty = cards.reduce((sum, c) => sum + c.quantity, 0);
                          const IconComponent = CATEGORY_ICONS[category] || HelpCircle;

                          return (
                            <div key={category} className="bg-secondary/5 border border-border/45 rounded-xl p-3.5 shadow-sm h-fit">
                              {/* Category Header */}
                              <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-border/20 text-xs font-extrabold text-foreground uppercase tracking-wider select-none">
                                <IconComponent className="w-4 h-4 text-purple-400 shrink-0" />
                                <span>{category === 'Commander' ? 'COMMANDER' : category === 'Creature' ? 'CREATURE' : category === 'Artifact' ? 'ARTIFACT' : category === 'Enchantment' ? 'ENCHANTMENT' : category === 'Instant' ? 'INSTANT' : category === 'Sorcery' ? 'SORCERY' : category === 'Land' ? 'LAND' : category === 'Planeswalker' ? 'PLANESWALKER' : category === 'Battle' ? 'BATTLE' : 'OTHER'} ({totalQty})</span>
                              </div>

                              {/* List Cards in category */}
                              <div className="divide-y divide-border/10 select-text">
                                {cards.map((card) => {
                                  const isGc = isGameChangerCard(card.name);
                                  const isBanned = card.scryfallData.legalities?.commander === 'banned';
                                  const url = card.scryfallData.image_uris?.normal || '';
                                  const hasAlter = url && !url.includes('scryfall.io') && !url.includes('scryfall.com');
                                  const symbols = (card.scryfallData.mana_cost || '').replace(/[{}]/g, ' ').trim().split(/\s+/).filter(Boolean);

                                  return (
                                    <div
                                      key={card.scryfallId}
                                      onMouseEnter={() => setHoveredCard(card)}
                                      onMouseLeave={() => setHoveredCard(null)}
                                      className="flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-secondary/40 transition-colors text-xs cursor-pointer group/row animate-fade-in-up"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="font-mono font-bold text-neutral-400 w-5 shrink-0 text-left">
                                          {card.quantity}
                                        </span>
                                        <span className={`font-semibold truncate group-hover/row:text-primary transition-colors ${isBanned ? 'text-red-400 line-through' : 'text-foreground'}`}>
                                          {card.name}
                                        </span>
                                        
                                        {/* Small indicator badges */}
                                        <div className="flex items-center gap-0.5 shrink-0 select-none">
                                          {isBanned && (
                                            <span className="text-[7.5px] font-extrabold text-red-500 bg-red-500/10 px-1 py-0 rounded border border-red-500/15" title="Banned">
                                              B
                                            </span>
                                          )}
                                          {isGc && (
                                            <span className="text-[7.5px] font-extrabold text-amber-500 bg-amber-500/10 px-1 py-0 rounded border border-amber-500/15" title="Game Changer">
                                              G
                                            </span>
                                          )}
                                          {hasAlter && (
                                            <span className="text-[7.5px] font-extrabold text-blue-400 bg-blue-500/10 px-1 py-0 rounded border border-blue-500/15" title="Custom Alter">
                                              A
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right side: mana cost symbols */}
                                      <div className="flex items-center gap-2 shrink-0 pl-1.5 select-none">
                                        {symbols.length > 0 && (
                                          <div className="flex items-center gap-0.5">
                                            {symbols.slice(0, 5).map((s, i) => (
                                              <img
                                                key={i}
                                                src={getManaSymbolUrl(s)}
                                                alt={s}
                                                className="w-3.5 h-3.5 pointer-events-none"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Default export — wraps inside Providers to enable useDeck() and Tooltips
export default function ShareClient() {
  return (
    <TooltipProvider>
      <DeckProvider>
        <Suspense fallback={<SharePageLoading />}>
          <SharePageContent />
        </Suspense>
      </DeckProvider>
    </TooltipProvider>
  );
}
