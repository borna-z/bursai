import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type ThemeTokens, type ThemeName } from './tokens';
import { duration, easing } from './animation';

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

// N19 — Theme-switch fade animation. Snapping from light→dark feels jarring
// (Copilot audit recommendation). Fade out to 85% opacity, swap tokens at
// the trough, fade back to 100%. Total ~220 ms. Total wash through black
// would be too heavy; the brief dim is a softer signal that the change
// happened without obscuring the UI. Respects Reduce Motion — the
// preference toggle bypasses the animation entirely and snaps as before
// for users who've opted in.
const FADE_TROUGH_OPACITY = 0.85;
const FADE_OUT_MS = Math.round(duration.fast * 0.4); // ~90ms
const FADE_IN_MS = duration.fast - FADE_OUT_MS;     // ~130ms

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
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const reduceMotionRef = useRef(false);

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

  // N19 — track Reduce Motion preference so setMode can skip the fade for
  // users who've opted in. Mirrors the same listener pattern CoachOverlay
  // uses (M27 R1).
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) reduceMotionRef.current = enabled;
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        reduceMotionRef.current = enabled;
      },
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {
      // Swallow: persistence is best-effort. Lost write means the user has
      // to retoggle on next launch, which is the same as the pre-fix
      // behaviour.
    });

    if (reduceMotionRef.current) {
      // Reduce Motion is on — snap straight through like the pre-N19 path.
      setModeState(next);
      return;
    }

    // Run the fade. The actual mode swap happens at the trough so the new
    // colors appear while we're fading back up. setTimeout is used (not a
    // sequence callback) so the swap fires even if the user backgrounds
    // the app mid-animation — `setModeState` is cheap and idempotent.
    Animated.timing(fadeOpacity, {
      toValue: FADE_TROUGH_OPACITY,
      duration: FADE_OUT_MS,
      easing: easing.smooth,
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      setModeState(next);
      Animated.timing(fadeOpacity, {
        toValue: 1,
        duration: FADE_IN_MS,
        easing: easing.smooth,
        useNativeDriver: true,
      }).start();
    }, FADE_OUT_MS);
  }, [fadeOpacity]);

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

  return (
    <ThemeContext.Provider value={value}>
      <Animated.View style={{ flex: 1, opacity: fadeOpacity }}>{children}</Animated.View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function useTokens(): ThemeTokens {
  return useTheme().tokens;
}
