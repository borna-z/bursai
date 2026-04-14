import { useMemo } from 'react';
import { Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
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

    if (hasOuterwear(garments)) {
      chips.push({ label: t('chat.swap_jacket'), message: 'Swap the jacket for something different' });
    } else {
      chips.push({ label: t('chat.add_outerwear'), message: 'Add outerwear to this outfit' });
      chips.push({ label: t('chat.add_layer'), message: 'Add a layer to this outfit' });
    }

    chips.push({ label: t('chat.make_warmer'), message: 'Make this outfit warmer' });
    chips.push({ label: t('chat.make_lighter'), message: 'Make this outfit lighter for warmer weather' });
    chips.push({ label: t('chat.dress_it_up'), message: 'Dress this outfit up' });
    chips.push({ label: t('chat.more_casual'), message: 'Make this more casual' });

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

  const allChips = [...contextChips, ...alwaysChips];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: 'tween', ease: EASE_CURVE, duration: 0.25 }}
      className="px-[var(--page-px)]"
    >
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 -mx-1 px-1">
        <AnimatePresence>
          {canUndo && (
            <motion.button
              key="undo"
              initial={{ scale: 0.8, opacity: 0, width: 0 }}
              animate={{ scale: 1, opacity: 1, width: 'auto' }}
              exit={{ scale: 0.8, opacity: 0, width: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={() => { hapticLight(); onUndo(); }}
              className="inline-flex items-center gap-1 shrink-0 rounded-full border border-accent/30 bg-accent/8 px-3 py-[7px] text-[12px] font-medium font-body text-accent whitespace-nowrap active:scale-95 transition-transform"
            >
              <Undo2 className="h-3 w-3" />
              {t('chat.undo')}
            </motion.button>
          )}
        </AnimatePresence>
        {allChips.map((chip, idx) => (
          <motion.button
            key={chip.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'tween', ease: EASE_CURVE, duration: 0.2, delay: idx * 0.03 }}
            onClick={() => { hapticLight(); onChipTap(chip.message); }}
            className="shrink-0 rounded-full border border-border/40 bg-card/80 backdrop-blur-sm px-3 py-[7px] text-[12px] font-body font-medium text-foreground/60 whitespace-nowrap hover:text-foreground/90 hover:border-border/60 active:scale-95 transition-all"
          >
            {chip.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
