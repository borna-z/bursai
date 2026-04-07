import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertCircle, Gem, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';
import type { Garment } from '@/hooks/useInsights';

interface WardrobeHealthCardProps {
  garments: Garment[];
  usedGarments: (Garment & { wearCountLast30: number })[];
  unusedGarments: Garment[];
  className?: string;
}

interface Insight {
  icon: React.ElementType;
  label: string;
  detail: string;
  severity: 'info' | 'positive' | 'warning';
}

const SEASON_LABELS = ['spring', 'summer', 'fall', 'winter'];

export function WardrobeHealthCard({ garments, usedGarments, unusedGarments, className }: WardrobeHealthCardProps) {

  const insights = useMemo(() => {
    const result: Insight[] = [];
    if (garments.length < 5) return result;

    // 1. Category balance
    const catCounts: Record<string, number> = {};
    for (const g of garments) {
      const cat = g.category?.toLowerCase() || 'other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    const topsCat = (catCounts['tops'] || 0) + (catCounts['t-shirts'] || 0) + (catCounts['shirts'] || 0) + (catCounts['blouses'] || 0);
    const bottomsCat = (catCounts['bottoms'] || 0) + (catCounts['pants'] || 0) + (catCounts['jeans'] || 0) + (catCounts['skirts'] || 0) + (catCounts['shorts'] || 0);
    const outerwearCat = (catCounts['outerwear'] || 0) + (catCounts['jackets'] || 0) + (catCounts['coats'] || 0);
    const shoesCat = (catCounts['shoes'] || 0) + (catCounts['sneakers'] || 0) + (catCounts['boots'] || 0);

    if (topsCat > 0 && bottomsCat > 0 && topsCat / bottomsCat > 3) {
      result.push({
        icon: AlertCircle,
        label: 'Bottom-heavy on tops',
        detail: `${topsCat} tops vs ${bottomsCat} bottoms — adding pants or skirts would expand combinations.`,
        severity: 'warning',
      });
    }
    if (outerwearCat === 0 && garments.length >= 10) {
      result.push({
        icon: AlertCircle,
        label: 'No outerwear',
        detail: 'A structured jacket or coat would unlock layered outfit possibilities.',
        severity: 'warning',
      });
    }
    if (shoesCat <= 1 && garments.length >= 10) {
      result.push({
        icon: AlertCircle,
        label: 'Limited footwear',
        detail: 'One more pair of shoes would give your outfits more range.',
        severity: 'warning',
      });
    }

    // 2. Seasonal coverage
    const seasonCoverage: Record<string, number> = { spring: 0, summer: 0, fall: 0, winter: 0 };
    for (const g of garments) {
      for (const tag of g.season_tags || []) {
        const lower = tag.toLowerCase();
        if (lower in seasonCoverage) seasonCoverage[lower]++;
      }
    }
    const weakSeasons = SEASON_LABELS.filter(s => seasonCoverage[s] < 3);
    if (weakSeasons.length > 0 && garments.length >= 10) {
      result.push({
        icon: TrendingDown,
        label: `Thin coverage: ${weakSeasons.join(', ')}`,
        detail: `Only ${weakSeasons.map(s => `${seasonCoverage[s]} ${s}`).join(', ')} pieces — seasonal gaps limit daily options.`,
        severity: 'warning',
      });
    }

    // 3. Over-relied staples
    const overWorn = usedGarments.filter(g => g.wearCountLast30 >= 8);
    if (overWorn.length > 0) {
      result.push({
        icon: TrendingUp,
        label: `${overWorn.length} piece${overWorn.length > 1 ? 's' : ''} on heavy rotation`,
        detail: `${overWorn.map(g => g.title).slice(0, 2).join(', ')} — great staples, but spreading wear extends garment life.`,
        severity: 'info',
      });
    }

    // 4. Underused gems
    if (unusedGarments.length > garments.length * 0.5 && garments.length >= 8) {
      result.push({
        icon: Gem,
        label: `${Math.round(unusedGarments.length / garments.length * 100)}% of wardrobe unused`,
        detail: 'Over half your pieces haven\'t been worn recently. Let me help resurface them.',
        severity: 'warning',
      });
    } else if (unusedGarments.length > 5) {
      result.push({
        icon: Gem,
        label: `${unusedGarments.length} forgotten pieces`,
        detail: 'These haven\'t been worn in 30 days — they could add fresh variety.',
        severity: 'info',
      });
    }

    // 5. Positive: well-rounded
    if (result.filter(r => r.severity === 'warning').length === 0 && garments.length >= 15) {
      result.push({
        icon: TrendingUp,
        label: 'Well-balanced wardrobe',
        detail: 'Good category coverage and rotation — you\'re making the most of what you own.',
        severity: 'positive',
      });
    }

    return result.slice(0, 4);
  }, [garments, usedGarments, unusedGarments]);

  if (insights.length === 0) return null;

  return (
    <div className={cn('surface-secondary space-y-3 p-4', className)}>
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-muted-foreground/50" />
        <span className="label-editorial">Wardrobe health</span>
      </div>
      <div className="space-y-2">
        {insights.map((insight, idx) => {
          const Icon = insight.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.08, ease: EASE_CURVE }}
              className={cn(
                'flex items-start gap-3 p-3.5 rounded-xl transition-colors',
                insight.severity === 'warning' && 'bg-warning/5 border border-warning/10',
                insight.severity === 'positive' && 'bg-success/5 border border-success/10',
                insight.severity === 'info' && 'bg-muted/40',
              )}
            >
              <Icon className={cn(
                'w-4 h-4 mt-0.5 shrink-0',
                insight.severity === 'warning' && 'text-warning',
                insight.severity === 'positive' && 'text-success',
                insight.severity === 'info' && 'text-muted-foreground/60',
              )} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground leading-tight">{insight.label}</p>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-0.5">{insight.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
