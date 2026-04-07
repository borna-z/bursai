import { MapPin, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import type { SavedCapsule } from './types';

interface SavedCapsulesListProps {
  capsules: SavedCapsule[];
  onLoad: (capsule: SavedCapsule) => void;
  onRemove: (capsuleId: string) => void;
}

export function SavedCapsulesList({ capsules, onLoad, onRemove }: SavedCapsulesListProps) {
  if (capsules.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="label-editorial">Saved Capsules</p>
        <p className="mt-1 text-sm text-muted-foreground">Jump back into recent trips and repack in seconds.</p>
      </div>

      {capsules.map((capsule) => (
        <Card key={capsule.id} surface="utility" className="p-4">
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => onLoad(capsule)}
              className="flex-1 text-left transition-opacity hover:opacity-85"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow-chip !bg-secondary/70 capitalize">{capsule.vibe}</span>
                {capsule.dateLabel ? <span className="meta">{capsule.dateLabel}</span> : null}
              </div>
              <div className="mt-3 space-y-1.5">
                <h3 className="text-[1.18rem] font-semibold tracking-[-0.045em] text-foreground">
                  {capsule.destination}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Ready to reload
                  </span>
                  <span>{capsule.itemCount} items</span>
                  <span>{capsule.outfitCount} outfits</span>
                </div>
              </div>
            </button>

            <Button
              variant="quiet"
              size="icon"
              onClick={() => onRemove(capsule.id)}
              aria-label={`Remove ${capsule.destination}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
