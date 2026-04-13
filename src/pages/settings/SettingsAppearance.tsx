import { motion } from 'framer-motion';
import { Sun, Moon, Monitor, Globe } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
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
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM } from '@/lib/motion';
import { cn } from '@/lib/utils';

export default function SettingsAppearance() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const { data: isAdmin } = useIsAdmin();

  const themeOptions = [
    { key: 'light' as const, icon: Sun, label: t('settings.theme.light') },
    { key: 'dark' as const, icon: Moon, label: t('settings.theme.dark') },
    { key: 'system' as const, icon: Monitor, label: t('settings.theme.auto') },
  ];

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.appearance')} showBack titleClassName="font-display italic" />

      <AnimatedPage className="px-[var(--page-px)] pb-8 pt-5 space-y-5 max-w-lg mx-auto">

        {/* V4 Visual Preview card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
        >
          <p className="label-editorial text-muted-foreground/60 px-1 mb-2.5">{t('settings.visual_preview') || 'VISUAL PREVIEW'}</p>
          <div className="rounded-[1.25rem] p-5 flex flex-col items-center gap-3">
            <div className="w-full max-w-[220px] rounded-xl border border-border/40 bg-background p-4 space-y-2.5 shadow-sm">
              <div className="h-2.5 w-3/4 rounded-full bg-muted/60" />
              <div className="h-2 w-1/2 rounded-full bg-muted/40" />
              <Button size="sm" className="w-full bg-accent text-accent-foreground rounded-full h-9 text-xs font-body">
                {t('settings.action_button') || 'Action Button'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/60 font-body">{t('settings.preview_desc') || 'Changes reflect in real-time'}</p>
          </div>
        </motion.div>

        {/* Interface Mode */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY }}
        >
          <p className="label-editorial text-muted-foreground/60 px-1 mb-2.5">{t('settings.interface_mode') || 'INTERFACE MODE'}</p>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => { hapticLight(); setTheme(key); }}
                className={cn(
                  'rounded-[1.25rem] p-4 flex flex-col items-center gap-2.5 transition-all duration-200 border border-border/40',
                  theme === key && 'ring-2 ring-accent ring-offset-2 ring-offset-background'
                )}
              >
                <Icon className={cn('w-6 h-6', theme === key ? 'text-accent' : 'text-muted-foreground/60')} />
                <span className={cn('text-xs font-body font-medium', theme === key ? 'text-foreground' : 'text-muted-foreground/70')}>{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Accent Color */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 2 }}
        >
          <p className="label-editorial text-muted-foreground/60 px-1 mb-2.5">{t('settings.accent_color') || 'ACCENT COLOR'}</p>
          <div className="rounded-[1.25rem] overflow-hidden px-5 py-4">
            <AccentColorPicker />
          </div>
        </motion.div>

        {/* Language */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 3 }}
          >
            <p className="label-editorial text-muted-foreground/60 px-1 mb-2.5">{t('settings.display_language') || 'DISPLAY LANGUAGE'}</p>
            <div className="rounded-[1.25rem] overflow-hidden border border-border/40">
              <SettingsRow icon={<Globe />} label={t('settings.language')} last>
                <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                  <SelectTrigger className="w-[150px] h-11 text-xs border-0 bg-background/60 rounded-xl font-body">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LOCALES.map((loc) => (
                      <SelectItem key={loc.code} value={loc.code}>{loc.flag} {loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsRow>
            </div>
          </motion.div>
        )}
      </AnimatedPage>
    </AppLayout>
  );
}
