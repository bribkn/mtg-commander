"use client";

import React, { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Pencil, 
  Columns, 
  Copy, 
  Share2, 
  Trash2, 
  Crown, 
  ShieldAlert,
  Loader2,
  FolderOpen,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeck, SavedDeck } from "@/lib/deck-store";
import { getFrontImageUrl, MTG_CARD_BACK, isGameChangerCard } from "@/lib/scryfall";
import { CardMedia } from "@/components/CardMedia";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DeckShowcase3DProps {
  onOpenSplit: (deckId: string) => void;
  onShareOpen: (deckId: string) => void;
  onImportOpen?: (deckId?: string) => void;
}

export function DeckShowcase3D({ onOpenSplit, onShareOpen, onImportOpen }: DeckShowcase3DProps) {
  const { 
    decks, 
    dispatch, 
    storagePreference, 
    setStoragePreference, 
    storageLoading, 
    isFolderAuthorized, 
    requestFolderPermission 
  } = useDeck();

  const [activeIndex, setActiveIndex] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDeckSource, setCreateDeckSource] = useState<string>("new");

  // Sync active index if deck list size changes
  useEffect(() => {
    if (activeIndex >= decks.length && decks.length > 0) {
      setActiveIndex(decks.length - 1);
    }
  }, [decks.length, activeIndex]);

  // Window resize handler to determine mobile vs desktop scaling
  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper to extract banner art for background
  function getDeckArt(deck: SavedDeck): string {
    if (deck.coverCardId) {
      const cover = deck.cards.find((c) => c.scryfallId === deck.coverCardId);
      if (cover?.scryfallData) {
        const data = cover.scryfallData;
        const id = cover.scryfallId;
        const art = data.image_uris?.art_crop || data.card_faces?.[0]?.image_uris?.art_crop || data.image_uris?.normal || "";
        if (
          art.endsWith(".webm") ||
          art.includes(".webm") ||
          art.includes("catbox.moe") ||
          art.includes("pixeldrain.com") ||
          art.includes("ufs.sh") ||
          art.includes("utfs.io")
        ) {
          return `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
        }
        if (art) return art;
      }
    }

    const commander = deck.cards.find((c) => c.isCommander);
    if (commander?.scryfallData) {
      const data = commander.scryfallData;
      const id = commander.scryfallId;
      const art = data.image_uris?.art_crop || data.card_faces?.[0]?.image_uris?.art_crop || data.image_uris?.normal || "";
      if (
        art.endsWith(".webm") ||
        art.includes(".webm") ||
        art.includes("catbox.moe") ||
        art.includes("pixeldrain.com") ||
        art.includes("ufs.sh") ||
        art.includes("utfs.io")
      ) {
        return `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
      }
      if (art) return art;
    }
    return "https://i.pinimg.com/736x/7e/be/a3/7ebea35ad91c8ee201b0647a7c0d816b.jpg";
  }

  // Navigation handlers
  const handlePrev = () => {
    if (decks.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + decks.length) % decks.length);
    setDeletingId(null);
  };

  const handleNext = () => {
    if (decks.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % decks.length);
    setDeletingId(null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [decks.length]);

  if (storageLoading) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative w-16 h-20 rounded-lg border-2 border-primary/20 bg-card/40 flex items-center justify-center animate-pulse">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground tracking-wide">
          Loading Decks...
        </p>
      </div>
    );
  }

  if (storagePreference === "folder" && !isFolderAuthorized) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 px-4">
        <div className="w-full max-w-md bg-secondary/15 border border-border/60 rounded-2xl p-6 text-center flex flex-col items-center gap-5 shadow-xl shadow-black/40 animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary mb-1">
            <FolderOpen className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-foreground">Local Folder Access Suspended</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              For security, the browser requires you to confirm permissions to access your local files upon page reload. 
              Click below to reconnect your decks without having to re-select the folder.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
            <Button 
              onClick={async () => {
                setReconnecting(true);
                await requestFolderPermission();
                setReconnecting(false);
              }}
              disabled={reconnecting}
              className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {reconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4" />
              )}
              Reconnect Folder
            </Button>
            <Button
              variant="outline"
              onClick={() => setStoragePreference(null)}
              className="border-border hover:bg-secondary text-xs"
            >
              Change Destination
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center py-16 px-4">
        <div className="text-center py-16 border border-border/30 rounded-2xl bg-secondary/5 mt-8 max-w-md mx-auto flex flex-col items-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-foreground/80">You don't have any saved decks</h3>
          <p className="text-xs text-muted-foreground mt-1 px-4 mb-6">
            Create a new one to start designing your Commander deck and experience the 3D showcase.
          </p>
          <Button 
            onClick={() => dispatch({ type: "CREATE_DECK", id: `deck-${Date.now()}` })}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create First Deck
          </Button>
        </div>
      </div>
    );
  }

  const activeDeck = decks[activeIndex];
  const totalQty = activeDeck.cards.reduce((sum, c) => sum + c.quantity, 0);
  
  const wins = activeDeck.wins || 0;
  const losses = activeDeck.losses || 0;
  const totalGames = wins + losses;
  const winrate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  
  const gcCount = activeDeck.cards.filter((c) => isGameChangerCard(c.name)).reduce((sum, c) => sum + c.quantity, 0);
  const bannedCount = activeDeck.cards.filter((c) => c.scryfallData.legalities?.commander === "banned").reduce((sum, c) => sum + c.quantity, 0);

  const activeCommander = activeDeck.cards.find((c) => c.isCommander);
  const activeCommanderImg = activeCommander ? getFrontImageUrl(activeCommander.scryfallData) : null;
  const activeCardback = activeDeck.customCardbackUrl || MTG_CARD_BACK;

  // Helper to calculate dynamic radial gradient glow based on active commander's colors
  function getManaColorGlow(commander: any): string {
    if (!commander || !commander.scryfallData) {
      // Default warm red/gold glow
      return "radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 80%)";
    }

    const colors = commander.scryfallData.colors || commander.scryfallData.color_identity || [];

    if (colors.length === 0) {
      // Colorless: grey/silver glow
      return "radial-gradient(circle, rgba(148, 163, 184, 0.12) 0%, transparent 80%)";
    }

    // Map color symbols to nice semi-transparent RGBA glow colors
    const colorMap: Record<string, string> = {
      W: "rgba(254, 240, 138, 0.18)", // White -> Yellowish/Warm glow
      U: "rgba(59, 130, 246, 0.25)",  // Blue
      B: "rgba(168, 85, 247, 0.22)",  // Black -> Purple glow
      R: "rgba(239, 68, 68, 0.25)",   // Red
      G: "rgba(34, 197, 94, 0.22)",   // Green
    };

    if (colors.length === 1) {
      const color = colors[0];
      const rgba = colorMap[color] || "rgba(239, 68, 68, 0.15)";
      return `radial-gradient(circle, ${rgba} 0%, transparent 85%)`;
    }

    // Multicolor: Blend of colors
    const rgbList = colors.map((c: string) => colorMap[c]).filter(Boolean);
    if (rgbList.length === 0) {
      return "radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 80%)";
    }

    // Assemble radial gradient stops
    const stops = rgbList.map((rgba: string, idx: number) => {
      const percent = Math.round((idx / (rgbList.length - 1)) * 60);
      return `${rgba} ${percent}%,`;
    }).join(" ");

    return `radial-gradient(circle, ${stops} transparent 90%)`;
  }

  const activeDeckArt = getDeckArt(activeDeck);

  return (
    <div className="flex-1 w-full relative flex flex-col items-center justify-center pt-20 pb-8 min-h-[500px] overflow-hidden select-none">
      
      {/* Floating New Deck Button */}
      <Button
        onClick={() => setIsCreateModalOpen(true)}
        className="absolute top-4 left-4 z-40 sm:top-6 sm:left-6 md:left-8 gap-1.5 text-xs font-semibold px-4 h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 cursor-pointer transition-all duration-200"
      >
        <Plus className="w-4 h-4" />
        <span>New Deck</span>
      </Button>

      {/* ── IMMERSIVE BACKGROUND ── */}
      <div className="absolute inset-0 pointer-events-none select-none z-0">
        {/* Blurred dynamic active commander card face background */}
        <div 
          className="absolute inset-0 bg-cover bg-center scale-110 opacity-35 blur-[90px] brightness-[0.55] transition-all duration-700 ease-out"
          style={{ backgroundImage: `url(${activeCommanderImg || activeDeckArt})` }}
        />

        {/* Dynamic Mana Color Glow Gradient Layer */}
        <div 
          className="absolute inset-0 transition-all duration-700 ease-out opacity-80"
          style={{ backgroundImage: getManaColorGlow(activeCommander) }}
        />
        
        {/* Scattered deck cards background */}
        <div className="absolute inset-0 opacity-[0.08] blur-[2px] scale-105 flex flex-wrap gap-6 items-center justify-center p-8 transition-all duration-700">
          {decks.map((deck, idx) => {
            const art = getDeckArt(deck);
            return (
              <div 
                key={`bg-deck-${deck.id}-${idx}`}
                className="w-28 h-38 rounded-lg bg-cover bg-center shadow-xl border border-white/5 transition-transform duration-700"
                style={{ 
                  backgroundImage: `url(${art})`,
                  transform: `rotate(${(idx * 13) % 40 - 20}deg) translateY(${(idx * 7) % 20 - 10}px)`
                }}
              />
            );
          })}
        </div>
        
        {/* Radial vignette mask for depth and premium focus */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,var(--background)_85%)]" />
      </div>

      {/* ── 3D ROULETTE CAROUSEL AREA ── */}
      <div className="w-full max-w-6xl relative z-10 flex flex-col items-center">
        
        {/* Carousel Showcase Row */}
        <div className="w-full flex items-center justify-center gap-4 sm:gap-8 px-4 h-[380px] sm:h-[520px] relative">
          
          {/* Left Navigation Arrow */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            className="absolute left-2 sm:left-6 md:left-12 w-12 h-12 rounded-full border border-border/40 bg-black/50 backdrop-blur-md hover:bg-primary/20 hover:border-primary/50 text-foreground transition-all duration-200 shadow-md z-35 shrink-0"
            title="Previous"
          >
            <ChevronLeft className="w-7 h-7" />
          </Button>

          {/* 3D Container viewport */}
          <div className="flex-1 h-full flex items-center justify-center relative [perspective:1200px] [transform-style:preserve-3d] overflow-visible">
            {decks.map((deck, idx) => {
              // Calculate index difference in circular array
              let diff = idx - activeIndex;
              const half = Math.floor(decks.length / 2);
              if (diff > half) diff -= decks.length;
              if (diff < -half) diff += decks.length;

              const isCurrent = idx === activeIndex;
              
              // Only render items that are close to active to keep DOM clean and performance high
              const isVisible = Math.abs(diff) <= 2 || decks.length <= 5;
              if (!isVisible) return null;

              // Coverflow positioning variables
              const rotateY = diff * -30;
              const translateX = isMobile ? diff * 180 : diff * 320; // overlap offset
              const translateZ = -Math.abs(diff) * 180;
              const scale = 1 - Math.abs(diff) * 0.12;
              const opacity = isCurrent ? 1 : 0.65 - Math.abs(diff) * 0.15;
              const zIndex = 20 - Math.abs(diff);
              const commander = deck.cards.find((c) => c.isCommander);
              const commanderImg = commander ? getFrontImageUrl(commander.scryfallData) : null;
              const cardback = deck.customCardbackUrl || MTG_CARD_BACK;

              const boxStyle = {
                "--box-w": isMobile ? "150px" : "260px",
                "--box-h": isMobile ? "210px" : "364px",
                "--box-d": isMobile ? "30px" : "48px",
                "--box-half-w": isMobile ? "75px" : "130px",
                "--box-half-h": isMobile ? "105px" : "182px",
                "--box-half-d": isMobile ? "15px" : "24px",
                "--box-neg-half-d": isMobile ? "-15px" : "-24px",
                "--box-right-left": isMobile ? "135px" : "236px",
                "--box-left-left": isMobile ? "-15px" : "-24px",
                "--box-top-top": isMobile ? "-15px" : "-24px",
                "--box-bottom-top": isMobile ? "195px" : "340px",
              } as React.CSSProperties;

              return (
                <div
                  key={deck.id}
                  onClick={() => {
                    if (!isCurrent) {
                      setActiveIndex(idx);
                      setDeletingId(null);
                    }
                  }}
                  className={`absolute flex items-center justify-center select-none ${
                    isCurrent ? "cursor-default" : "cursor-pointer hover:opacity-95"
                  }`}
                  style={{
                    transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                    zIndex: zIndex,
                    transformStyle: "preserve-3d",
                    transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                    width: isMobile ? "150px" : "260px",
                    height: isMobile ? "210px" : "364px",
                  }}
                >
                  {/* 3D Box and Card Wrapper */}
                  <div 
                    className="relative w-full h-full" 
                    style={{ 
                      transformStyle: "preserve-3d",
                      ...boxStyle
                    }}
                  >
                    
                    {/* 1. Commander Card (slides out to the left when active) */}
                    <div 
                      className={`absolute inset-0 rounded-xl overflow-hidden border select-none`}
                      style={{
                        transformStyle: "preserve-3d",
                        transform: isCurrent 
                          ? (isMobile ? "translate3d(-80px, -10px, 45px) rotateY(12deg) rotateZ(-3deg) scale(1.05)" : "translate3d(-150px, -15px, 60px) rotateY(12deg) rotateZ(-3deg) scale(1.05)")
                          : "translate3d(0, 0, -5px) scale(0.92)",
                        opacity: isCurrent ? 1 : 0,
                        pointerEvents: isCurrent ? "auto" : "none",
                        transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease-out",
                        borderColor: isCurrent ? "var(--primary)" : "transparent",
                        boxShadow: isCurrent ? "0 25px 50px -12px rgba(0,0,0,0.85), 0 0 30px rgba(239,68,68,0.25)" : "none"
                      }}
                    >
                      {commanderImg ? (
                        <CardMedia 
                          src={commanderImg} 
                          alt={commander?.name || "Commander"} 
                          className="w-full h-full object-cover"
                          loading="eager"
                        />
                      ) : (
                        <div className="w-full h-full bg-secondary/80 flex flex-col items-center justify-center p-4 text-center rounded-xl border border-white/10">
                          <Crown className="w-8 h-8 text-muted-foreground/30 mb-2" />
                          <span className="text-xs text-muted-foreground font-semibold">No Commander</span>
                        </div>
                      )}
                    </div>

                    {/* 2. 3D Deck Box (pivots to the right when active) */}
                    <div 
                      className="absolute inset-0"
                      style={{
                        transformStyle: "preserve-3d",
                        transform: isCurrent 
                          ? (isMobile ? "translate3d(80px, 0, -20px) rotateY(-20deg) rotateX(10deg)" : "translate3d(150px, 0, -25px) rotateY(-22deg) rotateX(10deg)")
                          : "translate3d(0, 0, 0) rotateY(0deg) rotateX(0deg)",
                        transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
                      }}
                    >
                      {/* Shadow below the deck box */}
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 bg-black/80 blur-md rounded-full transition-all duration-700 pointer-events-none" 
                        style={{
                          bottom: "-25px",
                          width: "var(--box-w)",
                          height: "var(--box-d)",
                          transform: "rotateX(90deg)",
                          opacity: isCurrent ? 0.85 : 0.45
                        }}
                      />

                      {/* Box Faces */}
                      {/* Front Face */}
                      <div 
                        className="absolute inset-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl"
                        style={{ 
                          transform: "translate3d(0, 0, var(--box-half-d))",
                          backfaceVisibility: "hidden"
                        }}
                      >
                        <CardMedia src={cardback} alt="Box Front" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/12" />
                        <div 
                          className="absolute inset-0 bg-neutral-950 transition-opacity duration-700 pointer-events-none" 
                          style={{ opacity: isCurrent ? 0 : 0.55 }} 
                        />
                      </div>

                      {/* Back Face */}
                      <div 
                        className="absolute inset-0 rounded-xl overflow-hidden border border-white/10"
                        style={{ 
                          transform: "translate3d(0, 0, var(--box-neg-half-d)) rotateY(180deg)",
                          backfaceVisibility: "hidden"
                        }}
                      >
                        <CardMedia src={cardback} alt="Box Back" className="w-full h-full object-cover" />
                        <div 
                          className="absolute inset-0 bg-neutral-950 transition-opacity duration-700 pointer-events-none" 
                          style={{ opacity: isCurrent ? 0 : 0.55 }} 
                        />
                      </div>

                      {/* Left Side Face */}
                      <div 
                        className="absolute top-0 bottom-0 bg-gradient-to-b from-neutral-800 to-neutral-950 border-y border-white/10 flex items-center justify-center [writing-mode:vertical-rl] px-1 text-[8px] sm:text-[10px] font-extrabold text-amber-400/90 tracking-widest uppercase select-none font-sans"
                        style={{ 
                          width: "var(--box-d)", 
                          left: "var(--box-left-left)", 
                          transform: "rotateY(-90deg)",
                          transformOrigin: "center"
                        }}
                      >
                        {deck.deckName.slice(0, 20)}
                        <div 
                          className="absolute inset-0 bg-neutral-950 transition-opacity duration-700 pointer-events-none" 
                          style={{ opacity: isCurrent ? 0 : 0.55 }} 
                        />
                      </div>

                      {/* Right Side Face */}
                      <div 
                        className="absolute top-0 bottom-0 bg-gradient-to-b from-neutral-800 to-neutral-950 border-y border-white/10 flex items-center justify-center [writing-mode:vertical-rl] px-1 text-[8px] sm:text-[10px] font-bold text-neutral-400 tracking-wider uppercase select-none"
                        style={{ 
                          width: "var(--box-d)", 
                          left: "var(--box-right-left)", 
                          transform: "rotateY(90deg)",
                          transformOrigin: "center"
                        }}
                      >
                        PLAYING CARDS
                        <div 
                          className="absolute inset-0 bg-neutral-950 transition-opacity duration-700 pointer-events-none" 
                          style={{ opacity: isCurrent ? 0 : 0.55 }} 
                        />
                      </div>

                      {/* Top Lid Face (opens when active) */}
                      <div 
                        className="absolute left-0 right-0 bg-neutral-800 border-x border-white/10 flex items-center justify-center"
                        style={{ 
                          height: "var(--box-d)", 
                          top: "var(--box-top-top)", 
                          transformOrigin: "bottom",
                          transform: isCurrent ? "rotateX(145deg) translateY(-8px)" : "rotateX(90deg)",
                          transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
                        }}
                      >
                        <div className="w-4/5 h-[2px] bg-neutral-950/80 rounded" />
                        <div 
                          className="absolute inset-0 bg-neutral-950 transition-opacity duration-700 pointer-events-none" 
                          style={{ opacity: isCurrent ? 0 : 0.55 }} 
                        />
                      </div>

                      {/* Bottom Face */}
                      <div 
                        className="absolute left-0 right-0 bg-neutral-950 border-x border-white/10"
                        style={{ 
                          height: "var(--box-d)", 
                          top: "var(--box-bottom-top)", 
                          transform: "rotateX(-90deg)"
                        }}
                      >
                        <div 
                          className="absolute inset-0 bg-neutral-950 transition-opacity duration-700 pointer-events-none" 
                          style={{ opacity: isCurrent ? 0 : 0.55 }} 
                        />
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="absolute right-2 sm:right-6 md:right-12 w-12 h-12 rounded-full border border-border/40 bg-black/50 backdrop-blur-md hover:bg-primary/20 hover:border-primary/50 text-foreground transition-all duration-200 shadow-md z-35 shrink-0"
            title="Next"
          >
            <ChevronRight className="w-7 h-7" />
          </Button>

        </div>

        {/* ── ACTIVE DECK INFORMATION DISPLAY ── */}
        <div className="mt-8 text-center max-w-md w-full px-6 space-y-4 animate-fade-in-up">
          <div className="space-y-1">
            {/* Deck Title */}
            <h2 className="text-2xl font-extrabold text-foreground tracking-tight truncate">
              {activeDeck.deckName}
            </h2>
            
            {/* Commander Subtitle */}
            <p className="text-xs text-muted-foreground font-medium truncate flex items-center justify-center gap-1.5">
              {activeCommander ? (
                <>
                  <Crown className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Led by <strong className="text-foreground/90">{activeCommander.name}</strong></span>
                </>
              ) : (
                "No commander specified"
              )}
            </p>
          </div>

          {/* Deck Badges / Stats row */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Badge className="bg-black/75 border border-border/40 font-mono text-[10px] px-2 py-0.5 shadow-sm">
              {totalQty} / 100 cards
            </Badge>
            {bannedCount > 0 && (
              <Badge className="bg-red-950/80 border border-red-500/40 text-red-400 font-mono text-[10px] gap-1 px-2 py-0.5 shadow-sm">
                <ShieldAlert className="w-3 h-3 text-red-500" />
                <span>{bannedCount} Banned</span>
              </Badge>
            )}
            {totalGames > 0 && (
              <Badge className="bg-yellow-950/70 border border-yellow-500/30 text-yellow-400 font-mono text-[10px] px-2 py-0.5 shadow-sm">
                {winrate}% Win Rate
              </Badge>
            )}
            {gcCount > 0 && (
              <Badge className="bg-red-950/70 border border-red-500/30 text-red-400 font-mono text-[10px] px-2 py-0.5 shadow-sm">
                {gcCount} Game Changers
              </Badge>
            )}
          </div>

          {/* ── ACTION BUTTONS UNDER THE DECK ── */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-full">
            {deletingId === activeDeck.id ? (
              <div className="flex items-center gap-2 w-full bg-destructive/95 rounded-lg border border-red-500/30 p-1.5 text-xs text-destructive-foreground justify-between font-semibold shadow-md animate-pulse">
                <span className="pl-2">Delete this deck? This cannot be undone.</span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => {
                      dispatch({ type: "DELETE_DECK", deckId: activeDeck.id });
                      setDeletingId(null);
                    }}
                    className="bg-white text-destructive font-bold px-3 py-1 rounded-md hover:bg-white/80 transition-colors shadow"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="bg-black/40 font-bold px-3 py-1 rounded-md hover:bg-black/60 text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Edit */}
                <Button
                  onClick={() => dispatch({ type: "OPEN_DECK", deckId: activeDeck.id })}
                  className="flex-1 bg-white text-black hover:bg-white/90 font-bold gap-1 px-4 h-9 shadow text-xs shrink-0 min-w-[80px]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Button>

                {/* 2. Split view */}
                <Button
                  variant="outline"
                  onClick={() => onOpenSplit(activeDeck.id)}
                  className="w-9 h-9 sm:w-auto sm:px-3 text-muted-foreground hover:text-foreground border border-border/40 rounded-lg bg-black/40 hover:bg-black/60 shrink-0 gap-1.5 text-xs"
                  title="Open in Split Screen"
                >
                  <Columns className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">Split view</span>
                </Button>

                {/* 3. Duplicate */}
                <Button
                  variant="outline"
                  onClick={() => {
                    dispatch({
                      type: "DUPLICATE_DECK",
                      deckId: activeDeck.id,
                      newDeckId: `deck-${Date.now()}`,
                    });
                  }}
                  className="w-9 h-9 sm:w-auto sm:px-3 text-muted-foreground hover:text-foreground border border-border/40 rounded-lg bg-black/40 hover:bg-black/60 shrink-0 gap-1.5 text-xs"
                  title="Duplicate Deck"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Duplicate</span>
                </Button>

                {/* 4. Share */}
                <Button
                  variant="outline"
                  onClick={() => onShareOpen(activeDeck.id)}
                  className="w-9 h-9 sm:w-auto sm:px-3 text-muted-foreground hover:text-emerald-400 border border-border/40 rounded-lg bg-black/40 hover:bg-black/60 shrink-0 gap-1.5 text-xs"
                  title="Share Deck"
                >
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Share</span>
                </Button>

                {/* 5. Delete */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDeletingId(activeDeck.id)}
                  className="w-9 h-9 text-muted-foreground hover:text-red-400 border border-border/40 rounded-lg bg-black/40 hover:bg-destructive/20 hover:border-destructive/30 shrink-0"
                  title="Delete Deck"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Create Deck Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create New Deck</DialogTitle>
            <DialogDescription>Start from scratch or copy an existing deck.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Select value={createDeckSource} onValueChange={(val) => setCreateDeckSource(val || "new")}>
              <SelectTrigger>
                <SelectValue placeholder="Select starting point" />
              </SelectTrigger>
              <SelectContent className="max-h-64 custom-scrollbar">
                <SelectItem value="new">Create New Deck</SelectItem>
                {decks.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Copy from: {d.deckName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (createDeckSource === "new") {
                  dispatch({ type: "CREATE_DECK", id: `deck-${Date.now()}` });
                } else {
                  dispatch({
                    type: "DUPLICATE_DECK",
                    deckId: createDeckSource,
                    newDeckId: `deck-${Date.now()}`,
                  });
                }
                setIsCreateModalOpen(false);
              }}
            >
              Create Deck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
