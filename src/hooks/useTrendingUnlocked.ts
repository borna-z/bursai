import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const TRENDING_THRESHOLD = 500;
const SEEN_KEY = 'burs_trending_unlocked_seen';

export function useTrendingUnlocked() {
  const { data: totalUsers = 0 } = useQuery({
    queryKey: ['total-user-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    },
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  const isUnlocked = totalUsers >= TRENDING_THRESHOLD;
  const hasSeen = localStorage.getItem(SEEN_KEY) === 'true';
  const showNewBadge = isUnlocked && !hasSeen;

  const markSeen = () => {
    localStorage.setItem(SEEN_KEY, 'true');
  };

  return { totalUsers, isUnlocked, showNewBadge, markSeen, threshold: TRENDING_THRESHOLD };
}
