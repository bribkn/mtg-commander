'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Trash2, Search, Loader2, X, Plus, ImageIcon, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeck } from '@/lib/deck-store';
import { autocompleteCardName, getCardByExactName } from '@/lib/scryfall';

interface CustomCardsModalProps {
  open: boolean;
  onClose: () => void;
  prepopulatedCard?: { id: string; name: string } | null;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CustomCardsModal({ open, onClose, prepopulatedCard }: CustomCardsModalProps) {
  const { customCards, dispatch } = useDeck();
  
  // Form states
  const [nameInput, setNameInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [associatedCard, setAssociatedCard] = useState<{ id: string; name: string } | null>(null);

  // Prepopulate when opened if prepopulatedCard is passed
  useEffect(() => {
    if (open && prepopulatedCard) {
      setAssociatedCard(prepopulatedCard);
      setSearchQuery(prepopulatedCard.name);
      setNameInput(`${prepopulatedCard.name} Alter`);
      setUrlInput('');
    } else if (open) {
      setNameInput('');
      setUrlInput('');
      setSearchQuery('');
      setAssociatedCard(null);
    }
  }, [open, prepopulatedCard]);
  
  // Search autocomplete states
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 32MB
    const maxSize = 32 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMsg('File size exceeds the 32MB limit.');
      return;
    }

    setFileName(file.name);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload image.');
      }

      const data = await res.json();
      const uploadedUrl = data?.data?.url;

      if (!uploadedUrl) {
        throw new Error('No image URL returned from server.');
      }

