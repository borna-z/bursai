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
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { AnimatedRoutes } from "@/components/layout/AnimatedRoutes";
import { useDeepLink } from "@/hooks/useDeepLink";
import { useThemeChrome } from "@/hooks/useThemeChrome";
import { useViewportShell } from "@/hooks/useViewportShell";
import { CookieConsent } from "@/components/landing/CookieConsent";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

/** Renders nothing — just activates the deep link listener inside BrowserRouter */
function DeepLinkHandler() {
  useDeepLink();
  return null;
}

function AppEnvironment() {
  useViewportShell();
  useThemeChrome();
  return null;
}

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
          <AppEnvironment />
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

const App = () => <AppInner />;

export default App;
