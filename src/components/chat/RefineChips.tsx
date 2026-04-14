import { useMemo } from 'react';
import { Undo2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

interface ChipDef {
  label: string;
  message: string;
}

interface RefineChipsProps {
  garments: GarmentBasic[];
  onChipTap: (message: string) => void;
  canUndo: boolean;
  onUndo: () => void;
}

function hasOuterwear(garments: GarmentBasic[]): boolean {
  const outerCategories = new Set(['outerwear', 'jacket', 'coat', 'blazer', 'cardigan']);
  return garments.some((g) => outerCategories.has(g.category?.toLowerCase() ?? ''));
}

export function RefineChips({ garments, onChipTap, canUndo, onUndo }: RefineChipsProps) {
  const { t } = useLanguage();

  const contextChips = useMemo<ChipDef[]>(() => {
    const chips: ChipDef[] = [];

    // Outerwear-based chips
    if (hasOuterwear(garments)) {
      chips.push({ label: t('chat.swap_jacket'), message: 'Swap the jacket for something different' });
    } else {
      chips.push({ label: t('chat.add_outerwear'), message: 'Add outerwear to this outfit' });
      chips.push({ label: t('chat.add_layer'), message: 'Add a layer to this outfit' });
    }

    // Temperature chips (always useful)
    chips.push({ label: t('chat.make_warmer'), message: 'Make this outfit warmer' });
    chips.push({ label: t('chat.make_lighter'), message: 'Make this outfit lighter for warmer weather' });

    // Formality chips
    chips.push({ label: t('chat.dress_it_up'), message: 'Dress this outfit up' });
    chips.push({ label: t('chat.more_casual'), message: 'Make this more casual' });

    // Deduplicate by label
    const seen = new Set<string>();
    return chips.filter((c) => {
      if (seen.has(c.label)) return false;
      seen.add(c.label);
      return true;
    });
  }, [garments, t]);

  const alwaysChips: ChipDef[] = [
    { label: t('chat.something_fresh'), message: "Use garments I haven't worn recently" },
    { label: t('chat.different_vibe'), message: 'Show me a completely different style direction' },
  ];

  const handleChipTap = (message: string) => {
    hapticLight();
    onChipTap(message);
  };

  const handleUndo = () => {
    hapticLight();
    onUndo();
  };

  return (
    <div className="flex flex-wrap gap-1.5 px-[var(--page-px)]">
      {canUndo && (
        <button
          onClick={handleUndo}
          className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12px] font-medium text-accent transition-colors hover:bg-accent/20 active:scale-95"
        >
          <Undo2 className="h-3 w-3" />
          {t('chat.undo')}
        </button>
      )}
      {[...contextChips, ...alwaysChips].map((chip) => (
        <button
          key={chip.label}
          onClick={() => handleChipTap(chip.message)}
          className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-muted active:scale-95"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
