import { useNavigate } from 'react-router-dom';
import { Palette, Shirt, Bell, User, Shield, LogOut, ChevronRight, TrendingUp, Database } from 'lucide-react';
import { SettingsPageSkeleton } from '@/components/ui/skeletons';
import { useQuery } from '@tanstack/react-query';

const APP_VERSION = (globalThis as any).__APP_VERSION__ ?? '1.0.0';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { AnimatedPage } from '@/components/ui/animated-page';
import { supabase } from '@/integrations/supabase/client';

function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { t } = useLanguage();
  const { data: isAdmin } = useIsAdmin();

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
          <SettingsRow icon={<TrendingUp />} label={t('settings.row.insights') || 'Wardrobe Insights'} sublabel={t('settings.row.insights_sub') || 'Usage stats & analytics'} onClick={() => navigate('/insights')} last={!isAdmin}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          {isAdmin && (
            <SettingsRow icon={<Database />} label="Seed Wardrobe" sublabel="Generate demo garments with AI" onClick={() => navigate('/settings/seed-wardrobe')}>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
            </SettingsRow>
          )}
        </SettingsGroup>

        {/* Social */}
        <SettingsGroup>
          <SettingsRow icon={<Compass />} label={t('settings.inspiration')} sublabel={t('feed.title')} onClick={() => navigate('/feed')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Trophy />} label={t('settings.challenges')} sublabel={t('challenges.title')} onClick={() => navigate('/challenges')} last>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
        </SettingsGroup>

        {/* AI Tools */}
        <SettingsGroup>
          <SettingsRow icon={<Search />} label={t('ai.visual_search')} sublabel={t('ai.vs_settings_sub')} onClick={() => navigate('/ai/visual-search')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Heart />} label={t('ai.mood_title')} sublabel={t('ai.mood_settings_sub')} onClick={() => navigate('/ai/mood-outfit')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<ShoppingBag />} label={t('ai.shopping_title')} sublabel={t('ai.shopping_settings_sub')} onClick={() => navigate('/ai/smart-shopping')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Clock />} label={t('ai.aging_title')} sublabel={t('ai.aging_settings_sub')} onClick={() => navigate('/ai/wardrobe-aging')}>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
          <SettingsRow icon={<Users />} label={t('ai.twin_title')} sublabel={t('ai.twin_settings_sub')} onClick={() => navigate('/ai/style-twin')} last>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </SettingsRow>
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
