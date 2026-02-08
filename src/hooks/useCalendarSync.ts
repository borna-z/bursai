import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  provider: string | null;
}

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

  // Sync calendar mutation
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
    onSettled: () => {
      setIsSyncing(false);
    },
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
      
      // Clear URL from profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ ics_url: null, last_calendar_sync: null })
        .eq('id', user.id);
      
      if (profileError) throw profileError;

      // Delete all calendar events for user
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

  return {
    icsUrl: profile?.ics_url || null,
    lastSynced: profile?.last_calendar_sync || null,
    isSyncing,
    syncCalendar: syncMutation.mutateAsync,
    saveIcsUrl: saveIcsUrl.mutateAsync,
    removeIcsUrl: removeIcsUrl.mutateAsync,
    isRemoving: removeIcsUrl.isPending,
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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Utility to infer occasion from event title
export function inferOccasionFromEvent(title: string): { occasion: string; formality: number } | null {
  const lowerTitle = title.toLowerCase();
  
  // Work/meeting keywords
  if (
    lowerTitle.includes('möte') ||
    lowerTitle.includes('meeting') ||
    lowerTitle.includes('presentation') ||
    lowerTitle.includes('konferens') ||
    lowerTitle.includes('intervju') ||
    lowerTitle.includes('arbete') ||
    lowerTitle.includes('jobb')
  ) {
    return { occasion: 'jobb', formality: 4 };
  }
  
  // Party/dinner keywords
  if (
    lowerTitle.includes('fest') ||
    lowerTitle.includes('party') ||
    lowerTitle.includes('middag') ||
    lowerTitle.includes('dinner') ||
    lowerTitle.includes('gala') ||
    lowerTitle.includes('bröllop') ||
    lowerTitle.includes('wedding')
  ) {
    return { occasion: 'fest', formality: 5 };
  }
  
  // Date keywords
  if (
    lowerTitle.includes('dejt') ||
    lowerTitle.includes('date') ||
    lowerTitle.includes('romantisk')
  ) {
    return { occasion: 'dejt', formality: 4 };
  }
  
  // Training/gym keywords
  if (
    lowerTitle.includes('träning') ||
    lowerTitle.includes('gym') ||
    lowerTitle.includes('yoga') ||
    lowerTitle.includes('löpning') ||
    lowerTitle.includes('sport')
  ) {
    return { occasion: 'traning', formality: 1 };
  }
  
  return null;
}
