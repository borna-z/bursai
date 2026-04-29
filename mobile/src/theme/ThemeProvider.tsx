import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { themes, type ThemeTokens, type ThemeName } from './tokens';

type ThemeMode = ThemeName | 'system';

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ThemeName;
  tokens: ThemeTokens;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, initialMode = 'system' }: { children: React.ReactNode; initialMode?: ThemeMode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  // Keep reading system scheme even when we're in 'system' mode.
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {});
    return () => sub.remove();
  }, []);

  const resolved: ThemeName = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    resolved,
    tokens: themes[resolved],
    setMode,
    toggle: () => setMode((m) => {
      const current: ThemeName = m === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : m;
      return current === 'light' ? 'dark' : 'light';
    }),
  }), [mode, resolved, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function useTokens(): ThemeTokens {
  return useTheme().tokens;
}
