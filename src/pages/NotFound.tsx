import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { safeT } from '@/lib/i18nFallback';

// Hardcoded English fallbacks. Used when t() falls back to its humanized last
// segment (out-of-provider scenario or empty dictionary cache — e.g. unit tests
// or top-level error boundary). NotFound MUST always render readable copy.
// (Codex P1, PR #678)
const FALLBACK_TITLE = 'Page not found';
const FALLBACK_RETURN_HOME = 'Return to Home';

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
        <p className="font-body text-lg text-muted-foreground">{safeT(t, 'notfound.title', FALLBACK_TITLE)}</p>
        <Button onClick={() => { hapticLight(); navigate("/"); }} size="lg" className="cursor-pointer">
          {safeT(t, 'notfound.return_home', FALLBACK_RETURN_HOME)}
        </Button>
      </div>
    </AnimatedPage>
  );
};

export default NotFound;
