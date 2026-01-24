import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      
      // If no subscription exists (for existing users), create one
      if (!data) {
        const { data: newSub, error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({ user_id: user.id, plan: 'free' })
          .select()
          .single();
        
        if (insertError) {
          // Might fail due to RLS, return default values
          return {
            id: '',
            user_id: user.id,
            plan: 'free' as SubscriptionPlan,
            garments_count: 0,
            outfits_used_month: 0,
            period_start: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
        
        return newSub as unknown as Subscription;
      }

      return data as unknown as Subscription;
    },
    enabled: !!user,
  });

  const subscription = query.data;
  const plan = subscription?.plan || 'free';
  const limits = PLAN_LIMITS[plan];

  // Check if user can add more garments
  const canAddGarment = () => {
    if (plan === 'premium') return true;
    const currentCount = subscription?.garments_count || 0;
    return currentCount < limits.maxGarments;
  };

  // Check if user can create more outfits this month
  const canCreateOutfit = () => {
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
