/**
 * useDeepLink — Handles Median universal links and deep link navigation.
 * Parses incoming URLs on app launch and navigates via React Router.
 */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isMedianApp } from '@/lib/median';

const DEEP_LINK_PATTERNS = [
  { pattern: /^\/u\/([^/]+)$/, handler: (m: RegExpMatchArray) => `/u/${m[1]}` },
  { pattern: /^\/outfit\/([^/]+)$/, handler: (m: RegExpMatchArray) => `/outfit/${m[1]}` },
  { pattern: /^\/auth/, handler: () => '/auth' },
  { pattern: /^\/share\/([^/]+)$/, handler: (m: RegExpMatchArray) => `/share/${m[1]}` },
] as const;

export function useDeepLink() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isMedianApp()) return;

    const handleDeepLink = (event: Event) => {
      const url = (event as CustomEvent)?.detail?.url;
      if (!url) return;

      try {
        const parsed = new URL(url);
        const path = parsed.pathname;

        for (const { pattern, handler } of DEEP_LINK_PATTERNS) {
          const match = path.match(pattern);
          if (match) {
            navigate(handler(match), { replace: true });
            return;
          }
        }
      } catch {
        // Invalid URL — ignore
      }
    };

    // Median fires 'median://deeplink' or we parse initial URL
    window.addEventListener('median-deeplink', handleDeepLink);

    // Also handle initial URL if it matches a deep link pattern
    const currentPath = location.pathname;
    for (const { pattern } of DEEP_LINK_PATTERNS) {
      const match = currentPath.match(pattern);
      if (match) {
        // Already on the right route — no action needed
        break;
      }
    }

    return () => {
      window.removeEventListener('median-deeplink', handleDeepLink);
    };
  }, [navigate, location.pathname]);
}
