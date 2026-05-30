'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { autocompleteCardName, getCardByExactName } from '@/lib/scryfall';
import { useDeck } from '@/lib/deck-store';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CardSearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { dispatch } = useDeck();

  const debouncedQuery = useDebounce(query, 250);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsLoading(true);
    autocompleteCardName(debouncedQuery).then((results) => {
      setSuggestions(results.slice(0, 8));
      setShowSuggestions(results.length > 0);
      setIsLoading(false);
      setHighlightedIndex(-1);
    });
  }, [debouncedQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addCard = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setIsAdding(true);
    setShowSuggestions(false);
    setQuery('');
    try {
      const card = await getCardByExactName(name);
      if (card) {
        dispatch({ type: 'ADD_CARD', card, quantity: 1 });
      }
    } finally {
      setIsAdding(false);
      inputRef.current?.focus();
    }
  }, [dispatch]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addCard(suggestions[highlightedIndex]);
      } else if (query.trim()) {
        addCard(query.trim());
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          id="card-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Search cards to add..."
          className="pl-9 pr-9 bg-secondary border-border focus:border-primary/50 focus:ring-primary/20 transition-colors"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
          {isAdding && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
          {query && !isLoading && !isAdding && (
            <button
              onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl shadow-black/50 overflow-hidden animate-fade-in-up">
          {suggestions.map((name, i) => (
            <button
              key={name}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2
                ${i === highlightedIndex
                  ? 'bg-primary/20 text-primary'
                  : 'text-foreground hover:bg-secondary'
                }`}
              onMouseDown={(e) => {
                e.preventDefault();
                addCard(name);
              }}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
