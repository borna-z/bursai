import { useState } from 'react';
import { User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { useLanguage } from '@/contexts/LanguageContext';
import { PremiumSection } from '@/components/PremiumSection';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';

export default function SettingsAccount() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { subscription, isPremium, limits } = useSubscription();
  const { t } = useLanguage();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');

  const handleSaveDisplayName = async () => {
    try { await updateProfile.mutateAsync({ display_name: displayName }); toast.success(t('settings.name_saved')); }
    catch { toast.error(t('settings.name_error')); }
  };

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.account')} showBack />

      <div className="px-4 pb-6 pt-4 space-y-6 max-w-lg mx-auto">
        <div>
          <PremiumSection isPremium={isPremium} subscription={subscription} limits={limits} />
        </div>

        <SettingsGroup title={t('settings.profile')}>
          <div className="px-4 py-3 border-b border-border/50 space-y-2">
            <Label className="text-xs font-medium">{t('settings.display_name')}</Label>
            <div className="flex gap-2">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('settings.your_name')} className="h-9 text-sm" />
              <Button onClick={handleSaveDisplayName} disabled={updateProfile.isPending} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 h-9 text-xs px-4">
                {t('settings.save')}
              </Button>
            </div>
          </div>
          <SettingsRow icon={<User />} label={t('settings.email')} last>
            <span className="text-xs text-muted-foreground truncate max-w-[180px]">{user?.email}</span>
          </SettingsRow>
        </SettingsGroup>
      </div>
    </AppLayout>
  );
}
