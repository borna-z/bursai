import { useTheme } from '@/contexts/ThemeContext';

/** Returns true when the resolved theme is dark */
export function useIsDark() {
  const { theme } = useTheme();
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
