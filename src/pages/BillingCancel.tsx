import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BillingCancel() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-border bg-card p-8 space-y-6">
        <div className="text-center space-y-4">
          <XCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">{t('billing.cancel_title')}</h1>
          <p className="text-sm text-muted-foreground">{t('billing.cancel_desc')}</p>
        </div>

        <p className="text-sm text-muted-foreground text-center">{t('billing.cancel_contact')}</p>
        <Button className="w-full" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('billing.back_to_app')}
        </Button>
      </div>
    </div>
  );
}
