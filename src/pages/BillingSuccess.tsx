import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BillingSuccess() {
  const navigate = useNavigate();
  useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['subscription', user.id] });
      queryClient.invalidateQueries({ queryKey: ['stripe-subscription', user.id] });
    }
  }, [user?.id, queryClient]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-border bg-card p-8 space-y-6">
        <div className="text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-foreground mx-auto" />
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Crown className="w-5 h-5" />
            {t('billing.success_title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('billing.success_desc')}</p>
        </div>

        <div className="bg-muted p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-foreground" /><span>{t('premium.unlimited_wardrobe')}</span></div>
          <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-foreground" /><span>{t('pricing.unlimited_outfits')}</span></div>
          <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-foreground" /><span>{t('premium.smarter_ai')}</span></div>
        </div>

        <div className="space-y-2">
          <Button className="w-full" onClick={() => navigate('/')}>{t('billing.start_using')}</Button>
          <Button variant="outline" className="w-full" onClick={() => navigate('/settings')}>{t('billing.manage')}</Button>
        </div>
      </div>
    </div>
  );
}
