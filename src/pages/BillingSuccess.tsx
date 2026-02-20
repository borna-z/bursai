import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BillingSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" />
            {t('billing.success_title')}
          </CardTitle>
          <CardDescription>{t('billing.success_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" /><span>{t('premium.unlimited_wardrobe')}</span></div>
            <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" /><span>{t('pricing.unlimited_outfits')}</span></div>
            <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" /><span>{t('premium.smarter_ai')}</span></div>
          </div>
          <Button className="w-full" onClick={() => navigate('/')}>{t('billing.start_using')}</Button>
          <Button variant="outline" className="w-full" onClick={() => navigate('/settings')}>{t('billing.manage')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}