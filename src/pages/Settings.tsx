import { useNavigate } from 'react-router-dom';
import { Palette, Shirt, Bell, User, Shield, LogOut, ChevronRight, TrendingUp, Database, Sparkles } from 'lucide-react';
import { SettingsPageSkeleton } from '@/components/ui/skeletons';
const APP_VERSION = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined) ?? '1.0.0';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { AnimatedPage } from '@/components/ui/animated-page';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isLoading } = useProfile();
  const { t } = useLanguage();
  const { data: isAdmin } = useIsAdmin();
  const coach = useFirstRunCoach();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <SettingsPageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AnimatedPage className="page-container space-y-10">
        {/* Profile */}
        <ProfileCard />

        {/* Main settings */}
        <SettingsGroup>
          <SettingsRow icon={<Palette />} label={t('settings.row.appearance')} sublabel={t('settings.row.appearance_sub')} onClick={() => navigate('/settings/appearance')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Shirt />} label={t('settings.row.style')} sublabel={t('settings.row.style_sub')} onClick={() => navigate('/settings/style')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Bell />} label={t('settings.row.notifications')} sublabel={t('settings.row.notifications_sub')} onClick={() => navigate('/settings/notifications')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<User />} label={t('settings.row.account')} sublabel={t('settings.row.account_sub')} onClick={() => navigate('/settings/account')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Shield />} label={t('settings.row.privacy')} sublabel={t('settings.row.privacy_sub')} onClick={() => navigate('/settings/privacy')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<TrendingUp />} label={t('settings.row.insights') || 'Wardrobe Insights'} sublabel={t('settings.row.insights_sub') || 'Usage stats & analytics'} onClick={() => navigate('/insights')} last={!isAdmin}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Sparkles />} label={t('settings.row.view_coach') || 'View coach'} sublabel={t('settings.row.view_coach_sub') || 'Replay the guided walkthrough any time'} onClick={async () => { await coach.restartCoach(); navigate('/settings'); }} last={false}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          {isAdmin && (
            <SettingsRow icon={<Database />} label="Seed Wardrobe" sublabel="Generate demo garments with AI" onClick={() => navigate('/settings/seed-wardrobe')}>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
            </SettingsRow>
          )}
        </SettingsGroup>

        {/* Sign out */}
        <SettingsGroup>
          <SettingsRow icon={<LogOut />} label={t('settings.sign_out')} onClick={handleSignOut} last className="text-destructive [&_span]:text-destructive [&_.settings-icon]:bg-destructive/10">
            <ChevronRight className="w-4 h-4 text-destructive/30" />
          </SettingsRow>
        </SettingsGroup>

        {/* App version */}
        <p className="text-[11px] text-muted-foreground/30 text-center pt-4">BURS v{APP_VERSION}</p>
      </AnimatedPage>
    </AppLayout>
  );
}
