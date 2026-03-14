import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  provider: string | null;
}

export type CalendarProvider = 'ics' | 'google' | null;

export function useCalendarSync() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile-calendar', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('ics_url, last_calendar_sync')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: googleConnection } = useQuery({
    queryKey: ['google-calendar-connection', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('id, provider, token_expires_at, created_at')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const connectedProvider: CalendarProvider = googleConnection
    ? 'google'
    : profile?.ics_url
    ? 'ics'
    : null;

  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      const { data, error } = await invokeEdgeFunction<{ synced?: number; error?: string }>('calendar', {
        body: { action: 'sync_ics' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['profile-calendar'] });
      toast.success(t('calsync.synced_events').replace('{count}', String(data?.synced)));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('calsync.sync_error'));
    },
    onSettled: () => setIsSyncing(false),
  });

  const syncGoogleMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      const { data, error } = await invokeEdgeFunction<{ synced?: number; reconnect?: boolean; error?: string }>('calendar', {
        body: { action: 'sync_google' },
      });

      if (error) {
        // Check if the error message hints at reconnect
        if (error.message?.includes('reconnect')) {
          throw Object.assign(new Error('reconnect_required'), { reconnect: true });
        }
        throw error;
      }
      if (data?.reconnect) {
        throw Object.assign(new Error('reconnect_required'), { reconnect: true });
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['profile-calendar'] });
      toast.success(t('calsync.synced_google').replace('{count}', String(data?.synced)));
    },
    onError: (error: any) => {
      if (error?.reconnect) {
        queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
        toast.error(t('calsync.reconnect_required') || 'Google Calendar disconnected. Please reconnect.', {
          duration: 8000,
          action: {
            label: t('calsync.reconnect_action') || 'Reconnect',
            onClick: () => connectGoogle(),
          },
        });
      } else {
        toast.error(error.message || t('calsync.sync_google_error'));
      }
    },
    onSettled: () => setIsSyncing(false),
  });

  const saveIcsUrl = useMutation({
    mutationFn: async (icsUrl: string) => {
      if (!user) throw new Error(t('calsync.not_logged_in'));
      const { error } = await supabase
        .from('profiles')
        .update({ ics_url: icsUrl })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-calendar'] });
    },
    onError: () => {
      toast.error(t('calsync.save_url_error'));
    },
  });

  const removeIcsUrl = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error(t('calsync.not_logged_in'));
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ ics_url: null, last_calendar_sync: null })
        .eq('id', user.id);
      if (profileError) throw profileError;
      const { error: eventsError } = await supabase
        .from('calendar_events')
        .delete()
        .eq('user_id', user.id);
      if (eventsError) throw eventsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success(t('calsync.removed'));
    },
    onError: () => {
      toast.error(t('calsync.remove_error'));
    },
  });

  const connectGoogle = async () => {
    try {
      const redirectUri = 'https://burs.me/calendar/callback';
      const { data, error } = await invokeEdgeFunction<{ url?: string; error?: string }>('google_calendar_auth', {
        body: { action: 'get_auth_url', redirect_uri: redirectUri },
      });
      if (error || data?.error) {
        toast.error(t('calsync.connect_error'));
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch {
      toast.error(t('calsync.connect_error'));
    }
  };

  const disconnectGoogle = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeEdgeFunction<{ error?: string }>('google_calendar_auth', {
        body: { action: 'disconnect' },
      });
      if (error || data?.error) throw new Error(data?.error || 'Disconnect failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['profile-calendar'] });
      toast.success(t('calsync.disconnected'));
    },
    onError: () => {
      toast.error(t('calsync.disconnect_error'));
    },
  });

  const syncCalendar = async () => {
    if (googleConnection) {
      return syncGoogleMutation.mutateAsync();
    }
    return syncMutation.mutateAsync();
  };

  return {
    icsUrl: profile?.ics_url || null,
    lastSynced: profile?.last_calendar_sync || null,
    isSyncing,
    connectedProvider,
    googleConnection,
    syncCalendar,
    saveIcsUrl: saveIcsUrl.mutateAsync,
    removeIcsUrl: removeIcsUrl.mutateAsync,
    isRemoving: removeIcsUrl.isPending,
    connectGoogle,
    disconnectGoogle: disconnectGoogle.mutateAsync,
    isDisconnectingGoogle: disconnectGoogle.isPending,
  };
}

