import { lazy, Suspense } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { AnimatedRoutes } from "@/components/layout/AnimatedRoutes";
import { useDeepLink } from "@/hooks/useDeepLink";
import { CookieConsent } from "@/components/landing/CookieConsent";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

/** Renders nothing — just activates the deep link listener inside BrowserRouter */
function DeepLinkHandler() {
  useDeepLink();
  return null;
}

function SentryFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            An unexpected error occurred. Try reloading the page.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => window.location.reload()}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Reload
        </Button>
      </div>
    </div>
  );
}

const SentryErrorBoundary = lazy(() =>
  import("@sentry/react").then((mod) => ({
    default: mod.ErrorBoundary,
  }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

const AppInner = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              <LocationProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <ScrollToTop />
                    <DeepLinkHandler />
                    <AnimatedRoutes />
                    <CookieConsent />
                  </BrowserRouter>
                </TooltipProvider>
              </LocationProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

const App = () => {
  const hasSentry = !!import.meta.env.VITE_SENTRY_DSN;

  if (hasSentry) {
    return (
      <Suspense fallback={<AppInner />}>
        <SentryErrorBoundary fallback={<SentryFallback />}>
          <AppInner />
        </SentryErrorBoundary>
      </Suspense>
    );
  }

  return <AppInner />;
};

export default App;
