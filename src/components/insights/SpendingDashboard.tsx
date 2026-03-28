import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingDown, TrendingUp, Lock } from 'lucide-react';
import { useSpendingData } from '@/hooks/useAdvancedInsights';
import { useLanguage } from '@/contexts/LanguageContext';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function SpendingDashboard({ isPremium, className }: { isPremium: boolean; className?: string }) {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { data } = useSpendingData(locale);

  if (!data) return null;

  const maxCatTotal = data.categoryBreakdown[0]?.total || 1;

  return (
    <div className={cn('surface-secondary space-y-4 p-4', className)}>
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-muted-foreground/50" />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {t('insights.spending')}
        </span>
      </div>
      <div className={cn(!isPremium && "relative")}>
        <div className={cn("space-y-5", !isPremium && "blur-sm select-none")}>
          {/* Total value */}
          <div className="text-center py-3">
            <span className="text-4xl font-bold tabular-nums">{data.totalValue.toLocaleString()}</span>
            <span className="text-lg text-muted-foreground/60 ml-1">{data.currency}</span>
            <p className="text-xs text-muted-foreground mt-1">{t('insights.total_value')}</p>
          </div>

          {/* Category bars */}
          <div className="space-y-2.5">
            {data.categoryBreakdown.slice(0, 5).map((cat, i) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs capitalize text-muted-foreground">{cat.category}</span>
                  <span className="text-xs tabular-nums font-medium">
                    {cat.total.toLocaleString()} {data.currency}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.total / maxCatTotal) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Best CPW */}
          {data.topCostPerWear.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {t('insights.best_cpw')}
                </span>
              </div>
              {data.topCostPerWear.map(g => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 py-2 cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => navigate(`/wardrobe/${g.id}`)}
                >
                  <LazyImageSimple imagePath={getPreferredGarmentImagePath(g)} alt={g.title} className="w-10 h-12 rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.title}</p>
                    <p className="text-[11px] text-muted-foreground">{g.wears}× {t('insights.worn_lc')}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-500 tabular-nums">
                    {g.cpw} {data.currency}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Worst CPW */}
          {data.worstCostPerWear.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {t('insights.worst_cpw')}
                </span>
              </div>
              {data.worstCostPerWear.map(g => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 py-2 cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => navigate(`/wardrobe/${g.id}`)}
                >
                  <LazyImageSimple imagePath={getPreferredGarmentImagePath(g)} alt={g.title} className="w-10 h-12 rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.title}</p>
                    <p className="text-[11px] text-muted-foreground">{g.wears}× {t('insights.worn_lc')}</p>
                  </div>
                  <span className="text-sm font-semibold text-orange-500 tabular-nums">
                    {g.cpw} {data.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
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
