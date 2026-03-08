import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

const REACTIONS = [
  { key: 'styled', emoji: '🔥', labelKey: 'reaction.styled' },
  { key: 'creative', emoji: '💎', labelKey: 'reaction.creative' },
  { key: 'sustainable', emoji: '🌿', labelKey: 'reaction.sustainable' },
] as const;

interface Props {
  outfitId: string;
  compact?: boolean;
}

export function OutfitReactions({ outfitId, compact }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('outfit_reactions')
        .select('reaction, user_id')
        .eq('outfit_id', outfitId);

      if (!data) return;
      const c: Record<string, number> = {};
      const mine = new Set<string>();
      data.forEach(r => {
        c[r.reaction] = (c[r.reaction] || 0) + 1;
        if (r.user_id === user?.id) mine.add(r.reaction);
      });
      setCounts(c);
      setUserReactions(mine);
    };
    load();
  }, [outfitId, user?.id]);

  const toggle = async (reaction: string) => {
    if (!user) return;
    hapticLight();

    if (userReactions.has(reaction)) {
      await supabase
        .from('outfit_reactions')
        .delete()
        .eq('outfit_id', outfitId)
        .eq('user_id', user.id)
        .eq('reaction', reaction);

      setUserReactions(prev => { const n = new Set(prev); n.delete(reaction); return n; });
      setCounts(prev => ({ ...prev, [reaction]: Math.max(0, (prev[reaction] || 1) - 1) }));
    } else {
      await supabase
        .from('outfit_reactions')
        .insert({ outfit_id: outfitId, user_id: user.id, reaction });

      setUserReactions(prev => new Set(prev).add(reaction));
      setCounts(prev => ({ ...prev, [reaction]: (prev[reaction] || 0) + 1 }));
    }
  };

  return (
    <div className={cn("flex gap-1.5", compact ? "mt-1" : "mt-2")}>
      {REACTIONS.map(r => {
        const count = counts[r.key] || 0;
        const active = userReactions.has(r.key);
        if (compact && count === 0 && !active) return null;

        return (
          <button
            key={r.key}
            onClick={(e) => { e.stopPropagation(); toggle(r.key); }}
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full border transition-all active:scale-95",
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
              active
                ? "border-primary/30 bg-primary/10"
                : "border-border/40 bg-muted/30 hover:bg-muted/60"
            )}
            title={t(r.labelKey)}
          >
            <span>{r.emoji}</span>
            {count > 0 && <span className="tabular-nums text-muted-foreground">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
