

# Plan: Clean Lint & Type Safety Debt

## Scope
Fix `@typescript-eslint/no-explicit-any` and `react-hooks/exhaustive-deps` issues across **16 critical files** in auth, wardrobe CRUD, outfit generation, payments, settings, and AI orchestration flows.

---

## Changes by File

### 1. `src/contexts/AuthContext.tsx`
- Replace `{ data: any; error: Error | null }` in `signUp` return type with `{ data: { user: User | null; session: Session | null }; error: Error | null }`

### 2. `src/contexts/ThemeContext.tsx`
- Remove the fake `supabase.rpc('has_role' as any, {} as any)` noop line (line 84)
- Cast `preferences` update payload properly using `TablesUpdate<'profiles'>` instead of `as any` on line 95

### 3. `src/hooks/useSupabaseQuery.ts`
- Type `filters` callback as `(query: PostgrestFilterBuilder<...>) => ...` — or use a minimal generic. Since the table name is dynamic, use `PostgrestFilterBuilder<Database['public'], any, any>` from Supabase types (this is one case where `any` in a generic position is acceptable — but we can narrow `table as any` by casting to `keyof Database['public']['Tables']` and using a type assertion)

### 4. `src/hooks/useOutfitGenerator.ts`
- Already mostly clean — verify no remaining `: any`

### 5. `src/hooks/useSwapGarment.ts`
- Type edge function response: replace `candidates?: any[]` with `candidates?: { garment: Garment; score: number; breakdown?: Record<string, number> }[]`
- Replace `(c: any)` callback param with the proper typed interface

### 6. `src/hooks/usePhotoFeedback.ts`
- Replace `ai_raw: any` with `ai_raw: Record<string, unknown> | null`

### 7. `src/hooks/useCalendarSync.ts`
- Replace `onError: (error: any)` with `onError: (error: Error & { reconnect?: boolean })`

### 8. `src/hooks/useForecast.ts`
- Type Nominatim API response: replace `(item: any)` with a `NominatimResult` interface

### 9. `src/pages/Onboarding.tsx`
- Remove `as any` on preferences update (line 61) — cast through `ProfilePreferences` properly
- Replace `catch (err: any)` with `catch (err: unknown)` and use type narrowing
- Remove redundant `(err as any)?.code` — use `(err as { code?: string })?.code`

### 10. `src/pages/MoodOutfit.tsx`
- Replace `(i: any)` in items mapping with `{ garment_id: string; slot: string }`

### 11. `src/pages/UnusedOutfits.tsx`
- Replace `style_score?: any` with `style_score?: Record<string, number> | null`
- Replace all `(it: any)` callbacks with `{ garment_id: string; slot: string }`
- Change Swedish occasion IDs (`vardag`, `jobb`, `dejt`, `fest`) to English

### 12. `src/pages/ShareOutfit.tsx` & `src/pages/PublicProfile.tsx`
- Define `OutfitItemRow` interface for Supabase join results
- Replace `(item: any)` / `(o: any)` / `(i: any)` with typed interfaces

### 13. `src/pages/settings/SettingsPrivacy.tsx` & `SettingsNotifications.tsx`
- Replace `preferences: newPrefs as any` with proper `TablesUpdate<'profiles'>` cast using `ProfilePreferences`

### 14. `src/components/settings/ProfileCard.tsx`
- Replace `catch (err: any)` with `catch (err: unknown)`

### 15. `src/components/LinkImportForm.tsx`
- Replace `catch (err: any)` with `catch (err: unknown)` + type guard

### 16. `src/lib/offlineQueue.ts`
- Replace `supabase.from(mutation.table as any)` — keep `as any` but add a `// eslint-disable-next-line` with explanation (dynamic table names are inherently untyped)

### 17. `src/components/landing/PricingSection.tsx`
- Replace `t(label as any)` with a proper translation key type or `t(label as string)`

### 18. `src/components/layout/PullToRefresh.tsx`
- Declare `median` on `Window` interface in a `.d.ts` or inline, replacing `(window as any).median`

### 19. `src/lib/median.ts`
- Add `Window` interface augmentation for `median` property
- Replace `...args: any[]` with `...args: unknown[]`
- Replace `let obj: any` with `let obj: unknown`

### 20. `src/pages/marketing/Admin.tsx`
- Replace `(supabase.from('marketing_leads') as any)` with typed query or `// eslint-disable-next-line` (table may not be in generated types)

### 21. `src/components/wardrobe/WardrobeOutfitsTab.tsx`
- Replace `(o: any)` with proper `Outfit` type that includes `planned_for`

### 22. `src/pages/PickMustHaves.tsx`
- Replace `(location.state as any)` with typed `LocationState` interface

### 23. `src/components/onboarding/QuickStyleQuiz.tsx`
- Replace `val as any` with proper union type for quiz answer values

### 24. `src/pages/Settings.tsx`
- Replace `(globalThis as any).__APP_VERSION__` with a type declaration

---

## Approach
- Create a `src/types/median.d.ts` for Window augmentation (covers PullToRefresh + median.ts)
- Create a `src/types/global.d.ts` for `__APP_VERSION__`
- All `catch (err: any)` → `catch (err: unknown)` with `err instanceof Error ? err.message : 'Unknown error'`
- All Supabase join result callbacks get proper inline interfaces
- Preferences updates use `ProfilePreferences` from `src/types/preferences.ts`

## Impact
Estimated reduction: ~100+ of the 137 errors. The remaining will be in test files and auto-generated code.

