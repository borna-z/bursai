import { useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { hapticSuccess } from '@/lib/haptics';
import { logger } from '@/lib/logger';

export function ProfileCard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { isPremium, plan } = useSubscription();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || '';
  const initials = displayName.slice(0, 2).toUpperCase();
  const email = user?.email || '';
  const avatarUrl = useAvatarUrl(profile?.avatar_path);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.avatar_invalid') || 'Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('settings.avatar_too_large') || 'Image must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;

      // Delete old avatar if exists
      if (profile?.avatar_path) {
        await supabase.storage.from('avatars').remove([profile.avatar_path]);
      }

      // Upload new
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Save path to profile
      await updateProfile.mutateAsync({ avatar_path: filePath });

      hapticSuccess();
      toast.success(t('settings.avatar_updated') || 'Photo updated');
    } catch (err: unknown) {
      logger.error('Avatar upload error:', err);
      toast.error(t('settings.avatar_error') || 'Failed to upload photo');
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4 py-2">
      {/* Avatar with upload overlay */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="relative group"
        aria-label={t('settings.change_photo') || 'Change photo'}
      >
        <Avatar className="h-14 w-14">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/8 text-primary font-semibold text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        {/* Overlay */}
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-white" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-medium truncate">{displayName}</p>
        {/* Plan tier badge */}
        <div className={`mt-1 mb-0.5 inline-flex items-center px-2 py-0.5 ${isPremium ? 'bg-foreground' : 'bg-secondary'}`}>
          <span className={`font-['DM_Sans'] text-[11px] ${isPremium ? 'text-background' : 'text-foreground/50'}`}>
            {plan === 'premium' ? 'Plus' : 'Free plan'}
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground/60 truncate">{email}</p>
      </div>
    </div>
  );
}
