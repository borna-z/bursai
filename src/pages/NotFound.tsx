import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    logger.warn("404: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AnimatedPage className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="font-display italic text-6xl font-bold text-foreground">404</h1>
        <p className="font-body text-lg text-muted-foreground">{t('notfound.title')}</p>
        <Button onClick={() => { hapticLight(); navigate("/"); }} size="lg" className="cursor-pointer">
          {t('notfound.return_home')}
        </Button>
      </div>
    </AnimatedPage>
  );
};

export default NotFound;
