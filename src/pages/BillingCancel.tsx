import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { hapticLight } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BillingCancel() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        className="max-w-md w-full rounded-[1.25rem] p-8 space-y-6 border border-border/40"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center space-y-4">
          <XCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="font-display italic text-2xl font-bold">{t('billing.cancel_title')}</h1>
          <p className="text-sm text-muted-foreground">{t('billing.cancel_desc')}</p>
        </div>

        <p className="text-sm text-muted-foreground text-center">{t('billing.cancel_contact')}</p>
        <Button variant="editorial" className="w-full rounded-full" onClick={() => { hapticLight(); navigate('/'); }}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('billing.back_to_app')}
        </Button>
      </motion.div>
    </div>
  );
}
