import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Trash2, ChevronRight, ChevronDown, Loader2, Shield, Database, ToggleLeft, Scale, Mail, User, Image, Calendar, MessageSquare, Ruler, ExternalLink } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { logger } from '@/lib/logger';
import { asPreferences } from '@/types/preferences';
import type { Json } from '@/integrations/supabase/types';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { cn } from '@/lib/utils';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM } from '@/lib/motion';

type SectionId = 'about' | 'data' | 'consent' | 'rights';

interface ConsentPrefs {
  analytics?: boolean;
  ai_conversations?: boolean;
  body_data?: boolean;
  updated_at?: string;
}

export default function SettingsPrivacy() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  const preferences = asPreferences(profile?.preferences);
  const consent = (preferences.consent as ConsentPrefs) || { analytics: true, ai_conversations: true, body_data: true };

  const toggle = (id: SectionId) => { hapticLight(); setOpenSection(prev => prev === id ? null : id); };

  const updateConsent = async (key: keyof ConsentPrefs, value: boolean) => {
    const newConsent = { ...consent, [key]: value, updated_at: new Date().toISOString() } as Record<string, unknown>;
    const newPrefs = { ...preferences, consent: newConsent } as Record<string, unknown>;
    try {
      await updateProfile.mutateAsync({ preferences: newPrefs as unknown as Json });
      toast.success(t('settings.gdpr.consent_saved'));
    } catch {
      toast.error(t('settings.pref_error'));
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const userId = user?.id ?? '';
      const [garmentsRes, outfitsRes, profileRes] = await Promise.all([
        supabase.from('garments').select('*').eq('user_id', userId),
        supabase.from('outfits').select('*, outfit_items(*)').eq('user_id', userId),
        supabase.from('profiles').select('*').eq('id', userId).single(),
      ]);
      const data = { profile: profileRes.data, garments: garmentsRes.data, outfits: outfitsRes.data, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `burs-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('settings.export_success'));
    } catch { toast.error(t('settings.export_error')); }
    finally { setIsExporting(false); }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await invokeEdgeFunction<{ success: boolean; error?: string }>('delete_user_account', { retries: 0, timeout: 30000 });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      toast.success(t('settings.delete_success'));
      await signOut();
      navigate('/auth');
    } catch (err) { logger.error('Delete account failed:', err); toast.error(t('settings.delete_error')); }
    finally { setIsDeleting(false); }
  };

  const SectionHeader = ({ id, title, icon: Icon }: { id: SectionId; title: string; icon: React.ElementType }) => (
    <CollapsibleTrigger
      onClick={() => toggle(id)}
      className="flex items-center justify-between w-full px-5 py-4 text-left cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] bg-accent/10">
          <Icon className="w-4 h-4 text-accent" />
        </span>
        <span className="text-[15px] font-medium text-foreground">{title}</span>
      </div>
      <ChevronDown
        className={cn(
          'w-4 h-4 text-muted-foreground/50 transition-transform duration-200',
          openSection === id && 'rotate-180'
        )}
      />
    </CollapsibleTrigger>
  );

  const DataRow = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
      <span className="text-sm font-body text-foreground">{label}</span>
    </div>
  );

  const ConsentRow = ({ label, description, checked, onChange, last }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; last?: boolean }) => (
    <div className={cn('flex items-center justify-between px-5 py-4', !last && 'border-b border-border/35')}>
      <div className="flex-1 mr-3">
        <p className="text-[15px] font-medium text-foreground">{label}</p>
        <p className="text-[12px] text-muted-foreground/60 mt-0.5 font-body">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={(v) => { hapticLight(); onChange(v); }} />
    </div>
  );

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.privacy') || 'Privacy'} showBack titleClassName="font-display italic" />

      <AnimatedPage className="px-[var(--page-px)] pb-8 pt-5 space-y-4 max-w-lg mx-auto">

        {/* V4 editorial header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
          className="text-center space-y-1.5 pb-2"
        >
          <h2 className="font-display italic text-[1.5rem] text-foreground">{t('settings.data_sovereignty_title') || 'Data Sovereignty'}</h2>
          <p className="font-body text-sm text-muted-foreground/70 max-w-[280px] mx-auto">{t('settings.data_sovereignty_desc') || 'Manage how your digital archive is curated and shared across the BURS ecosystem.'}</p>
        </motion.div>

        {/* About BURS */}
        <Collapsible open={openSection === 'about'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="about" title={t('settings.gdpr.about_title')} icon={Shield} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('settings.gdpr.about_controller')}</span>
                <span className="font-medium text-foreground">{t('settings.gdpr.about_controller_value')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('settings.gdpr.about_contact')}</span>
                <a href="mailto:privacy@burs.se" className="font-medium text-accent">{t('settings.gdpr.about_contact_value')}</a>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                {t('settings.gdpr.about_purpose')}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Your Data */}
        <Collapsible open={openSection === 'data'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="data" title={t('settings.gdpr.your_data_title')} icon={Database} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="pb-3">
              <DataRow icon={User} label={t('settings.gdpr.data_profile')} />
              <DataRow icon={Image} label={t('settings.gdpr.data_wardrobe')} />
              <DataRow icon={Scale} label={t('settings.gdpr.data_outfits')} />
              <DataRow icon={MessageSquare} label={t('settings.gdpr.data_ai')} />
              <DataRow icon={Ruler} label={t('settings.gdpr.data_body')} />
              <DataRow icon={Calendar} label={t('settings.gdpr.data_calendar')} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Consent */}
        <Collapsible open={openSection === 'consent'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="consent" title={t('settings.gdpr.consent_title')} icon={ToggleLeft} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <ConsentRow
              label={t('settings.gdpr.consent_analytics')}
              description={t('settings.gdpr.consent_analytics_desc')}
              checked={consent.analytics !== false}
              onChange={(v) => updateConsent('analytics', v)}
            />
            <ConsentRow
              label={t('settings.gdpr.consent_ai')}
              description={t('settings.gdpr.consent_ai_desc')}
              checked={consent.ai_conversations !== false}
              onChange={(v) => updateConsent('ai_conversations', v)}
            />
            <ConsentRow
              label={t('settings.gdpr.consent_body')}
              description={t('settings.gdpr.consent_body_desc')}
              checked={consent.body_data !== false}
              onChange={(v) => updateConsent('body_data', v)}
              last
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Your Rights */}
        <Collapsible open={openSection === 'rights'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="rights" title={t('settings.gdpr.rights_title')} icon={Scale} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div>
              <SettingsRow icon={<Download />} label={t('settings.export')} onClick={isExporting ? undefined : () => { hapticLight(); handleExportData(); }}>
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <ChevronRight className="w-4 h-4 text-accent" />}
              </SettingsRow>
              <SettingsRow icon={<Mail />} label={t('settings.gdpr.rights_edit')} onClick={() => { hapticLight(); navigate('/settings/account'); }}>
                <ChevronRight className="w-4 h-4 text-accent" />
              </SettingsRow>
              <SettingsRow icon={<ExternalLink />} label={t('settings.gdpr.rights_privacy_policy')} onClick={() => { hapticLight(); navigate('/privacy'); }}>
                <ChevronRight className="w-4 h-4 text-accent" />
              </SettingsRow>
              <SettingsRow icon={<ExternalLink />} label={t('settings.gdpr.rights_terms')} onClick={() => { hapticLight(); navigate('/terms'); }} last>
                <ChevronRight className="w-4 h-4 text-accent" />
              </SettingsRow>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Editorial quote */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 5 }}
          className="rounded-[1.25rem] p-5 text-center space-y-2"
        >
          <p className="font-display italic text-[15px] text-foreground/80 leading-relaxed">
            {t('settings.privacy_quote') || '"Your style is your signature. Your data is your property."'}
          </p>
        </motion.div>

        {/* Delete Account - standalone destructive */}
        <div className="pt-3">
          <p className="label-editorial text-muted-foreground/60 px-1 mb-2.5">
            {t('settings.gdpr.danger_zone')}
          </p>
          <div className="rounded-[1.25rem] overflow-hidden border border-border/40">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" className="w-full text-left">
                  <SettingsRow icon={<Trash2 />} label={t('settings.delete_account')} last className="text-destructive [&_span]:text-destructive">
                    <ChevronRight className="w-4 h-4 text-destructive/60" />
                  </SettingsRow>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.delete_permanent')}</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>{t('settings.delete_warning')}</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>{t('settings.delete_garments')}</li>
                      <li>{t('settings.delete_outfits')}</li>
                      <li>{t('settings.delete_history')}</li>
                      <li>{t('settings.delete_profile')}</li>
                      <li>{t('settings.delete_account_item')}</li>
                    </ul>
                    <p className="font-medium text-destructive pt-2">{t('settings.delete_irreversible')}</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { hapticLight(); handleDeleteAccount(); }} className="bg-destructive text-destructive-foreground" disabled={isDeleting}>
                    {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('settings.delete_permanently')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

      </AnimatedPage>
    </AppLayout>
  );
}
