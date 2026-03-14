import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';

export function useGenerateFlatlay() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const mutation = useMutation({
    mutationFn: async (outfitId: string) => {
      setIsGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate_flatlay', {
          body: { outfit_id: outfitId },
        });

        if (error) throw new Error(error.message || 'Failed to generate flat-lay');
        if (data?.error) throw new Error(data.error);

        return data as { success: boolean; flatlay_image_path: string };
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: (_data, outfitId) => {
      queryClient.invalidateQueries({ queryKey: ['outfit', outfitId] });
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
    },
  });

  return {
    generateFlatlay: mutation.mutateAsync,
    isGenerating: isGenerating || mutation.isPending,
    error: mutation.error,
  };
}
