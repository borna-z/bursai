import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export type SignalType =
  | 'save'
  | 'unsave'
  | 'ignore'
  | 'wear_confirm'
  | 'swap_choice'
  | 'quick_reaction'
  | 'rating'
  | 'garment_edit'
  | 'planned_follow_through'
  | 'planned_skip';

interface SignalInput {
  signal_type: SignalType;
  outfit_id?: string;
  garment_id?: string;
  value?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget feedback signal recorder.
 * Captures implicit user behavior for style engine learning.
 */
export function useFeedbackSignals() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const mutation = useMutation({
    mutationFn: async (input: SignalInput) => {
      if (!user) return;
      const { error } = await supabase
        .from('feedback_signals')
        .insert([{
          user_id: user.id,
          signal_type: input.signal_type,
          outfit_id: input.outfit_id || null,
          garment_id: input.garment_id || null,
          value: input.value || null,
          metadata: (input.metadata || {}) as Record<string, string>,
        }]);
      if (error) logger.warn('Feedback signal failed:', error.message);
    },
    onSuccess: (_data, input) => {
      if (input.signal_type === 'wear_confirm') {
        toast(t('feedback.wear_noted'), { duration: 2000 });
      } else if (input.signal_type === 'swap_choice') {
        toast(t('feedback.swap_saved'), { duration: 2000 });
      }
    },
    // Silent — never block UI
    onError: () => {},
  });

  const record = useCallback(
    (input: SignalInput) => {
      if (!user) return;
      mutation.mutate(input);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, mutation.mutate]
  );

  return { record };
}
