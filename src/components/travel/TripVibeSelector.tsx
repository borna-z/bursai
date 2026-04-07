import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';
import { VIBES, type VibeId } from './types';

interface TripVibeSelectorProps {
  vibe: VibeId;
  onVibeChange: (vibe: VibeId) => void;
  label?: string;
}

export function TripVibeSelector({ vibe, onVibeChange, label }: TripVibeSelectorProps) {
  return (
    <div className="space-y-3">
      {label && (
        <label className="label-editorial">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-2.5">
        {VIBES.map(v => (
          <button
            key={v.id}
            onClick={() => { hapticLight(); onVibeChange(v.id); }}
            className={cn(
              'press rounded-full border px-4 py-2.5 text-[0.76rem] font-medium uppercase tracking-[0.14em] transition-all',
              vibe === v.id
                ? 'border-foreground bg-foreground text-background shadow-[0_10px_22px_rgba(28,25,23,0.12)]'
                : 'border-border/70 bg-background/80 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
