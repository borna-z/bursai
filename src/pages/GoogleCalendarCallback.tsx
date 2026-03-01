import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function GoogleCalendarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(t('gcal.denied'));
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg(t('gcal.no_code'));
      return;
    }

    const exchangeCode = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('google_calendar_auth', {
          body: {
            action: 'exchange_code',
            code,
            redirect_uri: 'https://burs.me/calendar/callback',
          },
        });

        if (fnError || data?.error) {
          throw new Error(data?.error || fnError?.message || 'Exchange failed');
        }

        await supabase.functions.invoke('sync_google_calendar');

        setStatus('success');
        setTimeout(() => navigate('/settings', { replace: true }), 1500);
      } catch (err) {
        console.error('Google calendar callback error:', err);
        setStatus('error');
        setErrorMsg(t('gcal.error'));
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

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
            <p className="text-sm text-muted-foreground">{t('gcal.redirecting')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-lg font-medium">{t('gcal.something_wrong')}</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
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
