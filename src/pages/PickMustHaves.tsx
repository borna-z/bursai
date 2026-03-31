import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Search, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { LazyImageSimple } from '@/components/ui/lazy-image';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM, DISTANCE } from '@/lib/motion';

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
  const prefersReduced = useReducedMotion();

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

  const motionProps = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: DISTANCE.md }, animate: { opacity: 1, y: 0 } };

  return (
    <AppLayout hideNav>
      <PageHeader
        title={t('capsule.pick_must_haves')}
        titleClassName="font-display italic"
        subtitle={selected.size > 0 ? t('capsule.n_selected').replace('{n}', String(selected.size)) : undefined}
        showBack
        actions={
          <Button
            size="sm"
            className="rounded-full"
            onClick={handleDone}
          >
            {t('capsule.done')}
          </Button>
        }
      />

      <AnimatedPage className="page-shell !px-5 !pb-36 !pt-6 page-cluster">
        {/* Editorial heading */}
        <motion.section
          {...motionProps}
          transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM }}
          className="space-y-2"
        >
          <h1 className="font-display italic text-[1.5rem] leading-tight text-foreground">
            {t('pickmust.title') || 'Items you can\'t leave without'}
          </h1>
          <p className="font-body text-sm leading-6 text-muted-foreground">
            Select the essential foundation pieces for your curated capsule wardrobe.
          </p>
        </motion.section>

        {/* Search + filters */}
        <motion.div
          {...motionProps}
          transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: 0.04 }}
        >
          <Card className="space-y-4 rounded-[1.25rem] p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                placeholder={t('wardrobe.search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 bg-background/85 pl-9 rounded-full"
              />
              {search ? (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : null}
            </div>

            <div className="app-chip-row">
              <Chip
                selected={!category}
                onClick={() => { hapticLight(); setCategory(null); }}
                size="sm"
              >
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
        </motion.div>

        {/* Garment grid */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((garment, index) => {
            const isSelected = selected.has(garment.id);

            return (
              <motion.button
                key={garment.id}
                type="button"
                {...(prefersReduced
                  ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
                  : { initial: { opacity: 0, y: DISTANCE.sm }, animate: { opacity: 1, y: 0 } }
                )}
                transition={{
                  delay: Math.min(index, 8) * STAGGER_DELAY,
                  ease: EASE_CURVE,
                  duration: DURATION_MEDIUM,
                }}
                whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                onClick={() => toggle(garment.id)}
                className="text-left"
              >
                <Card
                  className={cn(
                    'overflow-hidden rounded-[1.25rem] p-2 transition-all',
                    isSelected ? 'ring-2 ring-foreground/20 shadow-[0_16px_34px_rgba(28,25,23,0.08)]' : '',
                  )}
                >
                  <div className="relative overflow-hidden rounded-[1rem]">
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
                    <p className="font-body text-[0.82rem] font-medium leading-5 text-foreground line-clamp-1">
                      {garment.title}
                    </p>
                    <p className="label-editorial text-muted-foreground/60 text-[0.65rem] uppercase tracking-[0.16em]">
                      {garment.category}
                    </p>
                  </div>
                </Card>
              </motion.button>
            );
          })}
        </section>

        {filtered.length === 0 ? (
          <Card className="rounded-[1.25rem] p-8 text-center">
            <p className="font-body text-sm text-muted-foreground">
              {t('wardrobe.empty')}
            </p>
          </Card>
        ) : null}
      </AnimatedPage>

      {/* Floating bottom action bar */}
      {selected.size > 0 ? (
        <div className="bottom-safe-nav fixed inset-x-4 z-20">
          <div className="mx-auto max-w-md">
            <div className="action-bar-floating rounded-[1.25rem] p-3">
              <Button
                onClick={() => { hapticLight(); handleDone(); }}
                size="lg"
                className="w-full rounded-full"
              >
                {t('capsule.done')} ({selected.size})
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
