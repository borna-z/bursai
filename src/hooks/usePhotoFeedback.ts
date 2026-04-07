import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';

export interface OutfitFeedback {
  id: string;
  outfit_id: string;
  user_id: string;
  selfie_path: string;
  fit_score: number | null;
  color_match_score: number | null;
  overall_score: number | null;
  commentary: string | null;
  ai_raw: Record<string, unknown> | null;
  created_at: string;
}

export function useOutfitFeedback(outfitId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['outfit-feedback', outfitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outfit_feedback')
        .select('*')
        .eq('outfit_id', outfitId!)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as OutfitFeedback | null;
    },
    enabled: !!outfitId && !!user,
  });
}

export function useSubmitPhotoFeedback() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ outfitId, selfieFile }: { outfitId: string; selfieFile: File }) => {
      if (!user) throw new Error('Not authenticated');

      // Upload selfie to garments bucket under user folder
      const fileExt = selfieFile.name.split('.').pop() || 'jpg';
      const selfiePath = `${user.id}/selfie_${outfitId}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('garments')
        .upload(selfiePath, selfieFile, { upsert: true });

      if (uploadErr) throw uploadErr;

      // Call edge function
      const { data, error } = await invokeEdgeFunction<OutfitFeedback & { error?: string }>('outfit_photo_feedback', {
        body: { outfit_id: outfitId, selfie_path: selfiePath },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as OutfitFeedback;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['outfit-feedback', data.outfit_id] });
    },
  });
}
