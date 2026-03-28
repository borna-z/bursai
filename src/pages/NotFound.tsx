import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    logger.warn("404: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="font-['Playfair_Display'] italic text-6xl font-bold text-foreground">404</h1>
        <p className="font-['DM_Sans'] text-lg text-muted-foreground">Page not found</p>
        <Button onClick={() => navigate("/")} size="lg">
          Return to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
