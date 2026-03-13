import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarmentCount } from '@/hooks/useGarments';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticSuccess, hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
import { toast } from 'sonner';

import { DiscoverChallenges } from '@/components/discover/DiscoverChallenges';
import { WardrobeGapSection } from '@/components/discover/WardrobeGapSection';

interface Challenge {
  id: string;
  title: string;
  description: string | null;
}

interface Participation {
  challenge_id: string;
  completed: boolean;
}

const UNLOCK_THRESHOLDS = [
  1, 1, 3, 3, 3, 5, 5, 5, 5, 7,
  10, 10, 10, 12, 12, 15, 15, 15, 18, 18,
  20, 20, 22, 22, 25,
];

export default function DiscoverPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: garmentCount } = useGarmentCount();

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [participations, setParticipations] = useState<Record<string, Participation>>({});
  const [challengesLoading, setChallengesLoading] = useState(true);

  const myGarments = garmentCount || 0;

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

  useEffect(() => { loadChallenges(); }, [loadChallenges]);

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
      <AnimatedPage className="px-4 pb-24 pt-8 space-y-8 max-w-lg mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_CURVE }}
          className="space-y-1"
        >
          <h1 className="text-xl font-semibold tracking-tight text-foreground" style={{ fontFamily: "'Sora', sans-serif" }}>
            {t('discover.title')}
          </h1>
          <p className="text-[12px] text-muted-foreground/60">{t('discover.subtitle_new')}</p>
        </motion.div>

        {/* ── Challenges ── */}
        <DiscoverChallenges
          challenges={challenges}
          participations={participations}
          garmentCount={myGarments}
          thresholds={UNLOCK_THRESHOLDS}
          loading={challengesLoading}
          onJoin={joinChallenge}
        />

        {/* ── Wardrobe Gap Analysis ── */}
        <WardrobeGapSection />

        {/* ── Mood Outfit — inline card ── */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: EASE_CURVE }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { hapticLight(); navigate('/ai/mood-outfit'); }}
          className="w-full relative overflow-hidden rounded-xl border border-border/10 bg-card/60 p-5 text-left flex items-center gap-4 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-medium text-foreground leading-tight">
              {t('discover.tool_mood')}
            </h4>
            <p className="text-[11px] text-muted-foreground/60 leading-snug mt-0.5">
              {t('discover.tool_mood_desc')}
            </p>
          </div>
        </motion.button>
      </AnimatedPage>
    </AppLayout>
  );
}
