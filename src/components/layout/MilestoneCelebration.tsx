import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BursMonogram } from '@/components/ui/BursMonogram';
import { useGarmentCount } from '@/hooks/useGarments';
import { useOutfits } from '@/hooks/useOutfits';
import { hapticLight } from '@/lib/haptics';

// ─── Milestone copy ───

const MILESTONES = {
  first_outfit: {
    title: 'Your first look.',
    sub: 'The wardrobe is alive.',
  },
  ten_garments: {
    title: 'Ten pieces in.',
    sub: 'Enough to build real outfits.',
  },
  first_wear: {
    title: 'Worn. Tracked.',
    sub: 'BURS is learning your rhythm.',
  },
} as const;

type MilestoneKey = keyof typeof MILESTONES;

// ─── Hook ───

const STORAGE_KEY = 'burs_milestones_seen';

function useMilestoneCelebration() {
  const getSeen = useCallback((): Set<MilestoneKey> => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return new Set(JSON.parse(raw ?? '[]') as MilestoneKey[]);
    } catch {
      return new Set<MilestoneKey>();
    }
  }, []);

  const markSeen = useCallback(
    (key: MilestoneKey) => {
      const seen = getSeen();
      seen.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
    },
    [getSeen],
  );

  const { data: garmentCount } = useGarmentCount();
  const { data: outfits } = useOutfits();

  const [active, setActive] = useState<MilestoneKey | null>(null);

  useEffect(() => {
    const seen = getSeen();

    if (!seen.has('first_outfit') && outfits && outfits.length >= 1) {
      setActive('first_outfit');
      markSeen('first_outfit');
      return;
    }

    if (!seen.has('ten_garments') && garmentCount !== undefined && garmentCount >= 10) {
      setActive('ten_garments');
      markSeen('ten_garments');
      return;
    }

    const hasFirstWear = localStorage.getItem('burs_first_wear_logged') === 'true';
    if (!seen.has('first_wear') && hasFirstWear) {
      setActive('first_wear');
      markSeen('first_wear');
      return;
    }
  }, [garmentCount, outfits, getSeen, markSeen]);

  const dismiss = useCallback(() => setActive(null), []);

  return { active, dismiss };
}

// ─── Component ───

export function MilestoneCelebration() {
  const { active, dismiss } = useMilestoneCelebration();

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(dismiss, 3500);
    return () => clearTimeout(timer);
  }, [active, dismiss]);

  const handleClick = () => {
    hapticLight();
    dismiss();
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active}
          className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
          style={{ background: 'hsl(var(--foreground) / 0.88)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClick}
        >
          <motion.div
            className="flex flex-col items-center px-8 text-center"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <BursMonogram size={40} className="invert dark:invert-0" />

            <div
              className="w-16 h-px my-5"
              style={{ background: 'hsl(var(--background) / 0.25)' }}
            />

            <h2
              className="font-['Playfair_Display'] italic text-[2rem] leading-tight text-background"
            >
              {MILESTONES[active].title}
            </h2>

            <p
              className="font-['DM_Sans'] text-[13px] mt-2 tracking-[0.06em]"
              style={{ color: 'hsl(var(--background) / 0.5)' }}
            >
              {MILESTONES[active].sub}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
