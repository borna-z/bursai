import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    logger.warn("404: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AnimatedPage className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="font-display italic text-6xl font-bold text-foreground">404</h1>
        <p className="font-body text-lg text-muted-foreground">Page not found</p>
        <Button onClick={() => { hapticLight(); navigate("/"); }} size="lg" className="cursor-pointer">
          Return to Home
        </Button>
      </div>
    </AnimatedPage>
  );
};

export default NotFound;
