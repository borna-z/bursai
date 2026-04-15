import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { GarmentSelection } from './types';

interface Garment {
  id: string;
  title: string;
  category: string;
  image_path?: string;
}

interface GarmentSelectionPanelProps {
  allGarments: Garment[];
  value: GarmentSelection | null;
  onChange: (next: GarmentSelection | null) => void;
}

const MAX_TOTAL = 150;

const CATEGORY_ORDER = ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory'] as const;

function normalizeCategory(raw: string): string {
  const c = (raw || '').toLowerCase().trim();
  if (!c) return 'other';
  if (
    c === 'top' ||
    c === 'tops' ||
    c === 'shirt' ||
    c === 'shirts' ||
    c === 't-shirt' ||
    c === 'tshirt' ||
    c === 'tee' ||
    c === 'blouse' ||
    c === 'sweater' ||
    c === 'knitwear'
  )
    return 'top';
  if (
    c === 'bottom' ||
    c === 'bottoms' ||
    c === 'pants' ||
    c === 'trousers' ||
    c === 'jeans' ||
    c === 'shorts' ||
    c === 'skirt'
  )
    return 'bottom';
  if (c === 'dress' || c === 'dresses' || c === 'jumpsuit') return 'dress';
  if (
    c === 'shoes' ||
    c === 'shoe' ||
    c === 'footwear' ||
    c === 'sneakers' ||
    c === 'boots' ||
    c === 'sandals'
  )
    return 'shoes';
  if (
    c === 'outerwear' ||
    c === 'jacket' ||
    c === 'coat' ||
    c === 'blazer' ||
    c === 'parka'
  )
    return 'outerwear';
  if (
    c === 'accessory' ||
    c === 'accessories' ||
    c === 'bag' ||
    c === 'hat' ||
    c === 'scarf' ||
    c === 'belt' ||
    c === 'jewelry'
  )
    return 'accessory';
  return 'other';
}

function prettyLabel(category: string): string {
  if (!category) return '';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function sortCategories(categories: string[]): string[] {
  const ordered: string[] = [];
  for (const k of CATEGORY_ORDER) {
    if (categories.includes(k)) ordered.push(k);
  }
  const extras = categories
    .filter((c) => !CATEGORY_ORDER.includes(c as typeof CATEGORY_ORDER[number]) && c !== 'other')
    .sort();
  ordered.push(...extras);
  if (categories.includes('other')) ordered.push('other');
  return ordered;
}

export function GarmentSelectionPanel({
  allGarments,
  value,
  onChange,
}: GarmentSelectionPanelProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of allGarments) {
      const norm = normalizeCategory(g.category);
      counts[norm] = (counts[norm] ?? 0) + 1;
    }
    return counts;
  }, [allGarments]);

  const orderedCategories = useMemo(
    () => sortCategories(Object.keys(categoryCounts).filter((k) => categoryCounts[k] > 0)),
    [categoryCounts],
  );

  // Current selection values per category.
  const currentSelection = useMemo<GarmentSelection>(() => {
    const next: GarmentSelection = {};
    for (const cat of orderedCategories) {
      const max = categoryCounts[cat] ?? 0;
      if (value && typeof value[cat] === 'number') {
        next[cat] = Math.max(0, Math.min(max, value[cat]));
      } else {
        next[cat] = max;
      }
    }
    return next;
  }, [orderedCategories, categoryCounts, value]);

  const totalGarments = allGarments.length;
  const rawRunningTotal = useMemo(
    () => Object.values(currentSelection).reduce((sum, n) => sum + n, 0),
    [currentSelection],
  );
  const actualUsed = Math.min(rawRunningTotal, MAX_TOTAL);
  const isCapped = rawRunningTotal > MAX_TOTAL || totalGarments > MAX_TOTAL;

  const summaryText = `Using ${actualUsed} of ${totalGarments} garments`;
  const translatedSummary = t('capsule.using_x_of_y');
  const summaryLabel =
    translatedSummary && translatedSummary !== 'capsule.using_x_of_y'
      ? translatedSummary
      : summaryText;

  const translatedHeader = t('capsule.customize_selection');
  const headerLabel =
    translatedHeader && translatedHeader !== 'capsule.customize_selection'
      ? translatedHeader
      : 'Customize selection';

  const handleToggle = () => {
    hapticLight();
    setOpen((o) => !o);
  };

  const handleSliderChange = (category: string, nextValue: number) => {
    const max = categoryCounts[category] ?? 0;
    const clamped = Math.max(0, Math.min(max, nextValue));
    const nextSelection: GarmentSelection = { ...currentSelection, [category]: clamped };
    onChange(nextSelection);
  };

  const handleReset = () => {
    hapticLight();
    onChange(null);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-3 py-1 text-left"
        aria-expanded={open}
      >
        <div className="flex flex-col gap-1">
          <span className="label-editorial">{headerLabel}</span>
          <span className="text-sm text-muted-foreground">{summaryLabel}</span>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-1">
              {orderedCategories.map((cat) => {
                const max = categoryCounts[cat] ?? 0;
                const current = currentSelection[cat] ?? 0;
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{prettyLabel(cat)}</span>
                      <span className="text-muted-foreground">
                        {current} of {max}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={max}
                      value={current}
                      onChange={(e) => handleSliderChange(cat, Number(e.target.value))}
                      aria-label={`${prettyLabel(cat)} count`}
                      className="h-1 w-full accent-accent"
                    />
                  </div>
                );
              })}

              {isCapped && (
                <p className="text-xs text-muted-foreground">
                  {t('capsule.cap_warning') === 'capsule.cap_warning'
                    ? 'Maximum 150 — reduce a category to send more.'
                    : t('capsule.cap_warning')}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs underline text-muted-foreground hover:text-foreground"
                >
                  {t('capsule.reset') === 'capsule.reset' ? 'Reset' : t('capsule.reset')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
