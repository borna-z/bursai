import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Trash2, Loader2 } from 'lucide-react';
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
      <PageHeader title={t('settings.row.account')} showBack />

      <div className="px-4 pb-6 pt-4 space-y-6 max-w-lg mx-auto">
        <div>
          <PremiumSection isPremium={isPremium} subscription={subscription} limits={limits} />
        </div>

        <SettingsGroup title={t('settings.profile')}>
          <div className="px-4 py-3 border-b border-border/50 space-y-2">
            <Label className="text-xs font-medium">{t('settings.display_name')}</Label>
            <div className="flex gap-2">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('settings.your_name')} className="h-9 text-sm" />
              <Button onClick={handleSaveDisplayName} disabled={updateProfile.isPending} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 h-9 text-xs px-4">
                {t('settings.save')}
              </Button>
            </div>
          </div>
          <SettingsRow icon={<User />} label={t('settings.email')} last>
            <span className="text-xs text-muted-foreground truncate max-w-[180px]">{user?.email}</span>
          </SettingsRow>
        </SettingsGroup>

        {/* Delete Account */}
        <div className="pt-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1.5">
            {t('settings.gdpr.danger_zone')}
          </p>
          <div className="bg-card rounded-xl overflow-hidden">
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
                  <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground" disabled={isDeleting}>
                    {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('settings.delete_permanently')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
