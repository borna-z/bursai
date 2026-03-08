import { useNavigate } from 'react-router-dom';
import { Repeat, Clock, Lock } from 'lucide-react';
import { useOutfitRepeats } from '@/hooks/useAdvancedInsights';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function OutfitRepeatTracker({ isPremium }: { isPremium: boolean }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data } = useOutfitRepeats();

  if (!data || (data.repeats.length === 0 && data.staleOutfits.length === 0)) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Repeat className="w-4 h-4 text-muted-foreground/50" />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {t('insights.repeat_tracker')}
        </span>
      </div>
      <div className={cn(!isPremium && "relative")}>
        <div className={cn("space-y-5", !isPremium && "blur-sm select-none")}>
          {/* Most repeated */}
          {data.repeats.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {t('insights.most_repeated')}
              </span>
              {data.repeats.map(o => (
                <div
                  key={o.id}
                  className="flex items-center gap-3 py-2 cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => navigate(`/outfits/${o.id}`)}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Repeat className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate capitalize">{o.occasion}</p>
                    <p className="text-[11px] text-muted-foreground">{o.daysSince}d {t('insights.ago')}</p>
                  </div>
                  <Badge variant="secondary" className="tabular-nums text-xs font-semibold">{o.wornCount}×</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Stale outfits */}
          {data.staleOutfits.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {t('insights.stale_outfits')}
              </span>
              {data.staleOutfits.slice(0, 3).map(o => (
                <div
                  key={o.id}
                  className="flex items-center gap-3 py-2 cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => navigate(`/outfits/${o.id}`)}
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate capitalize">{o.occasion}</p>
                    <p className="text-[11px] text-orange-500 font-medium">{o.daysSince}+ {t('insights.days_unused')}</p>
                  </div>
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
