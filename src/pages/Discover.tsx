import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass, Shirt, Bookmark, BookmarkCheck, Trophy, Check, Sparkles, Lock,
  Search, Heart, ShoppingBag, Clock, Users, ChevronRight, User
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useGarmentCount } from '@/hooks/useGarments';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { OutfitReactions } from '@/components/social/OutfitReactions';
import { SectionHeader } from '@/components/ui/section-header';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FeedOutfit {
  id: string;
  occasion: string;
  style_vibe: string | null;
}

interface Challenge {
  id: string;
  title: string;
  description: string | null;
}

interface Participation {
  challenge_id: string;
  completed: boolean;
}

const AI_TOOLS = [
  { path: '/ai/visual-search', icon: Search, labelKey: 'ai.visual_search', color: 'bg-blue-500/10 text-blue-500' },
  { path: '/ai/mood-outfit', icon: Heart, labelKey: 'ai.mood_title', color: 'bg-pink-500/10 text-pink-500' },
  { path: '/ai/smart-shopping', icon: ShoppingBag, labelKey: 'ai.shopping_title', color: 'bg-emerald-500/10 text-emerald-500' },
  { path: '/ai/wardrobe-aging', icon: Clock, labelKey: 'ai.aging_title', color: 'bg-amber-500/10 text-amber-500' },
  { path: '/ai/style-twin', icon: Users, labelKey: 'ai.twin_title', color: 'bg-violet-500/10 text-violet-500' },
];

// Challenges unlock at these garment milestones (index = challenge order)
const UNLOCK_THRESHOLDS = [
  1, 1, 3, 3, 3, 5, 5, 5, 5, 7,
  10, 10, 10, 12, 12, 15, 15, 15, 18, 18,
  20, 20, 22, 22, 25,
];

const TRENDING_USER_THRESHOLD = 500;

