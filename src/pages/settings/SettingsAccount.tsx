import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Trash2, Loader2, Download, Mail } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { PremiumSection } from '@/components/PremiumSection';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM } from '@/lib/motion';

export default function SettingsAccount() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { subscription, isPremium, limits } = useSubscription();
  const { t } = useLanguage();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveDisplayName = async () => {
    try { await updateProfile.mutateAsync({ display_name: displayName }); toast.success(t('settings.name_saved')); }
    catch { toast.error(t('settings.name_error')); }
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
    } catch (err) {
      logger.error('Delete account failed:', err);
      toast.error(t('settings.delete_error'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.account')} showBack titleClassName="font-display italic" />

      <AnimatedPage className="px-4 pb-8 pt-5 space-y-5 max-w-lg mx-auto">

        {/* V4 Avatar + Name */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
          className="flex flex-col items-center gap-3 pb-2"
        >
          <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
            <User className="w-8 h-8 text-accent" />
          </div>
        </motion.div>

        {/* Profile section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY }}
        >
          <SettingsGroup title={t('settings.display_name') || 'DISPLAY NAME'}>
            <div className="px-5 py-4 border-b border-border/35 space-y-2.5">
              <div className="flex gap-2.5">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('settings.your_name')} className="h-11 text-sm font-body rounded-xl border-border/40" />
                <Button onClick={() => { hapticLight(); handleSaveDisplayName(); }} disabled={updateProfile.isPending} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 h-11 text-xs px-5 rounded-full font-body">
                  {t('settings.save')}
                </Button>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="label-editorial text-muted-foreground/50 mb-1">{t('settings.email_label') || 'EMAIL ADDRESS'}</p>
              <p className="text-sm font-body text-foreground">{user?.email}</p>
              <p className="text-[11px] text-muted-foreground/50 mt-1 font-body">{t('settings.email_change_note') || 'Email cannot be changed manually. Contact support.'}</p>
            </div>
          </SettingsGroup>
        </motion.div>

        {/* Membership */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 2 }}
        >
          <PremiumSection isPremium={isPremium} subscription={subscription} limits={limits} />
        </motion.div>

        {/* Data & Privacy */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 3 }}
        >
          <SettingsGroup title={t('settings.data_privacy_title') || 'DATA & PRIVACY'}>
            <SettingsRow icon={<Download />} label={t('settings.export') || 'Export wardrobe data'} onClick={() => { hapticLight(); navigate('/settings/privacy'); }} last>
              <Mail className="w-4 h-4 text-accent" />
            </SettingsRow>
          </SettingsGroup>
        </motion.div>

        {/* Delete Account */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 4 }}
          className="pt-2"
        >
          <div className="surface-secondary rounded-[1.25rem] overflow-hidden">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" className="w-full">
                  <SettingsRow icon={<Trash2 />} label={t('settings.delete_account')} last className="text-destructive [&_span]:text-destructive">
                    <Loader2 className={`w-4 h-4 text-destructive/60 ${isDeleting ? 'animate-spin' : 'hidden'}`} />
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
                  <AlertDialogAction onClick={() => { hapticLight(); handleDeleteAccount(); }} className="bg-destructive text-destructive-foreground rounded-full" disabled={isDeleting}>
                    {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('settings.delete_permanently')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>
      </AnimatedPage>
    </AppLayout>
  );
}
