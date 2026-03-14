import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLocationSuggestions } from '@/hooks/useLocationSuggestions';
import type { CitySuggestion } from '@/hooks/useForecast';
import { cn } from '@/lib/utils';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (city: string, coords: { lat: number; lon: number }) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  icon?: React.ReactNode;
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search city...',
  className,
  inputClassName,
  icon,
}: LocationAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { suggestions, isLoading, error, hasSearched, clear } = useLocationSuggestions(value);

  const showDropdown = open && (isLoading || suggestions.length > 0 || (hasSearched && suggestions.length === 0) || !!error);

  // Show dropdown when suggestions arrive or search completes
  useEffect(() => {
    if (suggestions.length > 0 || (hasSearched && value.length >= 2) || error) setOpen(true);
  }, [suggestions, hasSearched, error, value]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback((s: CitySuggestion) => {
    onChange(s.short_name);
    onSelect(s.short_name, { lat: s.lat, lon: s.lon });
    setOpen(false);
    setActiveIndex(-1);
    clear();
  }, [onChange, onSelect, clear]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (icon || <MapPin className="w-4 h-4" />)}
        </span>
        <Input
          value={value}
          onChange={e => { onChange(e.target.value); setActiveIndex(-1); }}
          onFocus={() => { if (suggestions.length > 0 || hasSearched) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('pl-10', inputClassName)}
          autoComplete="off"
        />
      </div>

      {showDropdown && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-xl border border-border/20 bg-popover shadow-lg py-1"
        >
          {isLoading && suggestions.length === 0 && (
            <li className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Searching…</span>
            </li>
          )}

          {error && (
            <li className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </li>
          )}

          {!isLoading && !error && hasSearched && suggestions.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              No cities found
            </li>
          )}

          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lon}`}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm transition-colors',
                i === activeIndex ? 'bg-accent/10 text-accent-foreground' : 'text-foreground hover:bg-muted/40'
              )}
            >
              <span className="text-base shrink-0">{s.flag}</span>
              <span className="truncate">{s.short_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