export default function DiscoverPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: profile } = useProfile();
  const { data: garmentCount } = useGarmentCount();
  const navigate = useNavigate();

  // Feed state
  const [feedOutfits, setFeedOutfits] = useState<FeedOutfit[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [feedLoading, setFeedLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);

  // Challenges state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [participations, setParticipations] = useState<Record<string, Participation>>({});
  const [challengesLoading, setChallengesLoading] = useState(true);

  const myGarments = garmentCount || 0;

  // Load feed (limited preview)
  const loadFeed = useCallback(async () => {
    setFeedLoading(true);

    // Check total user count for trending gate
    const { count: userCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    setTotalUsers(userCount || 0);

    if ((userCount || 0) >= TRENDING_USER_THRESHOLD) {
      const query = supabase
        .from('outfits')
        .select('id, occasion, style_vibe, outfit_items(id, slot, garment:garments(id, image_path))')
        .eq('share_enabled', true)
        .order('generated_at', { ascending: false })
        .limit(6);

      if (user) query.neq('user_id', user.id);
      const { data } = await query;
      setFeedOutfits((data || []) as any);

      for (const outfit of (data || []) as any[]) {
        const firstItem = outfit.outfit_items?.find((i: any) => i.garment?.image_path);
        if (firstItem?.garment?.image_path) {
          const { data: urlData } = await supabase.storage.from('garments').createSignedUrl(firstItem.garment.image_path, 3600);
          if (urlData) setImageUrls(prev => ({ ...prev, [outfit.id]: urlData.signedUrl }));
        }
      }

      if (user) {
        const { data: saves } = await supabase.from('inspiration_saves').select('outfit_id').eq('user_id', user.id);
        setSavedIds(new Set(saves?.map(s => s.outfit_id) || []));
      }
    }
    setFeedLoading(false);
  }, [user]);

  // Load challenges (all 25, always active)
  const loadChallenges = useCallback(async () => {
    setChallengesLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data: chals } = await supabase
      .from('style_challenges')
      .select('id, title, description')
      .lte('week_start', today)
      .gte('week_end', today)
      .order('created_at', { ascending: true })
      .limit(25);

    setChallenges(chals || []);

    if (user && chals?.length) {
      const { data: parts } = await supabase
        .from('challenge_participations')
        .select('challenge_id, completed')
        .eq('user_id', user.id)
        .in('challenge_id', chals.map(c => c.id));
      const map: Record<string, Participation> = {};
      parts?.forEach(p => { map[p.challenge_id] = p; });
      setParticipations(map);
    }
    setChallengesLoading(false);
  }, [user]);

  useEffect(() => { loadFeed(); loadChallenges(); }, [loadFeed, loadChallenges]);

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

  const joinChallenge = async (challengeId: string) => {
    if (!user) return;
    hapticSuccess();
    const { error } = await supabase.from('challenge_participations').insert({ challenge_id: challengeId, user_id: user.id });
    if (!error) {
      setParticipations(prev => ({ ...prev, [challengeId]: { challenge_id: challengeId, completed: false } }));
      toast.success(t('challenges.joined'));
    }
  };

  return (
    <AppLayout>
      <AnimatedPage className="px-4 pb-8 pt-6 space-y-8 max-w-lg mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
            {t('discover.title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t('discover.subtitle')}</p>
        </motion.div>

        {/* ── Community Feed Preview ── */}
        <section>
          <SectionHeader
            title={t('discover.trending')}
            action={t('discover.see_all')}
            onAction={() => navigate('/feed')}
          />
          {feedLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : feedOutfits.length === 0 ? (
            <div className="text-center py-8 rounded-xl border border-dashed border-border/40">
              <Compass className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t('feed.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {feedOutfits.slice(0, 6).map((outfit, i) => (
                <motion.div
                  key={outfit.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative rounded-xl overflow-hidden border border-border/20 cursor-pointer active:scale-[0.97] transition-transform"
                  onClick={() => navigate(`/share/${outfit.id}`)}
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {imageUrls[outfit.id] ? (
                      <img src={imageUrls[outfit.id]} alt={outfit.occasion} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Shirt className="w-6 h-6 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  {user && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSave(outfit.id); }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
                    >
                      {savedIds.has(outfit.id)
                        ? <BookmarkCheck className="w-3 h-3 text-primary" />
                        : <Bookmark className="w-3 h-3 text-muted-foreground" />}
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ── Active Challenges ── */}
        <section>
          <SectionHeader
            title={t('challenges.title')}
            action={t('discover.see_all')}
            onAction={() => navigate('/challenges')}
          />
          {challengesLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-8 rounded-xl border border-dashed border-border/40">
              <Trophy className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t('challenges.none')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {challenges.map((ch, i) => {
                const part = participations[ch.id];
                return (
                  <motion.div
                    key={ch.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={cn(
                      'rounded-xl border p-3.5 flex items-center gap-3',
                      part?.completed ? 'bg-green-500/5 border-green-500/20' : 'bg-card'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">{ch.title}</h3>
                      {ch.description && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{ch.description}</p>}
                    </div>
                    {part?.completed ? (
                      <Badge className="bg-green-500 text-white border-0 shrink-0">
                        <Check className="w-3 h-3 mr-1" />{t('challenges.done')}
                      </Badge>
                    ) : !part ? (
                      <Button size="sm" variant="outline" className="rounded-xl shrink-0 h-8 text-xs" onClick={() => joinChallenge(ch.id)}>
                        <Sparkles className="w-3 h-3 mr-1" />{t('challenges.join')}
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">{t('challenges.joined_label') || 'Joined'}</Badge>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── AI Tools ── */}
        <section>
          <SectionHeader title={t('discover.ai_tools')} />
          <div className="grid grid-cols-2 gap-2.5">
            {AI_TOOLS.map((tool, i) => (
              <motion.button
                key={tool.path}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                onClick={() => { hapticLight(); navigate(tool.path); }}
                className="flex items-center gap-3 rounded-xl border border-border/20 bg-card p-3.5 text-left active:scale-[0.97] transition-transform"
              >
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', tool.color)}>
                  <tool.icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-xs font-medium leading-tight">{t(tool.labelKey)}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ── Your Profile ── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => {
              if (profile?.username) navigate(`/u/${profile.username}`);
              else navigate('/settings/account');
            }}
            className="rounded-xl border border-border/20 bg-card p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium">{t('discover.your_profile')}</h3>
              <p className="text-[11px] text-muted-foreground">
                {profile?.username ? `@${profile.username}` : t('discover.setup_profile')}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
          </motion.div>
        </section>
      </AnimatedPage>
    </AppLayout>
  );
}
