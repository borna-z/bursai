import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function GoogleCalendarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg('Du nekade åtkomst till Google Calendar.');
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('Ingen auktoriseringskod mottagen.');
      return;
    }

    const exchangeCode = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('google_calendar_auth', {
          body: {
            action: 'exchange_code',
            code,
            redirect_uri: `${window.location.origin}/calendar/callback`,
          },
        });

        if (fnError || data?.error) {
          throw new Error(data?.error || fnError?.message || 'Exchange failed');
        }

        // Now sync events
        await supabase.functions.invoke('sync_google_calendar');

        setStatus('success');
        setTimeout(() => navigate('/settings', { replace: true }), 1500);
      } catch (err) {
        console.error('Google calendar callback error:', err);
        setStatus('error');
        setErrorMsg('Kunde inte koppla Google Calendar. Försök igen.');
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
            <p className="text-lg font-medium">Kopplar Google Calendar...</p>
            <p className="text-sm text-muted-foreground">Vänta medan vi synkar dina händelser</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-lg font-medium">Google Calendar kopplad!</p>
            <p className="text-sm text-muted-foreground">Omdirigerar till inställningar...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-lg font-medium">Något gick fel</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => navigate('/settings', { replace: true })}
              className="text-primary underline text-sm mt-2"
            >
              Tillbaka till inställningar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
