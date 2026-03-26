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
    <div className="space-y-2">
      {label && (
        <label className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {VIBES.map(v => (
          <button
            key={v.id}
            onClick={() => { hapticLight(); onVibeChange(v.id); }}
            className={cn(
              'px-4 py-1.5 rounded-full text-[13px] font-medium transition-all border',
              vibe === v.id
                ? 'bg-foreground text-background border-transparent'
                : 'bg-card/60 border-border/20 text-foreground hover:bg-card/80'
            )}
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
