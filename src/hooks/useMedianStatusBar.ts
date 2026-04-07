/**
 * useMedianStatusBar — Syncs Median status bar style on route changes.
 * Dark routes (landing, onboarding, auth) get light text (white on dark bg).
 * In-app routes match the resolved theme.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isMedianApp } from '@/lib/median';

const DARK_ROUTES = new Set(['/welcome', '/auth', '/onboarding']);

export function useMedianStatusBar(resolvedTheme: 'light' | 'dark') {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isMedianApp() || !window.median?.statusbar?.set) return;

    const isDarkRoute = DARK_ROUTES.has(pathname);
    // Median: 'light' = light/white text (for dark backgrounds)
    //         'dark'  = dark text (for light backgrounds)
    const style = isDarkRoute || resolvedTheme === 'dark' ? 'light' : 'dark';

    window.median.statusbar.set({ style });
  }, [pathname, resolvedTheme]);
}
