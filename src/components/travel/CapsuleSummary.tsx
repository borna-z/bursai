import { motion } from 'framer-motion';
import { Check, Shirt, LightbulbIcon } from 'lucide-react';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { EASE_CURVE, STAGGER_DELAY } from '@/lib/motion';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { toast } from 'sonner';
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
      className="space-y-5 pt-3"
    >
      {/* Packing progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${totalItems > 0 ? (packedCount / totalItems) * 100 : 0}%` }}
            transition={{ duration: 0.4, ease: EASE_CURVE }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">
          {packedCount} of {totalItems} packed
        </span>
      </div>

      {/* Category groups */}
      {Object.entries(groupedItems).map(([category, items], catIdx) => {
        const catOutfitUses = (items || []).reduce(
          (sum, g) => sum + (itemOutfitCount.get(g.id) || 0), 0
        );
        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIdx * STAGGER_DELAY, duration: 0.35 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground capitalize">
                {category} ({(items || []).length})
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {t('capsule.used_in')} {catOutfitUses} {t('capsule.outfits_label')}
              </span>
            </div>

            <div className="space-y-1">
              {(items || []).map(g => (
                <button
                  key={g.id}
                  onClick={() => toggleChecked(g.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-2.5 rounded-xl transition-all',
                    checkedItems.has(g.id)
                      ? 'bg-accent/[0.06]'
                      : 'bg-card/40 hover:bg-card/60'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
                    checkedItems.has(g.id)
                      ? 'bg-accent border-accent'
                      : 'border-border/30'
                  )}>
                    {checkedItems.has(g.id) && (
                      <Check className="w-3 h-3 text-accent-foreground" />
                    )}
                  </div>

                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                    <LazyImageSimple imagePath={getPreferredGarmentImagePath(g)} alt={g.title} className="w-full h-full" />
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <span className={cn(
                      'text-[13px] font-medium block truncate',
                      checkedItems.has(g.id)
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground'
                    )}>
                      {g.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {t('capsule.used_in')} {itemOutfitCount.get(g.id) || 0} {t('capsule.outfits_label')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Stats bar */}
      <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-muted/10">
        <Shirt className="w-3.5 h-3.5 text-muted-foreground/40" />
        <span className="text-xs text-muted-foreground/60">
          {totalItems} {t('capsule.items')} • {t('capsule.creates')} {result.outfits.length} {t('capsule.unique_outfits')}
        </span>
      </div>

      {/* Copy packing list */}
      <button
        onClick={() => {
          const garmentTitles = capsuleItemIds
            .map(id => garmentMap.get(id) ?? allGarmentsMap.get(id))
            .filter(Boolean)
            .map((g) => `- ${g!.title}`)
            .join('\n');
          navigator.clipboard.writeText(garmentTitles);
          toast.success('Packing list copied');
        }}
        className="w-full py-2.5 rounded-xl bg-[#EDE8DF] text-[13px] font-medium text-foreground hover:bg-[#E5DED4] transition-colors"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        Copy packing list
      </button>

      {/* Tips */}
      {(result.coverage_gaps?.length || 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase">
            Coverage gaps
          </h3>
          <ul className="space-y-1.5">
            {result.coverage_gaps?.map((gap) => (
              <li key={`${gap.code}-${gap.message}`} className="text-xs text-muted-foreground/70 flex gap-2">
                <span className="text-primary shrink-0">•</span>
                {gap.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.packing_tips.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide uppercase flex items-center gap-1.5">
            <LightbulbIcon className="w-3 h-3" />
            {t('capsule.tips')}
          </h3>
          <ul className="space-y-1.5">
            {result.packing_tips.map((tip, idx) => (
              <li key={idx} className="text-xs text-muted-foreground/70 flex gap-2">
                <span className="text-primary shrink-0">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
