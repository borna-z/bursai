import { Bell, BellRing, Smartphone } from 'lucide-react';
import AnimatedPage from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import type { Json } from '@/integrations/supabase/types';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
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
  const push = usePushNotifications();

  const preferences = (profile?.preferences as Preferences) || {};

  const updatePreference = async (key: string, value: unknown) => {
    const newPrefs = { ...preferences, [key]: value } as Record<string, unknown>;
    try { await updateProfile.mutateAsync({ preferences: newPrefs as unknown as Json }); }
    catch { toast.error(t('settings.pref_error')); }
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      const ok = await push.subscribe();
      if (ok) {
        toast.success(t('settings.push_enabled') || 'Push notifications enabled');
      } else if (push.permission === 'denied') {
        toast.error(t('settings.push_denied') || 'Notifications are blocked. Please enable them in your browser settings.');
      }
    } else {
      await push.unsubscribe();
      toast.success(t('settings.push_disabled') || 'Push notifications disabled');
    }
  };

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.notifications')} showBack />

      <AnimatedPage className="px-4 pb-6 pt-4 space-y-6 max-w-lg mx-auto">
        <SettingsGroup title={t('settings.notifications_title')}>
          <SettingsRow icon={<Bell />} label={t('settings.morning_reminder')}>
            <Switch checked={preferences.morningReminder || false} onCheckedChange={(v) => { hapticLight(); updatePreference('morningReminder', v); }} />
          </SettingsRow>
          {push.supported && (
            <SettingsRow
              icon={<BellRing />}
              label={t('settings.push_notifications') || 'Push notifications'}
              sublabel={
                push.permission === 'denied'
                  ? (t('settings.push_blocked') || 'Blocked in browser settings')
                  : (t('settings.push_sublabel') || 'Get outfit reminders on your device')
              }
              last
            >
              <Switch
                checked={push.isSubscribed}
                onCheckedChange={(v) => { hapticLight(); handlePushToggle(v); }}
                disabled={push.loading || push.permission === 'denied'}
              />
            </SettingsRow>
          )}
          {!push.supported && (
            <SettingsRow icon={<Smartphone />} label={t('settings.push_not_supported') || 'Push not supported'} sublabel={t('settings.push_not_supported_sub') || 'Your browser does not support push notifications'} last>
              <span className="text-xs text-muted-foreground">—</span>
            </SettingsRow>
          )}
        </SettingsGroup>

        <CalendarSection />
      </AnimatedPage>
    </AppLayout>
  );
}
