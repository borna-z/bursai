import { motion } from 'framer-motion';
import { Check, LightbulbIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { cn } from '@/lib/utils';

import type { CapsuleResult } from './types';

interface CapsuleSummaryProps {
  result: CapsuleResult;
  groupedItems: Record<string, Array<{ id: string; title: string; image_path: string; category: string }>>;
  checkedItems: Set<string>;
  toggleChecked: (id: string) => void;
  itemOutfitCount: Map<string, number>;
  capsuleItemIds: string[];
  garmentMap: Map<string, { id: string; title: string; image_path: string; category: string }>;
  allGarmentsMap: Map<string, { id: string; title: string; image_path: string; category: string }>;
  totalItems: number;
  packedCount: number;
}

export function CapsuleSummary({
  result,
  groupedItems,
  checkedItems,
  toggleChecked,
  itemOutfitCount,
  capsuleItemIds,
  garmentMap,
  allGarmentsMap,
  totalItems,
  packedCount,
}: CapsuleSummaryProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      key="packing"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.25, ease: EASE_CURVE }}
    >
      {/* ── Progress indicator ── */}
      <div className="mt-4">
        <div className="h-1 overflow-hidden rounded-full bg-muted/20">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${totalItems > 0 ? (packedCount / totalItems) * 100 : 0}%` }}
            transition={{ duration: 0.4, ease: EASE_CURVE }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{packedCount}</span> {t('capsule.of_packed').replace('{total}', String(totalItems))}
          </p>
          <span className="eyebrow-chip !bg-secondary/70">
            {result.outfits.length} {t('capsule.outfits_label')}
          </span>
        </div>
      </div>

      {/* ── Category sections ── */}
      {Object.entries(groupedItems).map(([category, items], categoryIndex) => {
        const categoryOutfitUses = (items || []).reduce(
          (sum, garment) => sum + (itemOutfitCount.get(garment.id) || 0),
          0,
        );

        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: categoryIndex * STAGGER_DELAY, duration: 0.35 }}
            className="mt-4 border-t border-border/40 pt-4"
          >
            {/* Category header */}
            <div className="mb-3 flex items-baseline gap-2">
              <span className="label-editorial">
                {t(`capsule.category_${category}`) !== `capsule.category_${category}`
                  ? t(`capsule.category_${category}`)
                  : category.charAt(0).toUpperCase() + category.slice(1)}
              </span>
              <span className="text-xs text-muted-foreground/70">
                · {(items || []).length} pieces · {t('capsule.used_in').toLowerCase()} {categoryOutfitUses} {t('capsule.outfits_label')}
              </span>
            </div>

            {/* Garment rows */}
            {(items || []).map((garment) => (
              <button
                key={garment.id}
                onClick={() => {
                  hapticLight();
                  toggleChecked(garment.id);
                }}
                className="flex w-full items-center gap-3 rounded-xl py-2.5 px-1 text-left transition-colors hover:bg-secondary/30"
              >
                {/* Circle checkbox */}
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
                    checkedItems.has(garment.id)
                      ? 'border-accent bg-accent'
                      : 'border-muted-foreground/30',
                  )}
                >
                  {checkedItems.has(garment.id) ? (
                    <Check className="h-3 w-3 text-accent-foreground" />
                  ) : null}
                </div>

                {/* Thumbnail */}
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[1rem] bg-muted/30">
                  <LazyImageSimple
                    imagePath={getPreferredGarmentImagePath(garment)}
                    alt={garment.title}
                    className="h-full w-full"
                  />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[0.85rem] font-medium',
                      checkedItems.has(garment.id)
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground',
                    )}
                  >
                    {garment.title}
                  </span>
                  <span className="text-[0.72rem] text-muted-foreground/70">
                    {t('capsule.used_in')} {itemOutfitCount.get(garment.id) || 0} {t('capsule.outfits_label')}
                  </span>
                </div>
              </button>
            ))}
          </motion.div>
        );
      })}

      {Object.keys(groupedItems).length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t('capsule.empty_packing')}
        </p>
      ) : null}

      {/* ── Packing tips ── */}
      {result.packing_tips.length > 0 ? (
        <div className="mt-6 border-t border-border/40 pt-4">
          <div className="mb-2.5 flex items-center gap-1.5">
            <LightbulbIcon className="h-3 w-3 text-muted-foreground" />
            <span className="label-editorial">{t('capsule.tips')}</span>
          </div>
          <ul className="space-y-1.5">
            {result.packing_tips.map((tip, index) => (
              <li key={index} className="flex gap-2 text-xs text-muted-foreground/70">
                <span className="shrink-0 text-accent">·</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── Copy packing list button ── */}
      <Button
        onClick={() => {
          hapticLight();
          const garmentTitles = capsuleItemIds
            .map((id) => garmentMap.get(id) ?? allGarmentsMap.get(id))
            .filter(Boolean)
            .map((garment) => `- ${garment!.title}`)
            .join('\n');

          try {
            navigator.clipboard.writeText(garmentTitles);
            toast.success(t('capsule.packing_list_copied'));
          } catch {
            toast.error(t('common.error') || 'Could not copy');
          }
        }}
        variant="editorial"
        className="mt-5 w-full"
      >
        {t('capsule.copy_packing_list')}
      </Button>
    </motion.div>
  );
}
