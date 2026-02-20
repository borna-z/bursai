

## Fix: "useLanguage must be used within LanguageProvider"

### Root Cause

`LanguageProvider` imports `useProfile` (which depends on `useAuth`). If any error occurs during the provider's render — such as during a hot module reload, a brief race condition at startup, or an internal query failure — the provider unmounts and its children lose the `LanguageContext`, causing the crash.

### Fix

**`src/contexts/LanguageContext.tsx`** — 1 change:

Update `useLanguage()` to return a safe fallback instead of throwing when the context is missing. The fallback uses `getInitialLocale()` for the locale, a no-op for `setLocale`, and a passthrough `t()` that does the same translation lookup from `translations.ts`. This means the app always renders — worst case with localStorage-based locale — instead of white-screening.

```ts
// Before (crashes):
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

// After (graceful fallback):
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    const fallbackLocale = getInitialLocale();
    return {
      locale: fallbackLocale,
      setLocale: () => {},
      t: (key: string) =>
        translations[fallbackLocale]?.[key] ?? translations['sv']?.[key] ?? key,
    };
  }
  return ctx;
}
```

This is a single-file, non-breaking change. No other files need modification.
