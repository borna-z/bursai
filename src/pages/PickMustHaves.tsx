import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { PageIntro } from '@/components/ui/page-intro';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { cn } from '@/lib/utils';

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
    if (category) items = items.filter((garment) => garment.category.toLowerCase() === category);
    if (search) {
      const query = search.toLowerCase();
      items = items.filter((garment) =>
        garment.title.toLowerCase().includes(query)
        || garment.category.toLowerCase().includes(query)
        || garment.color_primary.toLowerCase().includes(query),
      );
    }
    return items;
  }, [allGarments, category, search]);

  const toggle = (id: string) => {
    hapticLight();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = () => {
    hapticSuccess();
    const { mustHaveItems: _drop, ...rest } = incomingState ?? {};
    navigate('/plan/travel-capsule', {
      state: { ...rest, mustHaveItems: Array.from(selected) },
      replace: true,
    });
  };

  return (
    <AppLayout hideNav>
      <PageHeader
        title={t('capsule.pick_must_haves')}
        subtitle={selected.size > 0 ? t('capsule.n_selected').replace('{n}', String(selected.size)) : 'Choose the pieces this trip should revolve around.'}
        showBack
        actions={<Button size="sm" onClick={handleDone}>{t('capsule.done')}</Button>}
      />

      <AnimatedPage className="page-shell !px-5 !pb-36 !pt-6 page-cluster">
        <PageIntro
          eyebrow="Travel capsule"
          meta={<span className="eyebrow-chip !bg-secondary/70">{selected.size} selected</span>}
          title="Pick the pieces the trip should start from."
          description="Lock in the garments you already know belong in the suitcase, then let BURS build the rest of the capsule around them."
        />

        <Card surface="utility" className="space-y-4 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder={t('wardrobe.search')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 rounded-[1.2rem] bg-background/85 pl-9"
            />
            {search ? (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            ) : null}
          </div>

          <div className="app-chip-row">
            <Chip selected={!category} onClick={() => { hapticLight(); setCategory(null); }} size="sm">
              {t('filter.all')}
            </Chip>
            {CATEGORIES.map((item) => (
              <Chip
                key={item.id}
                selected={category === item.id}
                onClick={() => {
                  hapticLight();
                  setCategory(category === item.id ? null : item.id);
                }}
                size="sm"
              >
                {t(item.labelKey)}
              </Chip>
            ))}
          </div>
        </Card>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((garment) => {
            const isSelected = selected.has(garment.id);

            return (
              <button key={garment.id} type="button" onClick={() => toggle(garment.id)} className="text-left">
                <Card
                  surface="utility"
                  className={cn(
                    'overflow-hidden p-2 transition-all',
                    isSelected ? 'border-foreground/30 shadow-[0_16px_34px_rgba(28,25,23,0.08)]' : '',
                  )}
                >
                  <div className="relative overflow-hidden rounded-[1.25rem]">
                    <LazyImageSimple
                      imagePath={getPreferredGarmentImagePath(garment)}
                      alt={garment.title}
                      className="aspect-[3/4] w-full object-cover"
                    />
                    {isSelected ? (
                      <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground shadow-[0_8px_18px_rgba(28,25,23,0.12)]">
                        <Check className="h-4 w-4 text-background" />
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1 px-1 pb-1 pt-3">
                    <p className="text-[0.82rem] font-medium leading-5 text-foreground">{garment.title}</p>
                    <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">{garment.category}</p>
                  </div>
                </Card>
              </button>
            );
          })}
        </section>

        {filtered.length === 0 ? (
          <Card surface="inset" className="p-8 text-center text-sm text-muted-foreground">
            {t('wardrobe.empty')}
          </Card>
        ) : null}
      </AnimatedPage>

      {selected.size > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-20" style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto max-w-md">
            <div className="action-bar-floating rounded-[1.6rem] p-3">
              <Button onClick={handleDone} size="lg" className="w-full">
                {t('capsule.done')} ({selected.size})
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
