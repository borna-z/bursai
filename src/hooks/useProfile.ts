import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';

export type Profile = Tables<'profiles'>;

export function useProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      // Use maybeSingle to gracefully handle missing profile (returns null instead of 406)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      // If no profile exists, auto-create one
      if (!data) {
        const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            display_name: displayName,
            preferences: { onboarding: { completed: false } },
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('Failed to auto-create profile:', insertError);
          // Return a minimal profile object so the app doesn't loop
          return { id: user.id, display_name: displayName, preferences: { onboarding: { completed: false } } } as unknown as Profile;
        }
        return newProfile as Profile;
      }
      
      return data as Profile;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: TablesUpdate<'profiles'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });
}
