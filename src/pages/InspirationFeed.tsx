import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Shirt, Bookmark, BookmarkCheck, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { OutfitReactions } from '@/components/social/OutfitReactions';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FeedOutfit {
  id: string;
  occasion: string;
  style_vibe: string | null;
  explanation: string | null;
  generated_at: string | null;
}

const OCCASIONS = ['casual', 'work', 'formal', 'date', 'party', 'sport'];

export default function InspirationFeed() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [outfits, setOutfits] = useState<FeedOutfit[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('outfits')
      .select('id, occasion, style_vibe, explanation, generated_at, outfit_items(id, slot, garment:garments(id, image_path))')
      .eq('share_enabled', true)
      .order('generated_at', { ascending: false })
      .limit(20);

    if (filter) query = query.eq('occasion', filter);
    // Exclude own outfits
    if (user) query = query.neq('user_id', user.id);

    const { data } = await query;
    setOutfits((data || []) as any);

    // Load first image per outfit
    for (const outfit of (data || []) as any[]) {
      const firstItem = outfit.outfit_items?.find((i: any) => i.garment?.image_path);
      if (firstItem?.garment?.image_path) {
        const { data: urlData } = await supabase.storage.from('garments').createSignedUrl(firstItem.garment.image_path, 3600);
        if (urlData) setImageUrls(prev => ({ ...prev, [outfit.id]: urlData.signedUrl }));
      }
    }

    // Load user's saves
    if (user) {
      const { data: saves } = await supabase
        .from('inspiration_saves')
        .select('outfit_id')
        .eq('user_id', user.id);
      setSavedIds(new Set(saves?.map(s => s.outfit_id) || []));
    }

    setLoading(false);
  }, [filter, user]);

  useEffect(() => { load(); }, [load]);

  const toggleSave = async (outfitId: string) => {
    if (!user) return;
    hapticLight();
    if (savedIds.has(outfitId)) {
      await supabase.from('inspiration_saves').delete().eq('user_id', user.id).eq('outfit_id', outfitId);
      setSavedIds(prev => { const n = new Set(prev); n.delete(outfitId); return n; });
    } else {
      await supabase.from('inspiration_saves').insert({ user_id: user.id, outfit_id: outfitId });
      setSavedIds(prev => new Set(prev).add(outfitId));
      toast.success(t('feed.saved'));
    }
  };

  return (
    <AppLayout>
      <PageHeader title={t('feed.title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">
        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
          <Badge
            variant={filter === null ? 'default' : 'secondary'}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setFilter(null)}
          >
            {t('feed.all')}
          </Badge>
          {OCCASIONS.map(o => (
            <Badge
              key={o}
              variant={filter === o ? 'default' : 'secondary'}
              className="cursor-pointer capitalize whitespace-nowrap"
              onClick={() => setFilter(o)}
            >
              {t(`occasion.${o}`)}
            </Badge>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : outfits.length === 0 ? (
          <div className="text-center py-16">
            <Compass className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('feed.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {outfits.map(outfit => (
              <div
                key={outfit.id}
                className="rounded-xl overflow-hidden border bg-card cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/share/${outfit.id}`)}
              >
                <div className="aspect-square bg-muted overflow-hidden relative">
                  {imageUrls[outfit.id] ? (
                    <img src={imageUrls[outfit.id]} alt={outfit.occasion} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Shirt className="w-8 h-8 text-muted-foreground/20" />
                    </div>
                  )}
                  {/* Save button */}
                  {user && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSave(outfit.id); }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
                    >
                      {savedIds.has(outfit.id)
                        ? <BookmarkCheck className="w-4 h-4 text-primary" />
                        : <Bookmark className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  )}
                </div>
                <div className="p-2.5 space-y-1.5">
                  <Badge variant="secondary" className="text-[10px] capitalize">{outfit.occasion}</Badge>
                  {outfit.style_vibe && (
                    <p className="text-[11px] text-muted-foreground truncate">{outfit.style_vibe}</p>
                  )}
                  <OutfitReactions outfitId={outfit.id} compact />
                </div>
              </div>
            ))}
          </div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
