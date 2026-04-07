import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionPlan = 'free' | 'premium';

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  garments_count: number;
  outfits_used_month: number;
  period_start: string;
  created_at: string;
  updated_at: string;
}

// Plan limits
export const PLAN_LIMITS = {
  free: {
    maxGarments: 10,
    maxOutfitsPerMonth: 10,
  },
  premium: {
    maxGarments: Infinity,
    maxOutfitsPerMonth: Infinity,
  },
};

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as Subscription) ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Bootstrap a free subscription row for users that don't have one yet
  const bootstrap = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('user_subscriptions')
        .upsert({ user_id: user.id, plan: 'free' }, { onConflict: 'user_id', ignoreDuplicates: true })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Subscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
    },
  });
  const { isPending: isBootstrapping, mutate: bootstrapSubscription } = bootstrap;

  useEffect(() => {
    if (query.data === null && !query.isLoading && !isBootstrapping) {
      bootstrapSubscription();
    }
  }, [bootstrapSubscription, isBootstrapping, query.data, query.isLoading]);

  const subscription = query.data;
  const plan = subscription?.plan || 'free';
  const limits = PLAN_LIMITS[plan];

  // Check if user can add more garments (false while loading to prevent bypass)
  const canAddGarment = () => {
    if (query.isLoading) return false;
    if (plan === 'premium') return true;
    const currentCount = subscription?.garments_count || 0;
    return currentCount < limits.maxGarments;
  };

  // Check if user can create more outfits this month (false while loading to prevent bypass)
  const canCreateOutfit = () => {
    if (query.isLoading) return false;
    if (plan === 'premium') return true;
    const usedThisMonth = subscription?.outfits_used_month || 0;
    return usedThisMonth < limits.maxOutfitsPerMonth;
  };

  // Get remaining garment slots
  const remainingGarments = () => {
    if (plan === 'premium') return Infinity;
    const currentCount = subscription?.garments_count || 0;
    return Math.max(0, limits.maxGarments - currentCount);
  };

  // Get remaining outfit generations this month
  const remainingOutfits = () => {
    if (plan === 'premium') return Infinity;
    const usedThisMonth = subscription?.outfits_used_month || 0;
    return Math.max(0, limits.maxOutfitsPerMonth - usedThisMonth);
  };

  // Refresh subscription data
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
  };

  return {
    subscription,
    plan,
    isPremium: plan === 'premium',
    isLoading: query.isLoading,
    canAddGarment,
    canCreateOutfit,
    remainingGarments,
    remainingOutfits,
    limits,
    refresh,
  };
}
