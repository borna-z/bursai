import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGarments } from './useGarments';
import { useOutfits } from './useOutfits';
import { useProfile, useUpdateProfile } from './useProfile';

export interface OnboardingState {
  completed: boolean;
  step1Done: boolean; // 5 garments with at least 1 top, 1 bottom, 1 shoes
  step2Done: boolean; // First outfit created
  step3Done: boolean; // Reminder enabled (optional)
  skippedReminder: boolean;
}

interface OnboardingProgress {
  garmentCount: number;
  hasTop: boolean;
  hasBottom: boolean;
  hasShoes: boolean;
  outfitCount: number;
  reminderEnabled: boolean;
}

export function useOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: garments, isLoading: garmentsLoading } = useGarments();
  const { data: outfits, isLoading: outfitsLoading } = useOutfits(false); // all outfits
  const updateProfile = useUpdateProfile();

  const isLoading = profileLoading || garmentsLoading || outfitsLoading;

  // Calculate progress
  const progress: OnboardingProgress = {
    garmentCount: garments?.length || 0,
    hasTop: garments?.some(g => g.category === 'top') || false,
    hasBottom: garments?.some(g => g.category === 'bottom') || false,
    hasShoes: garments?.some(g => g.category === 'shoes') || false,
    outfitCount: outfits?.length || 0,
    reminderEnabled: (profile?.preferences as Record<string, unknown>)?.dailyReminder === true,
  };

  // Get saved onboarding state from preferences
  const savedState = (profile?.preferences as Record<string, unknown>)?.onboarding as OnboardingState | undefined;

  // Calculate current state
  const step1Done = progress.garmentCount >= 5 && progress.hasTop && progress.hasBottom && progress.hasShoes;
  const step2Done = progress.outfitCount >= 1;
  const step3Done = progress.reminderEnabled || savedState?.skippedReminder === true;
  const completed = savedState?.completed === true || (step1Done && step2Done && step3Done);

  const state: OnboardingState = {
    completed,
    step1Done,
    step2Done,
    step3Done,
    skippedReminder: savedState?.skippedReminder || false,
  };

  // Get current step (1, 2, or 3)
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 3;

  // Complete onboarding
  const completeOnboarding = async () => {
    if (!profile) return;
    
    const currentPrefs = (profile.preferences as Record<string, unknown>) || {};
    await updateProfile.mutateAsync({
      preferences: {
        ...currentPrefs,
        onboarding: { ...state, completed: true },
      },
    });
  };

  // Skip reminder step
  const skipReminder = async () => {
    if (!profile) return;
    
    const currentPrefs = (profile.preferences as Record<string, unknown>) || {};
    await updateProfile.mutateAsync({
      preferences: {
        ...currentPrefs,
        onboarding: { ...state, skippedReminder: true, step3Done: true },
      },
    });
  };

  // Enable daily reminder
  const enableReminder = async () => {
    if (!profile) return;
    
    const currentPrefs = (profile.preferences as Record<string, unknown>) || {};
    await updateProfile.mutateAsync({
      preferences: {
        ...currentPrefs,
        dailyReminder: true,
        onboarding: { ...state, step3Done: true },
      },
    });
  };

  // Create demo garments
  const createDemoGarments = async () => {
    if (!user) throw new Error('Not authenticated');

    const demoGarments = [
      { title: 'Vit T-shirt', category: 'top', color_primary: 'vit', formality: 2, season_tags: ['Sommar', 'Året runt'] },
      { title: 'Blå skjorta', category: 'top', color_primary: 'blå', formality: 4, season_tags: ['Vår/Höst', 'Året runt'] },
      { title: 'Svarta jeans', category: 'bottom', color_primary: 'svart', formality: 3, season_tags: ['Året runt'] },
      { title: 'Beige chinos', category: 'bottom', color_primary: 'beige', formality: 4, season_tags: ['Vår/Höst', 'Sommar'] },
      { title: 'Vita sneakers', category: 'shoes', color_primary: 'vit', formality: 2, season_tags: ['Sommar', 'Vår/Höst'] },
      { title: 'Mörkblå kavaj', category: 'outerwear', color_primary: 'marinblå', formality: 5, season_tags: ['Vår/Höst', 'Vinter'] },
    ];

    for (const garment of demoGarments) {
      await supabase.from('garments').insert({
        ...garment,
        user_id: user.id,
        image_path: 'demo/placeholder.png', // Placeholder path
        in_laundry: false,
        wear_count: 0,
      });
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['garments'] });
    queryClient.invalidateQueries({ queryKey: ['garments-count'] });
  };

  return {
    state,
    progress,
    currentStep,
    isLoading,
    needsOnboarding: !isLoading && !completed && !!user,
    completeOnboarding,
    skipReminder,
    enableReminder,
    createDemoGarments,
  };
}