      setUrlInput(uploadedUrl);
      setFileName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error uploading file.');
      setFileName('');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }
  
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 250);

  // Close search suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch autocomplete suggestions when query changes
  useEffect(() => {
    if (debouncedSearch.length < 2 || (associatedCard && searchQuery === associatedCard.name)) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsSearching(true);
    autocompleteCardName(debouncedSearch).then((results) => {
      setSuggestions(results.slice(0, 6));
      setShowSuggestions(results.length > 0);
      setIsSearching(false);
    });
  }, [debouncedSearch, associatedCard]);

  // Handle selecting a card from search suggestions
  const handleSelectCard = async (cardName: string) => {
    setIsResolving(true);
    setSearchQuery(cardName);
    setShowSuggestions(false);
    try {
      const card = await getCardByExactName(cardName);
      if (card) {
        setAssociatedCard({ id: card.id, name: card.name });
        setErrorMsg('');
      } else {
        setErrorMsg('Could not fetch Scryfall card data.');
      }
    } catch {
      setErrorMsg('Error fetching card data.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleSave = () => {
    setErrorMsg('');
    const name = nameInput.trim();
    const url = urlInput.trim();
    
    if (!name) {
      setErrorMsg('Please enter a custom card name.');
      return;
    }
    if (!url) {
      setErrorMsg('Please enter an image URL.');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setErrorMsg('The image URL must begin with http:// or https://');
      return;
    }
    if (!associatedCard) {
      setErrorMsg('Please search and associate a Scryfall card.');
      return;
    }

    dispatch({
      type: 'ADD_CUSTOM_CARD',
      name,
      imageUrl: url,
      associatedScryfallId: associatedCard.id,
      associatedName: associatedCard.name,
    });

    // Reset form
    setNameInput('');
    setUrlInput('');
    setSearchQuery('');
    setAssociatedCard(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-4xl bg-card border-border max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gradient-red text-xl font-bold">
            <Sparkles className="w-5 h-5 text-primary" />
            Custom Card Alters & Proxies
          </DialogTitle>
          <DialogDescription>
            Add high-quality custom artwork, proxies, or alters and associate them with existing Scryfall cards. Coinciding custom images will be selectable from the printings variant menu inside your deck.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-6">
          {/* Two-Column Layout: Add Card Form (Left) & Gallery (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 items-start">
            {/* Form Column */}
            <div className="space-y-4 bg-secondary/15 p-4 rounded-xl border border-border/40">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Add Custom Card
              </h3>

              <div className="space-y-3">
                {/* 1. Custom Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">
                    Custom Card Name
                  </label>
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="e.g. Esika Anime Alter"
                    className="bg-secondary text-xs h-9"
                  />
                </div>

                 {/* 2. Image URL */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">
                    Image URL
                  </label>
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/art.jpg"
                    className="bg-secondary text-xs h-9"
                  />
                  <div className="flex flex-col gap-1.5 pt-1.5 mt-1 border-t border-border/10">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">
                      Or Upload Image (Max 32MB)
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => document.getElementById('alter-file-input')?.click()}
                        className="text-[10px] h-8 gap-1.5 border-dashed border-primary/45 hover:border-primary shrink-0 relative"
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {uploading ? 'Uploading...' : 'Choose File'}
                      </Button>
                      <span className="text-[9px] text-muted-foreground truncate max-w-[140px]">
                        {fileName || 'No file chosen'}
                      </span>
                      <input
                        type="file"
                        id="alter-file-input"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </div>
                  </div>
                </div>

                {/* Live Preview of image if present */}
                {urlInput.startsWith('http') && (
                  <div className="flex flex-col items-center py-2 border border-border/30 rounded-lg bg-black/25">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase mb-1">
                      Art Preview
                    </span>
                    <div className="relative w-[100px] aspect-[5/7] rounded border border-border bg-secondary overflow-hidden">
                      <img
                        src={urlInput}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 3. Associated Scryfall Card (Search Input) */}
                <div ref={containerRef} className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">
                    Associated MTG Card
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (associatedCard && e.target.value !== associatedCard.name) {
                          setAssociatedCard(null);
                        }
                      }}
                      onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                      placeholder="Search to associate card..."
                      className="pl-8 bg-secondary text-xs h-9"
                      autoComplete="off"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {isSearching && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                      {isResolving && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                      {searchQuery && !isSearching && !isResolving && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setSuggestions([]);
                            setAssociatedCard(null);
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {associatedCard && (
                    <div className="mt-1 flex items-center justify-between bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1 text-[10px] text-primary font-medium animate-fade-in-up">
                      <span>Linked to: {associatedCard.name}</span>
                      <button
                        onClick={() => {
                          setAssociatedCard(null);
                          setSearchQuery('');
                        }}
                        className="text-primary hover:text-primary-foreground font-bold ml-1.5"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {/* Search Autocomplete Suggestions */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl shadow-black/80 overflow-hidden text-xs">
                      {suggestions.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectCard(name);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-secondary hover:text-foreground transition-colors flex items-center gap-1.5"
                        >
                          <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <p className="text-[10px] text-destructive font-semibold animate-pulse mt-1">
                    {errorMsg}
                  </p>
                )}

                <Button
                  onClick={handleSave}
                  className="w-full text-xs h-9 bg-primary text-primary-foreground gap-1.5"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  Save Custom Card
                </Button>
              </div>
            </div>

            {/* Gallery Column */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-primary" />
                Custom Cards Library ({customCards.length})
              </h3>

              {customCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/60 rounded-xl bg-secondary/5 px-6">
                  <ImageIcon className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-semibold text-foreground">No Custom Cards</p>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    Your custom library is currently empty. Upload cards on the left to see them appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {customCards.map((card) => (
                    <div
                      key={card.id}
                      className="group relative aspect-[5/7] rounded-xl overflow-hidden border border-border/80 shadow-md bg-secondary hover:border-primary/50 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Standard fallback
                          (e.target as HTMLImageElement).src = 'https://i.imgur.com/Hg8CwwU.jpeg';
                        }}
                      />

                      {/* Hover Actions & Details Overlay */}
                      <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2.5 z-10 text-center">
                        <span className="text-[11px] font-bold text-foreground leading-tight truncate">
                          {card.name}
                        </span>

                        <div className="flex flex-col gap-1 w-full items-center">
                          <span className="text-[9px] text-muted-foreground truncate max-w-full">
                            Maps to: <strong className="text-foreground">{card.associatedName}</strong>
                          </span>
                          
                          <Button
                            variant="destructive"
                            size="icon"
                            className="w-7 h-7 mt-1 text-white bg-red-600 hover:bg-red-700 rounded-md shrink-0"
                            onClick={() => dispatch({ type: 'DELETE_CUSTOM_CARD', id: card.id })}
                            title="Delete custom card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
