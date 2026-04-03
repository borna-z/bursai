import { motion } from 'framer-motion';
import { Check, LightbulbIcon, Shirt } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
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
      className="space-y-4 pt-3"
    >
      <div className="space-y-4 border-b border-border/28 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label-editorial">Packing Progress</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {packedCount} of {totalItems} packed
            </p>
          </div>
          <span className="eyebrow-chip !bg-secondary/70">
            {result.outfits.length} outfits
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${totalItems > 0 ? (packedCount / totalItems) * 100 : 0}%` }}
            transition={{ duration: 0.4, ease: EASE_CURVE }}
          />
        </div>
      </div>

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
          >
            <div className="space-y-3 border-t border-border/24 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-editorial">{category}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {(items || []).length} pieces, {t('capsule.used_in').toLowerCase()} {categoryOutfitUses} {t('capsule.outfits_label')}
                  </p>
                </div>
                <span className="eyebrow-chip !bg-secondary/70">{(items || []).length}</span>
              </div>

              <div className="space-y-2">
                {(items || []).map((garment) => (
                  <button
                    key={garment.id}
                    onClick={() => toggleChecked(garment.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[1.2rem] border border-border/30 p-3 text-left transition-all',
                      checkedItems.has(garment.id)
                        ? 'border-accent/25 bg-accent/5'
                        : 'hover:bg-secondary/35',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all',
                        checkedItems.has(garment.id)
                          ? 'border-accent bg-accent'
                          : 'border-border/50',
                      )}
                    >
                      {checkedItems.has(garment.id) ? (
                        <Check className="h-3 w-3 text-accent-foreground" />
                      ) : null}
                    </div>

                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[0.95rem] bg-muted/30">
                      <LazyImageSimple
                        imagePath={getPreferredGarmentImagePath(garment)}
                        alt={garment.title}
                        className="h-full w-full"
                      />
                    </div>

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
              </div>
            </div>
          </motion.div>
        );
      })}

      <div className="flex items-center justify-center gap-2 border-t border-border/24 px-2 pt-4">
        <Shirt className="h-3.5 w-3.5 text-muted-foreground/40" />
        <span className="text-xs text-muted-foreground/60">
          {totalItems} {t('capsule.items')} - {t('capsule.creates')} {result.outfits.length} {t('capsule.unique_outfits')}
        </span>
      </div>

      <Button
        onClick={() => {
          const garmentTitles = capsuleItemIds
            .map((id) => garmentMap.get(id) ?? allGarmentsMap.get(id))
            .filter(Boolean)
            .map((garment) => `- ${garment!.title}`)
            .join('\n');

          navigator.clipboard.writeText(garmentTitles);
          toast.success('Packing list copied');
        }}
        variant="editorial"
        className="w-full"
      >
        Copy packing list
      </Button>

      {(result.coverage_gaps?.length || 0) > 0 ? (
        <div className="space-y-3 border-t border-border/24 pt-4">
          <h3 className="label-editorial">Coverage Gaps</h3>
          <ul className="space-y-1.5">
            {result.coverage_gaps?.map((gap) => (
              <li key={`${gap.code}-${gap.message}`} className="flex gap-2 text-xs text-muted-foreground/70">
                <span className="shrink-0 text-primary">-</span>
                {gap.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.packing_tips.length > 0 ? (
        <div className="space-y-3 border-t border-border/24 pt-4">
          <h3 className="label-editorial flex items-center gap-1.5">
            <LightbulbIcon className="h-3 w-3" />
            {t('capsule.tips')}
          </h3>
          <ul className="space-y-1.5">
            {result.packing_tips.map((tip, index) => (
              <li key={index} className="flex gap-2 text-xs text-muted-foreground/70">
                <span className="shrink-0 text-primary">-</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </motion.div>
  );
}
