import { Sun, Moon, Monitor, Globe } from 'lucide-react';
import AnimatedPage from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/types';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { AccentColorPicker } from '@/components/settings/AccentColorPicker';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';

export default function SettingsAppearance() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const { data: isAdmin } = useIsAdmin();

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.appearance')} showBack />

      <AnimatedPage className="px-4 pb-6 pt-4 space-y-6 max-w-lg mx-auto">
        <SettingsGroup title={t('settings.appearance')}>
          <div className="px-4 py-3 border-b border-border/50">
            <div className="flex gap-1.5">
              <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => { hapticLight(); setTheme('light'); }} className={`flex-1 h-11 text-xs ${theme === 'light' ? 'bg-accent text-accent-foreground' : ''}`}>
                <Sun className="w-3.5 h-3.5 mr-1.5" />{t('settings.theme.light')}
              </Button>
              <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => { hapticLight(); setTheme('dark'); }} className={`flex-1 h-11 text-xs ${theme === 'dark' ? 'bg-accent text-accent-foreground' : ''}`}>
                <Moon className="w-3.5 h-3.5 mr-1.5" />{t('settings.theme.dark')}
              </Button>
              <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => { hapticLight(); setTheme('system'); }} className={`flex-1 h-11 text-xs ${theme === 'system' ? 'bg-accent text-accent-foreground' : ''}`}>
                <Monitor className="w-3.5 h-3.5 mr-1.5" />{t('settings.theme.auto')}
              </Button>
            </div>
          </div>
          <div className="px-4 py-3">
            <AccentColorPicker />
          </div>
        </SettingsGroup>

        {isAdmin && (
          <SettingsGroup title={t('settings.language')}>
            <SettingsRow icon={<Globe />} label={t('settings.language')} last>
              <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                <SelectTrigger className="w-[130px] h-11 text-xs border-0 bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LOCALES.map((loc) => (
                    <SelectItem key={loc.code} value={loc.code}>{loc.flag} {loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsGroup>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
