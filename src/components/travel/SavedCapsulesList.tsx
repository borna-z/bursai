import { X } from 'lucide-react';
import type { SavedCapsule } from './types';

interface SavedCapsulesListProps {
  capsules: SavedCapsule[];
  onLoad: (capsule: SavedCapsule) => void;
  onRemove: (capsuleId: string) => void;
}

export function SavedCapsulesList({ capsules, onLoad, onRemove }: SavedCapsulesListProps) {
  if (capsules.length === 0) return null;

  return (
    <div className="space-y-2">
      {capsules.map(c => (
        <button
          key={c.id}
          onClick={() => onLoad(c)}
          className="w-full text-left p-4 rounded-xl bg-card/60 border border-border/10 hover:bg-card/80 transition-colors relative group"
        >
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(c.id); }}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
          <p style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 16, color: '#1C1917', margin: 0 }}>
            {c.destination}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 10, background: '#EDE8DF',
              color: '#1C1917', padding: '2px 8px', textTransform: 'capitalize',
            }}>
              {c.vibe}
            </span>
            {c.dateLabel && (
              <span className="text-[11px] text-muted-foreground/60">{c.dateLabel}</span>
            )}
            <span className="text-[11px] text-muted-foreground/60">
              {c.itemCount} items · {c.outfitCount} outfits
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
