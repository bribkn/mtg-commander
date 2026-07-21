"use client";

import { useState, useEffect } from "react";
import { Dices, Plus, RotateCcw, Flame } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeck, DeckCard } from "@/lib/deck-store";
import { CardMedia } from "@/components/CardMedia";
import { getFrontImageUrl } from "@/lib/scryfall";

interface PlaytestModalProps {
    open: boolean;
    onClose: () => void;
    deckId?: string;
}

export function PlaytestModal({ open, onClose, deckId }: PlaytestModalProps) {
    const { state: globalState, decks } = useDeck();
    const state = deckId ? (decks.find((d) => d.id === deckId) ?? null) : globalState;

    const [hand, setHand] = useState<DeckCard[]>([]);
    const [deckPool, setDeckPool] = useState<DeckCard[]>([]);

    // Shuffle Helper (Fisher-Yates)
    function shuffle(array: DeckCard[]) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Draw 7 random cards
    const drawHand = () => {
        if (!state) return;
        const flatLibrary: DeckCard[] = [];
        state.cards.forEach((card) => {
            if (!card.isCommander) {
                for (let i = 0; i < card.quantity; i++) {
                    flatLibrary.push(card);
                }
            }
        });

        const shuffled = shuffle(flatLibrary);
        setHand(shuffled.slice(0, 7));
        setDeckPool(shuffled.slice(7));
    };

    // Draw 1 card from library
    const drawCard = () => {
        if (deckPool.length > 0) {
            const nextCard = deckPool[0];
            setHand((prev) => [...prev, nextCard]);
            setDeckPool((prev) => prev.slice(1));
        }
    };

    // Discard / Play card
    const discardCard = (index: number) => {
        setHand((prev) => prev.filter((_, idx) => idx !== index));
    };

    useEffect(() => {
        if (open) {
            drawHand();
        }
    }, [open]);

    if (!state) return null;

    // Hand calculations
    const totalCardsInHand = hand.length;
    const lands = hand.filter((c) => c.category === "Land" || c.scryfallData.type_line.toLowerCase().includes("land"));
    const spells = hand.filter((c) => c.category !== "Land" && !c.scryfallData.type_line.toLowerCase().includes("land"));
    const landCount = lands.length;
    const spellCount = spells.length;

    const avgCmc = spells.length > 0 ? (spells.reduce((sum, c) => sum + (c.scryfallData.cmc ?? 0), 0) / spells.length).toFixed(1) : "0.0";

    // CMC distribution for the hand
    const cmcCounts = { "0-1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
    spells.forEach((card) => {
        const cmc = Math.floor(card.scryfallData.cmc ?? 0);
        if (cmc <= 1) cmcCounts["0-1"]++;
        else if (cmc === 2) cmcCounts["2"]++;
        else if (cmc === 3) cmcCounts["3"]++;
        else if (cmc === 4) cmcCounts["4"]++;
        else if (cmc === 5) cmcCounts["5"]++;
        else cmcCounts["6+"]++;
    });

    const maxCmcCount = Math.max(...Object.values(cmcCounts), 1);

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-[96vw] lg:max-w-[1450px] xl:max-w-[1800px] h-[92vh] max-h-[95vh] bg-card border border-border text-foreground flex flex-col overflow-hidden rounded-xl p-6 shadow-2xl">
                <DialogHeader className="shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                            <Dices className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Playtest Hand Simulator</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Draw starting hands, check land ratios, and test your deck's early mana curve.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Inner Content Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar my-4 pr-1">
                    <div className="grid grid-cols-1 gap-6 items-start">
                        {/* Hand Area */}
                        <div className="space-y-4">
                            <div className="bg-secondary/15 rounded-xl p-4 border border-border/40 min-h-[360px] lg:min-h-[460px] flex flex-col justify-between">
                                {totalCardsInHand === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-2">
                                        <Dices
                                            className="w-12 h-12 text-muted-foreground/30 animate-spin"
                                            style={{ animationDuration: "3s" }}
                                        />
                                        <p className="font-semibold text-foreground text-sm">Your hand is empty</p>
                                        <p className="text-xs">Click "Mulligan" to draw a fresh hand of 7 cards.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap justify-center gap-4">
                                        {hand.map((card, idx) => {
                                            const isLand =
                                                card.category === "Land" || card.scryfallData.type_line.toLowerCase().includes("land");
                                            return (
                                                <div
                                                    key={`${card.scryfallId}-${idx}`}
                                                    className="group relative w-full max-w-[220px] aspect-[3/4] rounded-lg overflow-hidden border border-border/80 bg-black/40 hover:scale-[1.06] hover:shadow-xl hover:border-primary/40 transition-all duration-200"
                                                >
                                                    <CardMedia
                                                        src={getFrontImageUrl(card.scryfallData) || ""}
                                                        alt={card.name}
                                                        className="w-full h-full object-cover select-none pointer-events-none"
                                                        loading="eager"
                                                    />
                                                    {/* Card overlay details & discard option */}
                                                    <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-end p-2">
                                                        <div className="flex flex-col gap-1.5 w-full items-center">
                                                            <span className="text-[9px] font-bold text-foreground text-center truncate w-full px-1">
                                                                {card.name}
                                                            </span>
                                                            <Button
                                                                size="xs"
                                                                variant="destructive"
                                                                onClick={() => discardCard(idx)}
                                                                className="w-full text-[9px] h-6 font-bold"
                                                            >
                                                                Discard / Play
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Info status bar */}
                                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground shrink-0 font-semibold uppercase tracking-wider">
                                    <span>Library Remaining: {deckPool.length} Cards</span>
                                    <span>Hand Size: {totalCardsInHand} Cards</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats Area */}
                        <div className="bg-secondary/20 rounded-xl p-4 border border-border/50 space-y-4 w-full">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-primary" />
                                <span>Hand Analysis</span>
                            </h3>

                            {/* Land vs Spell Bar */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-bold">
                                    <span className="text-emerald-400">{landCount} Lands</span>
                                    <span className="text-blue-400">{spellCount} Spells</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden bg-secondary flex border border-border/20">
                                    {totalCardsInHand > 0 ? (
                                        <>
                                            <div
                                                className="h-full bg-emerald-500 transition-all duration-300"
                                                style={{ width: `${(landCount / totalCardsInHand) * 100}%` }}
                                            />
                                            <div
                                                className="h-full bg-blue-500 transition-all duration-300"
                                                style={{ width: `${(spellCount / totalCardsInHand) * 100}%` }}
                                            />
                                        </>
                                    ) : (
                                        <div className="w-full bg-muted-foreground/20" />
                                    )}
                                </div>
                            </div>

                            {/* Average CMC */}
                            <div className="bg-secondary/40 rounded-lg p-2 border border-border/40 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                    Average Spell CMC
                                </span>
                                <span className="text-sm font-mono font-extrabold text-indigo-400">{avgCmc}</span>
                            </div>

                            {/* Mana Curve / Distribution */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                    Mana Curve of Spells
                                </h4>
                                <div className="space-y-1.5">
                                    {Object.entries(cmcCounts).map(([label, count]) => {
                                        const pct = maxCmcCount > 0 ? (count / maxCmcCount) * 100 : 0;
                                        return (
                                            <div key={label} className="flex items-center gap-2 text-xs">
                                                <span className="text-muted-foreground w-8 font-mono text-[10px] text-right font-bold">
                                                    {label}
                                                </span>
                                                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden border border-border/20">
                                                    <div
                                                        className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-foreground font-mono w-4 text-right text-[10px] font-extrabold">
                                                    {count}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer controls row */}
                <div className="shrink-0 flex items-center justify-between pt-4 border-t border-border mt-2">
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={drawHand}
                            className="gap-1.5 font-bold h-9 text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center shadow-lg shadow-indigo-600/10 transition-transform active:scale-95"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Mulligan (New 7)</span>
                        </Button>
                        <Button
                            variant="outline"
                            onClick={drawCard}
                            disabled={deckPool.length === 0}
                            className="gap-1.5 font-bold h-9 text-xs border-border hover:border-indigo-500 hover:text-indigo-400 flex items-center transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Draw Card (+1)</span>
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-xs h-9 font-semibold text-muted-foreground hover:text-foreground"
                    >
                        Close Simulator
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
