import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Get profile with ics_url and last_calendar_sync
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

  // Check for Google Calendar connection
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

  // Sync calendar mutation (ICS)
  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke('sync_calendar');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['profile-calendar'] });
      toast.success(`Synkade ${data.synced} händelser`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Kunde inte synka kalendern');
    },
    onSettled: () => setIsSyncing(false),
  });

  // Sync Google Calendar
  const syncGoogleMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke('sync_google_calendar');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['profile-calendar'] });
      toast.success(`Synkade ${data.synced} händelser från Google`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Kunde inte synka Google Calendar');
    },
    onSettled: () => setIsSyncing(false),
  });

  // Save ICS URL
  const saveIcsUrl = useMutation({
    mutationFn: async (icsUrl: string) => {
      if (!user) throw new Error('Ej inloggad');
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
      toast.error('Kunde inte spara kalender-URL');
    },
  });

  // Remove ICS URL
  const removeIcsUrl = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Ej inloggad');
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
      toast.success('Kalendersynk borttagen');
    },
    onError: () => {
      toast.error('Kunde inte ta bort kalendersynk');
    },
  });

  // Connect Google Calendar (opens OAuth popup)
  const connectGoogle = async () => {
    try {
      const redirectUri = `${window.location.origin}/calendar/callback`;
      const { data, error } = await supabase.functions.invoke('google_calendar_auth', {
        body: { action: 'get_auth_url', redirect_uri: redirectUri },
      });
      if (error || data?.error) {
        toast.error('Kunde inte starta Google-koppling');
        return;
      }
      // Redirect to Google OAuth
      window.location.href = data.url;
    } catch {
      toast.error('Kunde inte starta Google-koppling');
    }
  };

  // Disconnect Google Calendar
  const disconnectGoogle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google_calendar_auth', {
        body: { action: 'disconnect' },
      });
      if (error || data?.error) throw new Error(data?.error || 'Disconnect failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['profile-calendar'] });
      toast.success('Google Calendar bortkopplad');
    },
    onError: () => {
      toast.error('Kunde inte koppla bort Google Calendar');
    },
  });

  // Smart sync: uses whichever provider is connected
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

// Hook to get calendar events for a specific date
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

// Hook to get calendar events for a date range
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

// Utility to infer occasion from event title
export function inferOccasionFromEvent(title: string): { occasion: string; formality: number } | null {
  const t = title.toLowerCase();

  const rules: { occasion: string; formality: number; keywords: string[] }[] = [
    { occasion: 'fest', formality: 5, keywords: [
      'fest', 'party', 'gala', 'bröllop', 'wedding', 'AW', 'afterwork', 'after work',
      'middag', 'dinner', 'bankett', 'mingel', 'release', 'invigning',
    ]},
    { occasion: 'jobb', formality: 4, keywords: [
      'möte', 'meeting', 'presentation', 'konferens', 'intervju', 'arbete', 'jobb',
      'workshop', 'standup', 'stand-up', 'retrospektiv', 'sprint', 'demo',
      'lunch', 'brunch', 'fika', 'kundmöte', 'boardmöte',
    ]},
    { occasion: 'dejt', formality: 4, keywords: [
      'dejt', 'date', 'romantisk', 'anniversary', 'årsdag',
    ]},
    { occasion: 'traning', formality: 1, keywords: [
      'träning', 'gym', 'yoga', 'löpning', 'sport', 'padel', 'tennis',
      'fotboll', 'basket', 'simning', 'crossfit', 'spinning', 'promenad', 'vandring',
    ]},
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => t.includes(kw.toLowerCase()))) {
      return { occasion: rule.occasion, formality: rule.formality };
    }
  }

  return null;
}
