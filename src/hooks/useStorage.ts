import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function resolveFileExtension(file: Blob | File, fallback = 'jpg'): string {
  if ('name' in file && typeof file.name === 'string') {
    const match = file.name.match(/\.([a-z0-9]+)$/i);
    if (match?.[1]) return match[1].toLowerCase();
  }

  if (file.type && MIME_EXTENSION_MAP[file.type]) {
    return MIME_EXTENSION_MAP[file.type];
  }

  return fallback;
}

export function useStorage() {
  const { user } = useAuth();
  
  const uploadGarmentImage = async (
    file: Blob | File,
    garmentId: string,
    options: { extension?: string; upsert?: boolean; filePath?: string } = {}
  ) => {
    if (!user) throw new Error('Not authenticated');

    const fileExt = options.extension || resolveFileExtension(file);
    const filePath = options.filePath || `${user.id}/${garmentId}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('garments')
      .upload(filePath, file, {
        upsert: options.upsert ?? true,
        contentType: file.type || undefined,
      });
    
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
