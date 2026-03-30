import { motion } from 'framer-motion';
import { Bell, BellRing, Smartphone } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
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
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM } from '@/lib/motion';

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
      <PageHeader title={t('settings.row.notifications')} showBack titleClassName="font-display italic" />

      <AnimatedPage className="px-4 pb-8 pt-5 space-y-5 max-w-lg mx-auto">

        {/* V4 Allow Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
        >
          <SettingsGroup title={t('settings.notifications_title') || 'ALLOW NOTIFICATIONS'}>
            <SettingsRow icon={<Bell />} label={t('settings.morning_reminder')} sublabel={t('settings.morning_reminder_desc') || 'Manage all system alerts'}>
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
                <span className="text-xs text-muted-foreground font-body">---</span>
              </SettingsRow>
            )}
          </SettingsGroup>
        </motion.div>

        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 2 }}
        >
          <CalendarSection />
        </motion.div>

        {/* Editorial curation note */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 3 }}
          className="surface-secondary rounded-[1.25rem] p-5 text-center space-y-2"
        >
          <p className="label-editorial text-muted-foreground/50">{t('settings.curation_note_label') || 'CURATION NOTE'}</p>
          <p className="font-display italic text-[15px] text-foreground/80 leading-relaxed">
            {t('settings.style_quote') || '"Style is a way to say who you are without having to speak."'}
          </p>
          <p className="text-[11px] text-muted-foreground/40 font-body">--- Rachel Zoe</p>
        </motion.div>
      </AnimatedPage>
    </AppLayout>
  );
}
