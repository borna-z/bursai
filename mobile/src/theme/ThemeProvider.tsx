import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Persist the user's theme choice across cold starts. Without this, every
// app launch reverts to `initialMode` (system) regardless of what the user
// picked in Settings → Appearance — they have to retoggle on every boot.
// AsyncStorage is the same store useFirstRunCoach + offlineQueue use, so the
// adapter is already part of the bundle; no new dependency.
const THEME_STORAGE_KEY = 'burs.theme.mode';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({
  children,
  initialMode = 'system',
}: {
  children: React.ReactNode;
  initialMode?: ThemeMode;
}) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  // Hydrate the persisted mode on mount. We can't read AsyncStorage
  // synchronously, so we accept one render under `initialMode` (=system)
  // before the hydrated value lands. The flicker is invisible because the
  // splash screen is still visible at that point.
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (isThemeMode(stored)) setModeState(stored);
      })
      .catch(() => {
        // Swallow: AsyncStorage is best-effort here. If it fails we keep
        // `initialMode` (system) which is the right launch default.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep reading system scheme even when we're in 'system' mode.
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => {});
    return () => sub.remove();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {
      // Swallow: persistence is best-effort. Lost write means the user has
      // to retoggle on next launch, which is the same as the pre-fix
      // behaviour.
    });
  }, []);

  const resolved: ThemeName = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      tokens: themes[resolved],
      setMode,
      toggle: () =>
        setMode(
          (() => {
            const current: ThemeName =
              mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
            return current === 'light' ? 'dark' : 'light';
          })(),
        ),
    }),
    [mode, resolved, systemScheme, setMode],
  );

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
