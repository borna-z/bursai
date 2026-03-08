import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DuplicateMatch {
  garment_id: string;
  title: string;
  image_path: string;
  confidence: number;
  match_type: 'attribute' | 'visual' | 'both';
  reasons: string[];
}

export function useDuplicateDetection() {
  const { user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);

  const checkDuplicates = async (params: {
    image_path?: string;
    category?: string;
    color_primary?: string;
    title?: string;
    subcategory?: string;
    material?: string;
    exclude_garment_id?: string;
  }): Promise<DuplicateMatch[]> => {
    if (!user) return [];

    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect_duplicate_garment', {
        body: params,
      });

      if (error) {
        console.error('Duplicate detection error:', error);
        return [];
      }

      const matches = (data?.duplicates || []) as DuplicateMatch[];
      setDuplicates(matches);
      return matches;
    } catch (err) {
      console.error('Duplicate detection error:', err);
      return [];
    } finally {
      setIsChecking(false);
    }
  };

  const clearDuplicates = () => setDuplicates([]);

  return { checkDuplicates, isChecking, duplicates, clearDuplicates };
}
