import { useNavigate } from 'react-router-dom';
import { Palette, Shirt, Bell, User, Shield, LogOut, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';

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
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title={t('settings.title')} />

      <div className="px-4 pb-6 pt-4 space-y-6 max-w-lg mx-auto">
        <SettingsGroup>
          <SettingsRow icon={<Palette />} label="Utseende" sublabel="Tema, accentfärg, språk" onClick={() => navigate('/settings/appearance')}>
            <ChevronRight className="w-4 h-4 text-accent" />
          </SettingsRow>
          <SettingsRow icon={<Shirt />} label="Stil" sublabel="Kroppsmått, färger, passform" onClick={() => navigate('/settings/style')}>
            <ChevronRight className="w-4 h-4 text-accent" />
          </SettingsRow>
          <SettingsRow icon={<Bell />} label="Notiser & Kalender" sublabel="Påminnelser, kalendersynk" onClick={() => navigate('/settings/notifications')}>
            <ChevronRight className="w-4 h-4 text-accent" />
          </SettingsRow>
          <SettingsRow icon={<User />} label="Profil & Konto" sublabel="Premium, namn, e-post" onClick={() => navigate('/settings/account')}>
            <ChevronRight className="w-4 h-4 text-accent" />
          </SettingsRow>
          <SettingsRow icon={<Shield />} label="Data & Integritet" sublabel="Exportera, radera konto" onClick={() => navigate('/settings/privacy')} last>
            <ChevronRight className="w-4 h-4 text-accent" />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow icon={<LogOut />} label={t('settings.sign_out')} onClick={handleSignOut} last className="text-destructive [&_span]:text-destructive">
            <ChevronRight className="w-4 h-4 text-destructive/60" />
          </SettingsRow>
        </SettingsGroup>
      </div>
    </AppLayout>
  );
}
