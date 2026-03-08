import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticSuccess } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  week_start: string;
  week_end: string;
}

interface Participation {
  challenge_id: string;
  completed: boolean;
}

export default function StyleChallenges() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [participations, setParticipations] = useState<Record<string, Participation>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data: chals } = await supabase
        .from('style_challenges')
        .select('*')
        .lte('week_start', today)
        .gte('week_end', today)
        .order('week_start', { ascending: false });

      setChallenges(chals || []);

      if (user && chals && chals.length > 0) {
        const { data: parts } = await supabase
          .from('challenge_participations')
          .select('challenge_id, completed')
          .eq('user_id', user.id)
          .in('challenge_id', chals.map(c => c.id));

        const partMap: Record<string, Participation> = {};
        parts?.forEach(p => { partMap[p.challenge_id] = p; });
        setParticipations(partMap);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const joinChallenge = async (challengeId: string) => {
    if (!user) return;
    hapticSuccess();
    const { error } = await supabase
      .from('challenge_participations')
      .insert({ challenge_id: challengeId, user_id: user.id });

    if (!error) {
      setParticipations(prev => ({ ...prev, [challengeId]: { challenge_id: challengeId, completed: false } }));
      toast.success(t('challenges.joined'));
    }
  };

  const completeChallenge = async (challengeId: string) => {
    if (!user) return;
    hapticSuccess();
    await supabase
      .from('challenge_participations')
      .update({ completed: true })
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id);

    setParticipations(prev => ({
      ...prev,
      [challengeId]: { ...prev[challengeId], completed: true },
    }));
    toast.success(t('challenges.completed'));
  };

  return (
    <AppLayout>
      <PageHeader title={t('challenges.title')} showBack />
      <AnimatedPage className="max-w-lg mx-auto px-4 pb-8 pt-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('challenges.none')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {challenges.map((ch, i) => {
              const part = participations[ch.id];
              return (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={cn(
                    "rounded-xl border p-4 space-y-3",
                    part?.completed
                      ? "bg-green-500/5 border-green-500/20"
                      : "bg-card"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{ch.title}</h3>
                      {ch.description && (
                        <p className="text-xs text-muted-foreground mt-1">{ch.description}</p>
                      )}
                    </div>
                    {part?.completed && (
                      <Badge className="bg-green-500 text-white border-0 ml-2">
                        <Check className="w-3 h-3 mr-1" />{t('challenges.done')}
                      </Badge>
                    )}
                  </div>

                  {!part ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => joinChallenge(ch.id)}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />{t('challenges.join')}
                    </Button>
                  ) : !part.completed ? (
                    <Button
                      size="sm"
                      className="w-full rounded-xl"
                      onClick={() => completeChallenge(ch.id)}
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5" />{t('challenges.mark_done')}
                    </Button>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
