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
import { PageHeader } from '@/components/layout/PageHeader';
import { hapticLight } from '@/lib/haptics';
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
      <PageHeader
        title={t('settings.page_title')}
        titleClassName="font-display italic"
        eyebrow={t('settings.eyebrow')}
        actions={
          <span className="eyebrow-chip border-border/30 bg-background/40 text-[10px] text-foreground/58">v{APP_VERSION}</span>
        }
      />
      <AnimatedPage className="page-shell space-y-7">

        {/* Profile */}
        <ProfileCard />

        {/* How you look */}
        <SettingsGroup title={t('settings.group.how_you_look')}>
          <SettingsRow icon={<Palette />} label={t('settings.row.appearance')} sublabel={t('settings.row.appearance_sub')} onClick={() => { hapticLight(); navigate('/settings/appearance'); }}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Shirt />} label={t('settings.row.style')} sublabel={t('settings.row.style_sub')} onClick={() => { hapticLight(); navigate('/settings/style'); }} last>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
        </SettingsGroup>

        {/* When we reach you */}
        <SettingsGroup title={t('settings.group.when_we_reach_you')}>
          <SettingsRow icon={<Bell />} label={t('settings.row.notifications')} sublabel={t('settings.row.notifications_sub')} onClick={() => { hapticLight(); navigate('/settings/notifications'); }} last>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
        </SettingsGroup>

        {/* Your account */}
        <SettingsGroup title={t('settings.group.your_account')}>
          <SettingsRow icon={<User />} label={t('settings.row.account')} sublabel={t('settings.row.account_sub')} onClick={() => { hapticLight(); navigate('/settings/account'); }}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Shield />} label={t('settings.row.privacy')} sublabel={t('settings.row.privacy_sub')} onClick={() => { hapticLight(); navigate('/settings/privacy'); }} last>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
        </SettingsGroup>

        {/* App */}
        <SettingsGroup title={t('settings.group.app')}>
          <SettingsRow icon={<TrendingUp />} label={t('settings.row.insights') || 'Wardrobe Insights'} sublabel={t('settings.row.insights_sub') || 'Usage stats & analytics'} onClick={() => { hapticLight(); navigate('/insights'); }}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Sparkles />} label={t('settings.row.view_coach') || 'View coach'} sublabel={t('settings.row.view_coach_sub') || 'Replay the guided walkthrough any time'} onClick={async () => { hapticLight(); await coach.restartCoach(); navigate('/settings'); }} last={!isAdmin}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          {isAdmin && (
            <SettingsRow icon={<Database />} label={t('settings.seed_wardrobe')} sublabel={t('settings.seed_wardrobe_sub')} onClick={() => { hapticLight(); navigate('/settings/seed-wardrobe'); }} last>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
            </SettingsRow>
          )}
        </SettingsGroup>

        {/* Sign out */}
        <SettingsGroup>
          <SettingsRow icon={<LogOut />} label={t('settings.sign_out')} onClick={() => { hapticLight(); handleSignOut(); }} last className="text-destructive [&_span]:text-destructive [&_.settings-icon]:bg-destructive/10">
            <ChevronRight className="w-4 h-4 text-destructive/30" />
          </SettingsRow>
        </SettingsGroup>
      </AnimatedPage>
    </AppLayout>
  );
}
