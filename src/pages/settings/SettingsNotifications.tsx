import { Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { CalendarSection } from '@/components/settings/CalendarSection';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';

interface Preferences {
  morningReminder?: boolean;
  [key: string]: unknown;
}

export default function SettingsNotifications() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { t } = useLanguage();

  const preferences = (profile?.preferences as Preferences) || {};

  const updatePreference = async (key: string, value: unknown) => {
    const newPrefs = { ...preferences, [key]: value } as Record<string, unknown>;
    try { await updateProfile.mutateAsync({ preferences: newPrefs as any }); }
    catch { toast.error(t('settings.pref_error')); }
  };

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.notifications')} showBack />

      <div className="px-4 pb-6 pt-4 space-y-6 max-w-lg mx-auto">
        <SettingsGroup title={t('settings.notifications_title')}>
          <SettingsRow icon={<Bell />} label={t('settings.morning_reminder')} last>
            <Switch checked={preferences.morningReminder || false} onCheckedChange={(v) => updatePreference('morningReminder', v)} />
          </SettingsRow>
        </SettingsGroup>

        <CalendarSection />
      </div>
    </AppLayout>
  );
}
