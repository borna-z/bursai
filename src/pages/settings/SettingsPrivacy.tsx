import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsGroup } from '@/components/settings/SettingsGroup';

export default function SettingsPrivacy() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const [garmentsRes, outfitsRes, profileRes] = await Promise.all([
        supabase.from('garments').select('*').eq('user_id', user?.id),
        supabase.from('outfits').select('*, outfit_items(*)').eq('user_id', user?.id),
        supabase.from('profiles').select('*').eq('id', user?.id).single(),
      ]);
      const data = { profile: profileRes.data, garments: garmentsRes.data, outfits: outfitsRes.data, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garderobsassistent-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('settings.export_success'));
    } catch { toast.error(t('settings.export_error')); }
    finally { setIsExporting(false); }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete_user_account');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      toast.success(t('settings.delete_success'));
      navigate('/auth');
    } catch (error) { console.error('Delete account failed:', error); toast.error(t('settings.delete_error')); }
    finally { setIsDeleting(false); }
  };

  return (
    <AppLayout>
      <PageHeader title="Data & Integritet" showBack />

      <div className="px-4 pb-6 pt-4 space-y-6 max-w-lg mx-auto">
        <SettingsGroup title={t('settings.privacy')}>
          <SettingsRow icon={<Download />} label={t('settings.export')} onClick={isExporting ? undefined : handleExportData}>
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <ChevronRight className="w-4 h-4 text-accent" />}
          </SettingsRow>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div>
                <SettingsRow icon={<Trash2 />} label={t('settings.delete_account')} last className="text-destructive [&_span]:text-destructive">
                  <ChevronRight className="w-4 h-4 text-destructive/60" />
                </SettingsRow>
              </div>
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
        </SettingsGroup>
      </div>
    </AppLayout>
  );
}
