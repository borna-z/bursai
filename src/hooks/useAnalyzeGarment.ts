import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GarmentAnalysis {
  title: string;
  category: string;
  subcategory: string;
  color_primary: string;
  color_secondary?: string | null;
  pattern?: string | null;
  material?: string | null;
  fit?: string | null;
  season_tags: string[];
  formality: number;
  ai_provider?: string;
  ai_raw?: Record<string, unknown>;
}

export interface AnalyzeGarmentResult {
  data: GarmentAnalysis | null;
  error: string | null;
}

export function useAnalyzeGarment() {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const analyzeGarment = async (storagePath: string): Promise<AnalyzeGarmentResult> => {
    if (!user) {
      return { data: null, error: 'Inte inloggad' };
    }

    setIsAnalyzing(true);
    setAnalysisProgress(10);

    // Simulate progress for UX
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      setAnalysisProgress(20);

      const { data, error } = await supabase.functions.invoke('analyze_garment', {
        body: {
          storagePath,
        },
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

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
      clearInterval(progressInterval);
      console.error('Analyze garment error:', err);
      return { data: null, error: 'Ett oväntat fel uppstod vid AI-analysen' };
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setAnalysisProgress(0), 500);
    }
  };

  return {
    analyzeGarment,
    isAnalyzing,
    analysisProgress,
  };
}
