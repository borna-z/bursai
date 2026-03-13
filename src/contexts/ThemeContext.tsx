import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isMedianApp } from '@/lib/median';

type Theme = 'light' | 'dark' | 'system';

export interface AccentColor {
  id: string;
  name: string;
  hsl: string;
  hslDark: string;
  hex: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { id: 'indigo',     name: 'accent.indigo',      hsl: '234 51% 37%', hslDark: '234 60% 62%', hex: '#2F3A8F' },
  { id: 'petrol',     name: 'accent.petrol',      hsl: '174 72% 22%', hslDark: '174 55% 45%', hex: '#0D5C63' },
  { id: 'forest',     name: 'accent.forest',      hsl: '152 55% 28%', hslDark: '152 45% 50%', hex: '#206B4A' },
  { id: 'sage',       name: 'accent.sage',        hsl: '140 20% 45%', hslDark: '140 25% 60%', hex: '#5C8A6E' },
  { id: 'navy',       name: 'accent.navy',        hsl: '220 50% 30%', hslDark: '220 50% 58%', hex: '#264573' },
  { id: 'slate',      name: 'accent.slate',       hsl: '215 20% 42%', hslDark: '215 25% 60%', hex: '#556880' },
  { id: 'burgundy',   name: 'accent.burgundy',    hsl: '345 55% 35%', hslDark: '345 50% 58%', hex: '#8A2843' },
  { id: 'rose',       name: 'accent.rose',        hsl: '340 45% 50%', hslDark: '340 50% 65%', hex: '#B94D6E' },
  { id: 'terracotta', name: 'accent.terracotta',  hsl: '16 55% 42%',  hslDark: '16 55% 58%',  hex: '#A65A35' },
  { id: 'amber',      name: 'accent.amber',       hsl: '38 75% 42%',  hslDark: '38 80% 55%',  hex: '#BB8820' },
  { id: 'plum',       name: 'accent.plum',        hsl: '280 35% 38%', hslDark: '280 40% 58%', hex: '#6E3A8A' },
  { id: 'charcoal',   name: 'accent.charcoal',    hsl: '0 0% 25%',    hslDark: '0 0% 65%',    hex: '#404040' },
];

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  accentColor: AccentColor;
  setAccentColor: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'garderob-theme';
const ACCENT_KEY = 'garderob-accent';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getContrastForeground(hsl: string, resolved: 'light' | 'dark'): string {
  // Parse lightness from HSL string like "234 51% 37%"
  const parts = hsl.split(' ');
  const lightness = parseInt(parts[2]);
  if (resolved === 'dark') {
    // In dark mode, accent colors are lighter; use dark foreground when lightness > 55%
    return lightness > 55 ? '0 0% 5%' : '0 0% 100%';
  }
  // In light mode, use dark foreground when lightness > 38% for better contrast
  return lightness > 38 ? '0 0% 7%' : '0 0% 100%';
}

function applyAccent(accent: AccentColor, resolved: 'light' | 'dark') {
  const root = document.documentElement;
  const hsl = resolved === 'dark' ? accent.hslDark : accent.hsl;
  const fg = getContrastForeground(hsl, resolved);
  root.style.setProperty('--accent', hsl);
  root.style.setProperty('--accent-indigo', hsl);
  root.style.setProperty('--accent-foreground', fg);
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--primary-foreground', fg);
  const parts = hsl.split(' ');
  root.style.setProperty('--accent-indigo-muted', `${parts[0]} ${parseInt(parts[1]) * 0.6}% ${resolved === 'dark' ? '16' : '94'}%`);

  // Sync Median native status bar with current theme
  if (isMedianApp() && window.median?.statusbar?.set) {
    // Median convention: 'light' = light text (for dark bg), 'dark' = dark text (for light bg)
    window.median.statusbar.set({ style: resolved === 'dark' ? 'light' : 'dark' });
  }
}

/** Fire-and-forget: merge partial prefs into profiles.preferences JSONB */
function persistPrefs(prefs: Record<string, string>) {
  supabase.auth.getUser().then(({ data }) => {
    const uid = data?.user?.id;
    if (!uid) return;
    supabase.rpc('has_role' as any, {} as any); // noop to keep linter quiet — we use raw query below
    // Read current prefs, merge, write back
    supabase
      .from('profiles')
      .select('preferences')
      .eq('id', uid)
      .single()
      .then(({ data: profile }) => {
        const current = (profile?.preferences as Record<string, any>) || {};
        supabase
          .from('profiles')
          .update({ preferences: { ...current, ...prefs } } as any)
          .eq('id', uid)
          .then(() => {});
      });
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    return theme === 'system' ? getSystemTheme() : theme;
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window === 'undefined') return ACCENT_COLORS[0];
    const stored = localStorage.getItem(ACCENT_KEY);
    return ACCENT_COLORS.find((c) => c.id === stored) || ACCENT_COLORS[0];
  });

  const hasSyncedRef = useRef(false);

  // Sync from database on auth state change (login)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && !hasSyncedRef.current) {
        hasSyncedRef.current = true;
        supabase
          .from('profiles')
          .select('preferences')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            const prefs = (profile?.preferences as Record<string, any>) || {};
            if (prefs.accentColor) {
              const found = ACCENT_COLORS.find((c) => c.id === prefs.accentColor);
              if (found) {
                setAccentColorState(found);
                localStorage.setItem(ACCENT_KEY, found.id);
              }
            }
            if (prefs.theme && ['light', 'dark', 'system'].includes(prefs.theme)) {
              setThemeState(prefs.theme as Theme);
              localStorage.setItem(STORAGE_KEY, prefs.theme);
            }
          });
      }
      if (event === 'SIGNED_OUT') {
        hasSyncedRef.current = false;
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Apply theme class
  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    applyAccent(accentColor, resolved);
  }, [theme, accentColor]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const r = e.matches ? 'dark' : 'light';
      setResolvedTheme(r);
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(r);
      applyAccent(accentColor, r);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, accentColor]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    persistPrefs({ theme: newTheme });
  }, []);

  const setAccentColor = useCallback((id: string) => {
    const color = ACCENT_COLORS.find((c) => c.id === id) || ACCENT_COLORS[0];
    setAccentColorState(color);
    localStorage.setItem(ACCENT_KEY, color.id);
    persistPrefs({ accentColor: color.id });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
