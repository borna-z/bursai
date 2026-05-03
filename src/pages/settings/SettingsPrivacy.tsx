import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Download, Trash2, ChevronRight, ChevronDown, Loader2, Shield, Database, ToggleLeft, Scale, Mail, User, Image, Calendar, MessageSquare, Ruler, ExternalLink, Sparkles } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
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
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Wave 8.5 PR B (P90) — Reset Style Memory
  const [isResettingMemory, setIsResettingMemory] = useState(false);
  // Audit R5-F5: typed-confirmation gate. The user must type "RESET"
  // (case-insensitive, trimmed) before the destructive button enables.
  // Prevents accidental taps + clickjacking + browser-extension-driven
  // single-click wipes. Cleared on dialog close so the gate re-arms next time.
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const RESET_CONFIRMATION_PHRASE = 'RESET';
  const isResetConfirmed =
    resetConfirmText.trim().toUpperCase() === RESET_CONFIRMATION_PHRASE;

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
    // Wave 8.5 PR B (P90) — extended GDPR export bundle.
    //
    // Legacy version exported 3 tables; this covers the 14 user-authored /
    // memory-relevant tables surfaced by the audit (§8b). Per-table
    // section dropped via JSON.stringify without indentation (audit P0-1
    // mitigation — large wardrobes can blow heap on indented stringify;
    // dropping `, 2` halves the size).
    setIsExporting(true);
    try {
      const userId = user?.id ?? '';
      if (!userId) {
        toast.error(t('settings.export_error'));
        return;
      }
      const [
        garmentsRes,
        outfitsRes,
        profileRes,
        summariesRes,
        signalsRes,
        pairsRes,
        wearLogsRes,
        chatMsgsRes,
        outfitFeedbackRes,
        outfitReactionsRes,
        swapEventsRes,
        plannedRes,
        styleProfilesRes,
        savesRes,
      ] = await Promise.all([
        supabase.from('garments').select('*').eq('user_id', userId),
        supabase.from('outfits').select('*, outfit_items(*)').eq('user_id', userId),
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_style_summaries').select('*').eq('user_id', userId),
        supabase.from('feedback_signals').select('*').eq('user_id', userId),
        supabase.from('garment_pair_memory').select('*').eq('user_id', userId),
        supabase.from('wear_logs').select('*').eq('user_id', userId),
        supabase.from('chat_messages').select('*').eq('user_id', userId),
        supabase.from('outfit_feedback').select('*').eq('user_id', userId),
        supabase.from('outfit_reactions').select('*').eq('user_id', userId),
        supabase.from('swap_events').select('*').eq('user_id', userId),
        supabase.from('planned_outfits').select('*').eq('user_id', userId),
        supabase.from('user_style_profiles').select('*').eq('user_id', userId),
        supabase.from('inspiration_saves').select('*').eq('user_id', userId),
      ]);

      // Self-audit P2: surface partial-failure to the user. Previously the
      // toast.success fired even when several SELECTs returned errors, so a
      // user could believe their export was complete when half the tables
      // were `[]`. Track which tables errored so we can warn instead.
      const tableResults: Array<{ name: string; error: unknown }> = [
        { name: 'profile', error: profileRes.error },
        { name: 'garments', error: garmentsRes.error },
        { name: 'outfits', error: outfitsRes.error },
        { name: 'user_style_summaries', error: summariesRes.error },
        { name: 'feedback_signals', error: signalsRes.error },
        { name: 'garment_pair_memory', error: pairsRes.error },
        { name: 'wear_logs', error: wearLogsRes.error },
        { name: 'chat_messages', error: chatMsgsRes.error },
        { name: 'outfit_feedback', error: outfitFeedbackRes.error },
        { name: 'outfit_reactions', error: outfitReactionsRes.error },
        { name: 'swap_events', error: swapEventsRes.error },
        { name: 'planned_outfits', error: plannedRes.error },
        { name: 'user_style_profiles', error: styleProfilesRes.error },
        { name: 'inspiration_saves', error: savesRes.error },
      ];
      const failedTables = tableResults.filter((r) => r.error != null);
      if (failedTables.length > 0) {
        logger.warn(
          'Export partial errors:',
          failedTables.map((r) => r.name),
        );
      }

      const data = {
        exportedAt: new Date().toISOString(),
        version: 2,
        // Wave 8.5 PR B (P90): structured partial-failure marker — when
        // present, the export is incomplete. Downstream tooling that
        // consumes the JSON can detect missing tables explicitly instead
        // of treating empty arrays as "user has zero rows in this table".
        partial: failedTables.length > 0
          ? failedTables.map((r) => r.name)
          : undefined,
        profile: profileRes.data ?? null,
        garments: garmentsRes.data ?? [],
        outfits: outfitsRes.data ?? [],
        // Memory tables (P0 per audit)
        user_style_summaries: summariesRes.data ?? [],
        feedback_signals: signalsRes.data ?? [],
        garment_pair_memory: pairsRes.data ?? [],
        wear_logs: wearLogsRes.data ?? [],
        // P1 tables
        chat_messages: chatMsgsRes.data ?? [],
        outfit_feedback: outfitFeedbackRes.data ?? [],
        outfit_reactions: outfitReactionsRes.data ?? [],
        swap_events: swapEventsRes.data ?? [],
        planned_outfits: plannedRes.data ?? [],
        // P2 tables
        user_style_profiles: styleProfilesRes.data ?? [],
        inspiration_saves: savesRes.data ?? [],
      };

      // Drop JSON indentation — large wardrobes (audit P0-1) can OOM
      // on a renderer with `JSON.stringify(data, null, 2)`. Compact form
      // ~halves the size.
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `burs-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      // Defer revoke so iOS Safari WebView completes the download (audit P2-1).
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (failedTables.length > 0) {
        // Partial export — user got SOME data but several tables failed.
        // Surface this so they don't believe the JSON is authoritative.
        toast.warning(
          `${t('settings.export_success')} (${failedTables.length} ${failedTables.length === 1 ? 'table' : 'tables'} partial)`,
        );
      } else {
        toast.success(t('settings.export_success'));
      }
    } catch (err) {
      logger.error('Export failed:', err);
      toast.error(t('settings.export_error'));
    } finally {
      setIsExporting(false);
    }
  };

  // Wave 8.5 PR B (P90) — Reset Style Memory handler.
  // Calls the destructive `reset_style_memory` edge fn, then invalidates
  // React Query keys for any cached memory views so the UI refreshes
  // immediately. Toast on success/error; no navigation.
  const handleResetStyleMemory = async () => {
    if (isResettingMemory) return;
    setIsResettingMemory(true);
    try {
      const { error } = await invokeEdgeFunction<{ ok: boolean }>(
        'reset_style_memory',
        { retries: 1, timeout: 15000 },
      );
      if (error) throw error;
      // Bust any cached memory-derived UI surfaces.
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['user-style-summary', user.id] });
        queryClient.invalidateQueries({ queryKey: ['feedback-signals', user.id] });
      }
      toast.success(
        t('settings.gdpr.reset_success') || 'Style memory cleared',
      );
    } catch (err) {
      logger.error('reset_style_memory failed:', err);
      toast.error(
        t('settings.gdpr.reset_error') || 'Could not clear style memory. Please try again.',
      );
    } finally {
      setIsResettingMemory(false);
    }
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
              <SettingsRow icon={<ExternalLink />} label={t('settings.gdpr.rights_terms')} onClick={() => { hapticLight(); navigate('/terms'); }}>
                <ChevronRight className="w-4 h-4 text-accent" />
              </SettingsRow>
              {/* Wave 8.5 PR B (P90) — Reset Style Memory */}
              {/* Audit R5-F5: typed-confirmation gate to prevent accidental
                  taps + clickjacking. User must type "RESET" before the
                  destructive button enables. Confirmation text clears on
                  dialog close so the gate re-arms next time. */}
              <AlertDialog
                open={resetDialogOpen}
                onOpenChange={(open) => {
                  setResetDialogOpen(open);
                  if (!open) setResetConfirmText('');
                }}
              >
                <AlertDialogTrigger asChild>
                  <button type="button" className="w-full text-left">
                    <SettingsRow icon={<Sparkles />} label={t('settings.gdpr.reset_memory') || 'Reset style memory'} last>
                      <ChevronRight className="w-4 h-4 text-accent" />
                    </SettingsRow>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('settings.gdpr.reset_memory_title') || 'Reset your style memory?'}</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>{t('settings.gdpr.reset_memory_warning') || 'This permanently clears everything BURS has learned about your taste — saves, ratings, swaps, rejections, and the patterns we built from them.'}</p>
                      <p>{t('settings.gdpr.reset_memory_what_clears') || 'Cleared: feedback signals, pair memory, style summary.'}</p>
                      <p>{t('settings.gdpr.reset_memory_what_preserves') || 'Preserved: your account, garments, outfits, planned outfits, and wear history.'}</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2 py-2">
                    <label htmlFor="reset-confirm-input" className="text-sm font-medium block">
                      {t('settings.gdpr.reset_memory_type_confirm') || `Type ${RESET_CONFIRMATION_PHRASE} to confirm:`}
                    </label>
                    <Input
                      id="reset-confirm-input"
                      data-testid="reset-confirm-input"
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder={RESET_CONFIRMATION_PHRASE}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      disabled={isResettingMemory}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="reset-confirm-action"
                      onClick={() => { hapticLight(); handleResetStyleMemory(); }}
                      disabled={isResettingMemory || !isResetConfirmed}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-destructive/40"
                    >
                      {isResettingMemory && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {t('settings.gdpr.reset_memory_confirm') || 'Yes, reset'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
