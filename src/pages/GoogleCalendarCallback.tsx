import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-sm">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-lg font-medium">{t('gcal.connecting')}</p>
            <p className="text-sm text-muted-foreground">{t('gcal.syncing')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-lg font-medium">{t('gcal.connected')}</p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {status === 'empty' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-lg font-medium">{t('gcal.connected')}</p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-lg font-medium">{t('gcal.something_wrong')}</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate('/settings', { replace: true })}
              className="text-primary underline text-sm mt-2"
            >
              {t('gcal.back_settings')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
