import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { SeedProvider } from "@/contexts/SeedContext";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { AnimatedRoutes } from "@/components/layout/AnimatedRoutes";
import { CookieConsent } from "@/components/landing/CookieConsent";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

// Lazy-load Sentry ErrorBoundary — only wraps if Sentry is available
const SentryErrorBoundary = lazy(() =>
  import("@sentry/react").then((mod) => ({
    default: mod.ErrorBoundary,
  }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,      // 2 minutes
      gcTime: 1000 * 60 * 30,         // 30 minutes — keep cache longer for offline
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: 'offlineFirst',     // serve cached data when offline
    },
    mutations: {
      networkMode: 'offlineFirst',
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
              <SeedProvider>
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
              </SeedProvider>
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
        <SentryErrorBoundary fallback={<ErrorBoundary><></></ErrorBoundary>}>
          <AppInner />
        </SentryErrorBoundary>
      </Suspense>
    );
  }

  return <AppInner />;
};

export default App;
