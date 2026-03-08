import { useNavigate } from 'react-router-dom';
import { Palette, Shirt, Bell, User, Shield, LogOut, ChevronRight, Loader2, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { AnimatedPage } from '@/components/ui/animated-page';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { t } = useLanguage();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <AnimatedPage className="px-6 pb-8 pt-12 space-y-10 max-w-lg mx-auto">
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
          <SettingsRow icon={<TrendingUp />} label={t('settings.row.insights') || 'Wardrobe Insights'} sublabel={t('settings.row.insights_sub') || 'Usage stats & analytics'} onClick={() => navigate('/insights')} last>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
        </SettingsGroup>

        {/* Sign out */}
        <SettingsGroup>
          <SettingsRow icon={<LogOut />} label={t('settings.sign_out')} onClick={handleSignOut} last className="text-destructive [&_span]:text-destructive [&_.settings-icon]:bg-destructive/10">
            <ChevronRight className="w-4 h-4 text-destructive/30" />
          </SettingsRow>
        </SettingsGroup>
      </AnimatedPage>
    </AppLayout>
  );
}
