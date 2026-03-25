import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
}
