import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { hapticLight } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BillingSuccess() {
  const navigate = useNavigate();
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
      <motion.div
        className="max-w-md w-full rounded-[1.25rem] p-8 space-y-6 border border-border/40"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-foreground mx-auto" />
          <h1 className="font-display italic text-2xl font-bold flex items-center justify-center gap-2">
            <Crown className="w-5 h-5" />
            {t('billing.success_title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('billing.success_desc')}</p>
        </div>

        <div className="rounded-[1rem] p-4 space-y-2 border border-border/40">
          <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-foreground" /><span>{t('premium.unlimited_wardrobe')}</span></div>
          <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-foreground" /><span>{t('pricing.unlimited_outfits')}</span></div>
          <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-foreground" /><span>{t('premium.smarter_ai')}</span></div>
        </div>

        <div className="space-y-2">
          <Button variant="editorial" className="w-full rounded-full" onClick={() => { hapticLight(); navigate('/'); }}>{t('billing.start_using')}</Button>
          <Button variant="outline" className="w-full rounded-full border-border/40" onClick={() => { hapticLight(); navigate('/settings'); }}>{t('billing.manage')}</Button>
        </div>
      </motion.div>
    </div>
  );
}
