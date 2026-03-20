import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useLanguage } from '@/contexts/LanguageContext';

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
  confidence?: number;
}

export interface AnalyzeGarmentResult {
  data: GarmentAnalysis | null;
  error: string | null;
}

export function useAnalyzeGarment() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const analyzeGarment = async (storagePath: string): Promise<AnalyzeGarmentResult> => {
    if (!user) {
      return { data: null, error: t('analyze.not_logged_in') };
    }

    setIsAnalyzing(true);
    setAnalysisProgress(10);

    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      setAnalysisProgress(20);

      const { data, error } = await invokeEdgeFunction<GarmentAnalysis & { error?: string }>('analyze_garment', {
        timeout: 30000,
        body: { storagePath, locale },
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (error) {
        console.error('Edge function error:', error);
        return { data: null, error: error.message || t('analyze.failed') };
      }

      if (data?.error) {
        return { data: null, error: data.error };
      }

      return { data: data as GarmentAnalysis, error: null };
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Analyze garment error:', err);
      return { data: null, error: t('analyze.unexpected') };
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