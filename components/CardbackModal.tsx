'use client';

import { useState } from 'react';
import { Images, Trash2, Check, X, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeck } from '@/lib/deck-store';
import { MTG_CARD_BACK } from '@/lib/scryfall';

interface CardbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function CardbackModal({ open, onClose }: CardbackModalProps) {
  const { state, savedCardbacks, dispatch } = useDeck();
  const [urlInput, setUrlInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!state) return null;

  const currentCardback = state.customCardbackUrl || MTG_CARD_BACK;

  function handleSave() {
    setErrorMsg('');
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) {
      setErrorMsg('Please enter a valid URL.');
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMsg('The URL must begin with http:// or https://');
      return;
    }

    // Save to active deck
    dispatch({ type: 'SET_CUSTOM_CARDBACK', url: cleanUrl });
    // Save to global list
    dispatch({ type: 'SAVE_CARDBACK_URL', url: cleanUrl });
    
    setUrlInput('');
  }

  function handleSelect(url: string | null) {
    dispatch({ type: 'SET_CUSTOM_CARDBACK', url });
  }

  function handleDelete(url: string, e: React.MouseEvent) {
    e.stopPropagation();
    dispatch({ type: 'DELETE_CARDBACK_URL', url });
    // If the deleted url was active in the current deck, unset it
    if (state && state.customCardbackUrl === url) {
      dispatch({ type: 'SET_CUSTOM_CARDBACK', url: null });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-2xl bg-card border-border max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gradient-red text-xl font-bold">
            <Images className="w-5 h-5 text-primary" />
            Custom Cardback
          </DialogTitle>
          <DialogDescription>
            Customize the cardback for this deck. This image will be used in Tabletop Simulator exports and shown in local previews.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-6">
          {/* Main layout: Preview on left, controls on right */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-6 items-start">
            {/* Live Preview */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Preview
              </span>
              <div className="relative w-[130px] aspect-[5/7] rounded-xl overflow-hidden border border-border/80 shadow-2xl bg-secondary group/preview">
                {/* Image element with object-cover to automatically clip and scale wider/taller cardbacks perfectly */}
                <img
                  src={currentCardback}
                  alt="Cardback Preview"
                  className="w-full h-full object-cover select-none"
                  onError={(e) => {
                    // Fallback if image fails to load
                    (e.target as HTMLImageElement).src = MTG_CARD_BACK;
                  }}
                />
                
                {state.customCardbackUrl && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200 flex items-center justify-center p-2 text-center text-[10px] text-white font-mono leading-tight">
                    Adjusted Image (5:7)
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 text-center">
                {state.customCardbackUrl ? 'Custom Cardback' : 'Official MTG Back'}
              </span>
            </div>

            {/* Input URL controls */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Enter Image URL
                </label>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/cardback.jpg"
                    className="flex-1 bg-secondary text-xs h-9"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                    }}
                  />
                  <Button onClick={handleSave} className="h-9 text-xs px-3" size="sm">
                    Save
                  </Button>
                </div>
                {errorMsg && (
                  <p className="text-[11px] text-destructive font-medium leading-none mt-1 animate-pulse">
                    {errorMsg}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                  💡 <strong>Adjustment Tip:</strong> If your uploaded image is wider, it will automatically scale and clip to fit the 5:7 vertical card container perfectly without stretching.
                </p>
              </div>

              {/* Reset to default cardback */}
              {state.customCardbackUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelect(null)}
                  className="text-xs h-8 text-muted-foreground hover:text-foreground"
                >
                  Reset to Official Cardback
                </Button>
              )}
            </div>
          </div>

          {/* Saved cardbacks gallery registry */}
          <div className="border-t border-border/40 pt-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Your Saved Cardbacks
            </h3>

            {savedCardbacks.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
                You don't have any custom cardbacks saved yet. Add one above to use it across your decks.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
                {/* Default Option as first in gallery */}
                <div
                  onClick={() => handleSelect(null)}
                  className={`relative aspect-[5/7] rounded-lg overflow-hidden cursor-pointer border transition-all duration-200 group/item flex flex-col items-center justify-center p-1 bg-secondary hover:scale-[1.03] ${
                    !state.customCardbackUrl
                      ? 'border-primary ring-2 ring-primary bg-primary/5 shadow-md'
                      : 'border-border/60 hover:border-primary/50'
                  }`}
                  title="Official MTG Cardback"
                >
                  <img
                    src={MTG_CARD_BACK}
                    alt="Official Back"
                    className="w-full h-full object-cover rounded opacity-80"
                  />
                  {!state.customCardbackUrl && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-primary drop-shadow" />
                    </div>
                  )}
                </div>

                {/* Custom Saved Options */}
                {savedCardbacks.map((url, i) => {
                  const isActive = state.customCardbackUrl === url;
                  return (
                    <div
                      key={i}
                      onClick={() => handleSelect(url)}
                      className={`relative aspect-[5/7] rounded-lg overflow-hidden cursor-pointer border transition-all duration-200 group/item hover:scale-[1.03] ${
                        isActive
                          ? 'border-primary ring-2 ring-primary bg-primary/5 shadow-md'
                          : 'border-border/60 hover:border-primary/50'
                      }`}
                      title={url}
                    >
                      {/* Image render with object-cover */}
                      <img
                        src={url}
                        alt={`Saved cardback ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = MTG_CARD_BACK;
                        }}
                      />

                      {/* Active crown/check overlay */}
                      {isActive && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="w-5 h-5 text-primary drop-shadow" />
                        </div>
                      )}

                      {/* Delete hover button */}
                      <button
                        onClick={(e) => handleDelete(url, e)}
                        className="absolute top-1 right-1 p-1 rounded bg-black/80 text-muted-foreground hover:text-destructive opacity-0 group-hover/item:opacity-100 transition-opacity duration-200"
                        title="Delete from gallery"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-border/40 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
