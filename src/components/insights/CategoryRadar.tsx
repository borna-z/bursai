import { PieChart, Lock } from 'lucide-react';
import { useCategoryBalance } from '@/hooks/useAdvancedInsights';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const BAR_COLORS = [
  'bg-primary',
  'bg-blue-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-purple-500',
  'bg-amber-500',
];

export function CategoryRadar({ isPremium, className }: { isPremium: boolean; className?: string }) {
  const { t } = useLanguage();
  const { data } = useCategoryBalance();

  if (!data || data.categories.length === 0) return null;

  const maxPct = data.categories[0]?.percentage || 1;

  return (
    <div className={cn('surface-secondary space-y-4 p-4', className)}>
      <div className="flex items-center gap-2">
        <PieChart className="w-4 h-4 text-muted-foreground/50" />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {t('insights.category_balance')}
        </span>
      </div>
      <div className={cn(!isPremium && "relative")}>
        <div className={cn("space-y-3", !isPremium && "blur-sm select-none")}>
          {data.categories.map((cat, i) => (
            <div key={cat.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs capitalize text-muted-foreground">{cat.name}</span>
                <span className="text-xs tabular-nums font-medium">{cat.count} ({cat.percentage}%)</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", BAR_COLORS[i % BAR_COLORS.length])}
                  initial={{ width: 0 }}
                  animate={{ width: `${(cat.percentage / maxPct) * 100}%` }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                />
              </div>
            </div>
          ))}

          <p className="text-center text-[10px] text-muted-foreground/50 pt-1">
            {data.total} {t('insights.garments_suffix')}
          </p>
        </div>
        {!isPremium && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="w-5 h-5 text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}
