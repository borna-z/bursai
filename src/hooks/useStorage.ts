import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useStorage() {
  const { user } = useAuth();
  
  const uploadGarmentImage = async (file: File, garmentId: string) => {
    if (!user) throw new Error('Not authenticated');
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${garmentId}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('garments')
      .upload(filePath, file, { upsert: true });
    
    if (error) throw error;
    
    return filePath;
  };
  
  const getGarmentSignedUrl = async (imagePath: string) => {
    const { data, error } = await supabase.storage
      .from('garments')
      .createSignedUrl(imagePath, 3600); // 1 hour
    
    if (error) throw error;
    return data.signedUrl;
  };
  
  const deleteGarmentImage = async (imagePath: string) => {
    const { error } = await supabase.storage
      .from('garments')
      .remove([imagePath]);
    
    if (error) throw error;
  };
  
  return {
    uploadGarmentImage,
    getGarmentSignedUrl,
    deleteGarmentImage,
  };
}

/**
 * Hook to fetch a signed URL for a garment image.
 * Returns the signed URL and loading/error states.
 */
export function useGarmentSignedUrl(imagePath: string | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!imagePath) {
      setSignedUrl(null);
      return;
    }

    let isCancelled = false;
    
    const fetchSignedUrl = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error: urlError } = await supabase.storage
          .from('garments')
          .createSignedUrl(imagePath, 3600); // 1 hour
        
        if (urlError) throw urlError;
        
        if (!isCancelled) {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err : new Error('Failed to get signed URL'));
          setSignedUrl(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchSignedUrl();

    return () => {
      isCancelled = true;
    };
  }, [imagePath]);

  return { signedUrl, isLoading, error };
}
