import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';

export function useGenerateFlatlay() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const mutation = useMutation({
    mutationFn: async (outfitId: string) => {
      setIsGenerating(true);
      try {
        const { data, error } = await invokeEdgeFunction<{ success: boolean; flatlay_image_path: string; error?: string }>('generate_flatlay', {
          timeout: 45000,
          body: { outfit_id: outfitId },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        return data!;
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: (_data, outfitId) => {
      queryClient.invalidateQueries({ queryKey: ['outfit', outfitId] });
      queryClient.invalidateQueries({ queryKey: ['outfits', user?.id] });
    },
  });

  return {
    generateFlatlay: mutation.mutateAsync,
    isGenerating: isGenerating || mutation.isPending,
    error: mutation.error,
  };
}
