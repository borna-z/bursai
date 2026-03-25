import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAvatarUrl(avatarPath: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarPath) {
      setUrl(null);
      return;
    }

    let cancelled = false;

    supabase.storage
      .from('avatars')
      .createSignedUrl(avatarPath, 3600)
      .then(({ data, error }) => {
        if (!cancelled && !error && data) {
          setUrl(data.signedUrl);
        }
      });

    return () => { cancelled = true; };
  }, [avatarPath]);

  return url;
}
