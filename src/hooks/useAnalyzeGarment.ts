import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GarmentAnalysis {
  title: string;
  category: string;
  subcategory: string;
  color_primary: string;
  color_secondary?: string;
  pattern?: string;
  material?: string;
  fit?: string;
  season_tags: string[];
  formality: number;
}

export interface AnalyzeGarmentResult {
  data: GarmentAnalysis | null;
  error: string | null;
}

export function useAnalyzeGarment() {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeGarment = async (storagePath: string): Promise<AnalyzeGarmentResult> => {
    if (!user) {
      return { data: null, error: 'Inte inloggad' };
    }

    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze_garment', {
        body: {
          userId: user.id,
          storagePath,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        return { data: null, error: error.message || 'AI-analys misslyckades' };
      }

      // Check if response contains an error
      if (data?.error) {
        return { data: null, error: data.error };
      }

      return { data: data as GarmentAnalysis, error: null };
    } catch (err) {
      console.error('Analyze garment error:', err);
      return { data: null, error: 'Ett oväntat fel uppstod' };
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    analyzeGarment,
    isAnalyzing,
  };
}
