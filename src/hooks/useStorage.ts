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
  
  const getGarmentImageUrl = (imagePath: string) => {
    const { data } = supabase.storage
      .from('garments')
      .getPublicUrl(imagePath);
    
    return data.publicUrl;
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
    getGarmentImageUrl,
    getGarmentSignedUrl,
    deleteGarmentImage,
  };
}
