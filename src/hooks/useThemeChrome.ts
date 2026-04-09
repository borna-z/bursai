import { useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export function useThemeChrome() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const fallback = resolvedTheme === 'dark' ? '#0D0D0D' : '#F5F0E8';
    const background = getComputedStyle(document.body).backgroundColor || fallback;

    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', background);
    });

    document
      .querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.setAttribute('content', resolvedTheme === 'dark' ? 'black-translucent' : 'default');
  }, [resolvedTheme]);
}
