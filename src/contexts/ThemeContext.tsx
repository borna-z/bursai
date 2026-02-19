import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

export interface AccentColor {
  id: string;
  name: string;
  hsl: string;        // light mode HSL values e.g. "234 51% 37%"
  hslDark: string;    // dark mode HSL values
  hex: string;        // preview hex
}

export const ACCENT_COLORS: AccentColor[] = [
  { id: 'indigo',     name: 'Indigo',      hsl: '234 51% 37%', hslDark: '234 60% 62%', hex: '#2F3A8F' },
  { id: 'petrol',     name: 'Petrol',      hsl: '174 72% 22%', hslDark: '174 55% 45%', hex: '#0D5C63' },
  { id: 'forest',     name: 'Skog',        hsl: '152 55% 28%', hslDark: '152 45% 50%', hex: '#206B4A' },
  { id: 'sage',       name: 'Salvia',      hsl: '140 20% 45%', hslDark: '140 25% 60%', hex: '#5C8A6E' },
  { id: 'navy',       name: 'Marin',       hsl: '220 50% 30%', hslDark: '220 50% 58%', hex: '#264573' },
  { id: 'slate',      name: 'Skiffer',     hsl: '215 20% 42%', hslDark: '215 25% 60%', hex: '#556880' },
  { id: 'burgundy',   name: 'Vinröd',      hsl: '345 55% 35%', hslDark: '345 50% 58%', hex: '#8A2843' },
  { id: 'rose',       name: 'Ros',         hsl: '340 45% 50%', hslDark: '340 50% 65%', hex: '#B94D6E' },
  { id: 'terracotta', name: 'Terrakotta',  hsl: '16 55% 42%',  hslDark: '16 55% 58%',  hex: '#A65A35' },
  { id: 'amber',      name: 'Bärnsten',    hsl: '38 75% 42%',  hslDark: '38 80% 55%',  hex: '#BB8820' },
  { id: 'plum',       name: 'Plommon',     hsl: '280 35% 38%', hslDark: '280 40% 58%', hex: '#6E3A8A' },
  { id: 'charcoal',   name: 'Kol',         hsl: '0 0% 25%',    hslDark: '0 0% 65%',    hex: '#404040' },
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

function applyAccent(accent: AccentColor, resolved: 'light' | 'dark') {
  const root = document.documentElement;
  const hsl = resolved === 'dark' ? accent.hslDark : accent.hsl;
  root.style.setProperty('--accent', hsl);
  // Also update accent-indigo tokens to match
  root.style.setProperty('--accent-indigo', hsl);
  const darkMuted = resolved === 'dark'
    ? hsl.replace(/(\d+)%$/, '16%')
    : hsl.replace(/(\d+)%$/, '94%');
  const parts = hsl.split(' ');
  root.style.setProperty('--accent-indigo-muted', `${parts[0]} ${parseInt(parts[1]) * 0.6}% ${resolved === 'dark' ? '16' : '94'}%`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    return theme === 'system' ? getSystemTheme() : theme;
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window === 'undefined') return ACCENT_COLORS[0];
    const stored = localStorage.getItem(ACCENT_KEY);
    return ACCENT_COLORS.find((c) => c.id === stored) || ACCENT_COLORS[0];
  });

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
  }, []);

  const setAccentColor = useCallback((id: string) => {
    const color = ACCENT_COLORS.find((c) => c.id === id) || ACCENT_COLORS[0];
    setAccentColorState(color);
    localStorage.setItem(ACCENT_KEY, color.id);
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
