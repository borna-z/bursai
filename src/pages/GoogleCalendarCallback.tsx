import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Calendar, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { logger } from '@/lib/logger';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { EASE_CURVE, DURATION_MEDIUM, DURATION_SLOW, STAGGER_DELAY } from '@/lib/motion';

type CallbackStatus = 'loading' | 'success' | 'empty' | 'error';

interface CalendarSyncResponse {
  success?: boolean;
  synced?: number;
  calendarsSynced?: number;
  syncWindowDays?: number;
  error?: string;
  reconnect?: boolean;
}

export default function GoogleCalendarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState('');
  const prefersReduced = useReducedMotion();

  const motionProps = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: EASE_CURVE },
      };

  const staggerChild = (i: number) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: DURATION_MEDIUM,
            ease: EASE_CURVE,
            delay: i * STAGGER_DELAY + 0.15,
          },
        };

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(t('gcal.denied'));
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage(t('gcal.no_code'));
      return;
    }

    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.origin}/calendar/callback`;
        const { data, error: fnError } = await supabase.functions.invoke('google_calendar_auth', {
          body: {
            action: 'exchange_code',
            code,
            redirect_uri: redirectUri,
          },
        });

        if (fnError || data?.error) {
          throw new Error(data?.error || fnError?.message || 'Exchange failed');
        }

        const { data: syncData, error: syncError } = await supabase.functions.invoke<CalendarSyncResponse>('calendar', {
          body: { action: 'sync_google' },
        });

        if (syncError || syncData?.error || !syncData?.success) {
          throw new Error(syncData?.error || syncError?.message || 'Google calendar sync failed');
        }

        if ((syncData.synced ?? 0) === 0) {
          const syncWindowDays = syncData.syncWindowDays ?? 30;
          setStatus('empty');
          setMessage(
            `Google Calendar connected, but no upcoming events were found in the next ${syncWindowDays} days.`
          );
          setTimeout(() => navigate('/settings', { replace: true }), 2500);
          return;
        }

        setStatus('success');
        setMessage(t('gcal.redirecting'));
        setTimeout(() => navigate('/settings', { replace: true }), 1500);
      } catch (err) {
        logger.error('Google calendar callback error:', err);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : t('gcal.error'));
      }
    };

    exchangeCode();
  }, [searchParams, navigate, t]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {status === 'loading' && (
          <motion.div
            key="loading"
            className="max-w-md w-full rounded-[1.25rem] p-8 space-y-6 border border-border/40"
            {...motionProps}
          >
            <div className="text-center space-y-5">
              <motion.div {...staggerChild(0)}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto border border-border/40">
                  <Loader2 className="w-7 h-7 animate-spin text-foreground" />
                </div>
              </motion.div>
              <motion.div {...staggerChild(1)} className="space-y-2">
                <p className="label-editorial text-muted-foreground/60 uppercase tracking-wider text-xs">
                  {t('gcal.syncing')}
                </p>
                <h1 className="font-display italic text-2xl font-bold">
                  {t('gcal.connecting')}
                </h1>
              </motion.div>
              <motion.div {...staggerChild(2)}>
                <div className="w-full h-1.5 rounded-full overflow-hidden border border-border/40">
                  <motion.div
                    className="h-full rounded-full bg-foreground/20"
                    initial={{ width: '0%' }}
                    animate={{ width: '70%' }}
                    transition={{ duration: DURATION_SLOW * 6, ease: EASE_CURVE }}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            className="max-w-md w-full rounded-[1.25rem] p-8 space-y-6 border border-border/40"
            {...motionProps}
          >
            <div className="text-center space-y-5">
              <motion.div {...staggerChild(0)}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto border border-border/40">
                  <CheckCircle2 className="w-7 h-7 text-foreground" />
                </div>
              </motion.div>
              <motion.div {...staggerChild(1)} className="space-y-2">
                <p className="label-editorial text-muted-foreground/60 uppercase tracking-wider text-xs">
                  Calendar
                </p>
                <h1 className="font-display italic text-2xl font-bold flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t('gcal.connected')}
                </h1>
                <p className="text-sm text-muted-foreground">{message}</p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {status === 'empty' && (
          <motion.div
            key="empty"
            className="max-w-md w-full rounded-[1.25rem] p-8 space-y-6 border border-border/40"
            {...motionProps}
          >
            <div className="text-center space-y-5">
              <motion.div {...staggerChild(0)}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto border border-border/40">
                  <Calendar className="w-7 h-7 text-foreground" />
                </div>
              </motion.div>
              <motion.div {...staggerChild(1)} className="space-y-2">
                <p className="label-editorial text-muted-foreground/60 uppercase tracking-wider text-xs">
                  Calendar
                </p>
                <h1 className="font-display italic text-2xl font-bold">
                  {t('gcal.connected')}
                </h1>
                <p className="text-sm text-muted-foreground">{message}</p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            className="max-w-md w-full rounded-[1.25rem] p-8 space-y-6 border border-border/40"
            {...motionProps}
          >
            <div className="text-center space-y-5">
              <motion.div {...staggerChild(0)}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto border border-border/40">
                  <XCircle className="w-7 h-7 text-muted-foreground" />
                </div>
              </motion.div>
              <motion.div {...staggerChild(1)} className="space-y-2">
                <p className="label-editorial text-muted-foreground/60 uppercase tracking-wider text-xs">
                  Calendar
                </p>
                <h1 className="font-display italic text-2xl font-bold">
                  {t('gcal.something_wrong')}
                </h1>
                <p className="text-sm text-muted-foreground">{message}</p>
              </motion.div>
            </div>

            <motion.div {...staggerChild(2)}>
              <Button
                variant="editorial"
                className="w-full rounded-full"
                onClick={() => { hapticLight(); navigate('/settings', { replace: true }); }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('gcal.back_settings')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