export function useCalendarEvents(date: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['calendar-events', date, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('start_time', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
    enabled: !!user && !!date,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCalendarEventsRange(startDate: string, endDate: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['calendar-events-range', startDate, endDate, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
    enabled: !!user && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5,
  });
}

export function useBackgroundSyncNotification() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const hasShown = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ['profile-calendar', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('last_calendar_sync')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (hasShown.current || !profile?.last_calendar_sync) return;

    const stored = localStorage.getItem('burs_last_known_sync');
    const dbTime = profile.last_calendar_sync;

    if (stored && new Date(dbTime) > new Date(stored)) {
      const ago = formatDistanceToNow(new Date(dbTime), { addSuffix: true });
      toast.info(t('calsync.auto_synced'), {
        description: ago,
        duration: 4000,
      });
    }

    localStorage.setItem('burs_last_known_sync', dbTime);
    hasShown.current = true;
  }, [profile?.last_calendar_sync]);
}

export function inferOccasionFromEvent(title: string): { occasion: string; formality: number; confidence: number } | null {
  const t = title.toLowerCase();

  const rules: { occasion: string; formality: number; keywords: string[]; confidence: number }[] = [
    { occasion: 'fest', formality: 5, confidence: 0.95, keywords: [
      'gala', 'bröllop', 'wedding', 'bankett', 'invigning', 'release party',
    ]},
    { occasion: 'fest', formality: 4, confidence: 0.85, keywords: [
      'fest', 'party', 'AW', 'afterwork', 'after work', 'mingel',
      'middag', 'dinner', 'kvällsevent', 'vernissage',
    ]},
    { occasion: 'dejt', formality: 4, confidence: 0.9, keywords: [
      'dejt', 'date', 'romantisk', 'anniversary', 'årsdag', 'valentines',
    ]},
    { occasion: 'jobb', formality: 4, confidence: 0.9, keywords: [
      'möte', 'meeting', 'presentation', 'konferens', 'intervju', 'interview',
      'workshop', 'boardmöte', 'kundmöte', 'pitch', 'demo', 'keynote',
    ]},
    { occasion: 'jobb', formality: 3, confidence: 0.75, keywords: [
      'arbete', 'jobb', 'standup', 'stand-up', 'retrospektiv', 'sprint',
      'sync', 'planning', '1:1', 'one-on-one', 'daily', 'weekly',
    ]},
    { occasion: 'brunch', formality: 3, confidence: 0.8, keywords: [
      'brunch', 'fika', 'lunch', 'kafé', 'café',
    ]},
    { occasion: 'traning', formality: 1, confidence: 0.95, keywords: [
      'träning', 'gym', 'yoga', 'löpning', 'sport', 'padel', 'tennis',
      'fotboll', 'basket', 'simning', 'crossfit', 'spinning', 'promenad',
      'vandring', 'klättring', 'dans', 'dance', 'pilates', 'boxing',
    ]},
    { occasion: 'resa', formality: 2, confidence: 0.8, keywords: [
      'flyg', 'flight', 'tåg', 'train', 'resa', 'travel', 'airport',
    ]},
    { occasion: 'skola', formality: 2, confidence: 0.7, keywords: [
      'skola', 'school', 'föreläsning', 'lecture', 'seminarium', 'uni',
      'tentamen', 'exam', 'klass', 'class',
    ]},
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => t.includes(kw.toLowerCase()))) {
      return { occasion: rule.occasion, formality: rule.formality, confidence: rule.confidence };
    }
  }

  return null;
}
