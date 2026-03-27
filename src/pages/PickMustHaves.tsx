import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Search, X } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

const CATEGORIES = [
  { id: 'top', labelKey: 'filter.tops' },
  { id: 'bottom', labelKey: 'filter.bottoms' },
  { id: 'outerwear', labelKey: 'filter.outerwear' },
  { id: 'shoes', labelKey: 'filter.shoes' },
  { id: 'dress', labelKey: 'filter.dresses' },
  { id: 'accessory', labelKey: 'filter.accessories' },
];

export default function PickMustHaves() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: allGarments } = useQuery({
    queryKey: ['all-garments-picker', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('garments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const incomingState = location.state as Record<string, unknown> | null;
  const initialIds: string[] = (incomingState?.mustHaveItems as string[] | undefined) ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let items = allGarments ?? [];
    if (category) items = items.filter(g => g.category.toLowerCase() === category);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(g =>
        g.title.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.color_primary.toLowerCase().includes(q)
      );
    }
    return items;
  }, [allGarments, category, search]);

  const toggle = (id: string) => {
    hapticLight();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = () => {
    hapticSuccess();
    // Forward all state back so TravelCapsule can restore form fields
    const { mustHaveItems: _drop, ...rest } = incomingState ?? {};
    navigate('/plan/travel-capsule', {
      state: { ...rest, mustHaveItems: Array.from(selected) },
      replace: true,
    });
  };

  return (
    <AnimatedPage className="flex flex-col min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/10">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted/30 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold">{t('capsule.pick_must_haves')}</h1>
            {selected.size > 0 && (
              <p className="text-xs text-primary font-medium">
                {t('capsule.n_selected').replace('{n}', String(selected.size))}
              </p>
            )}
          </div>
          <Button size="sm" onClick={handleDone} className="rounded-xl">
            {t('capsule.done')}
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2 max-w-lg mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
              placeholder={t('wardrobe.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-card/60 border-border/15"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 max-w-lg mx-auto scrollbar-hide">
          <Chip
            selected={!category}
            onClick={() => { hapticLight(); setCategory(null); }}
            size="sm"
          >
            {t('filter.all')}
          </Chip>
          {CATEGORIES.map(c => (
            <Chip
              key={c.id}
              selected={category === c.id}
              onClick={() => { hapticLight(); setCategory(category === c.id ? null : c.id); }}
              size="sm"
            >
              {t(c.labelKey)}
            </Chip>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 pt-3 pb-24 max-w-lg mx-auto w-full">
        <div className="grid grid-cols-3 gap-1.5">
          {filtered.map(g => {
            const isSelected = selected.has(g.id);
            return (
              <button
                key={g.id}
                onClick={() => toggle(g.id)}
                className={cn(
                  'relative rounded-xl overflow-hidden border transition-all',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border/10'
                )}
              >
                <div className="aspect-[3/4] bg-muted/20">
                  <LazyImageSimple
                    imagePath={getPreferredGarmentImagePath(g)}
                    alt={g.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                    <Check className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                )}
                <div className="px-1.5 py-1">
                  <p className="text-[10px] text-muted-foreground truncate">{g.title}</p>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {t('wardrobe.empty')}
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-4 bg-background/80 backdrop-blur-lg border-t border-border/10">
          <div className="max-w-lg mx-auto">
            <Button onClick={handleDone} className="w-full h-12 rounded-xl">
              {t('capsule.done')} ({selected.size})
            </Button>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
