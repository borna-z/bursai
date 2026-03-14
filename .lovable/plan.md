

# Type Safety Pass + Robots.txt Status

## Robots.txt & Sitemap — Already Fixed

Both files were updated in a previous edit:
- `public/robots.txt`: `Disallow: /auth` is already removed, sitemap points to `https://burs.me/sitemap.xml`
- `public/sitemap.xml`: Already created with all public routes on `burs.me`

No changes needed here. If the live site still shows the old version, it needs a publish/deploy.

## Type Safety: Remove unnecessary `as any` casts

### 1. `src/pages/GarmentDetail.tsx` — 7 casts, all removable

Every cast accesses fields (`purchase_price`, `purchase_currency`, `condition_score`, `condition_notes`) that already exist on `Tables<'garments'>`. The `Garment` type already has them. Simply remove the `as any` wrapper:

- `(garment as any)?.purchase_price` → `garment?.purchase_price`
- `(garment as any).condition_score` → `garment.condition_score`
- `(garment as any).condition_notes` → `garment.condition_notes`
- `(garment as any).purchase_currency` → `garment.purchase_currency`
- `{ purchase_price: price } as any` → `{ purchase_price: price }` (it's a valid `TablesUpdate<'garments'>`)

### 2. `src/components/outfit/PlannedOutfitsList.tsx` — 5 casts, all removable

`planned_for` is on `Tables<'outfits'>`, and `weather` is on `OutfitWithItems`. Remove all `(outfit as any).planned_for` → `outfit.planned_for` and `(outfit as any).weather` → `outfit.weather`.

### 3. `src/lib/offlineQueue.ts` — 4 casts, intentional (no change)

These are dynamic table name dispatches (`supabase.from(mutation.table as any)`). Same pattern as `useSupabaseQuery.ts` — documented as intentional. Leave as-is.

### 4. Other minor casts worth fixing

| File | Cast | Fix |
|---|---|---|
| `src/hooks/useLiveScan.ts` | `ai_raw as any` | Remove — `Json` type accepts objects |
| `src/hooks/useProfile.ts` | `(insertError as any).code` | Cast to `{ code?: string }` or use `PostgrestError` type |
| `src/hooks/useLaundryCycle.ts` | `(planned as any).outfit` | Type the planned outfit join properly |
| `src/contexts/LanguageContext.tsx` | `preferences as any` | Cast to `TablesUpdate<'profiles'>['preferences']` |
| `src/hooks/useOnboarding.ts` | `as any` on preferences | Same pattern as LanguageContext |
| `src/pages/Settings.tsx` | `(globalThis as any).__APP_VERSION__` | Extend global types or use `import.meta.env` |

## Summary

- **Files to edit: 7** (GarmentDetail, PlannedOutfitsList, useLiveScan, useProfile, useLaundryCycle, LanguageContext, useOnboarding)
- **Files to skip: 2** (offlineQueue, useSupabaseQuery — intentional)
- **Files already done: 2** (robots.txt, sitemap.xml — no changes needed)
- **Estimated `as any` removal: ~20 casts**

Settings.tsx (`globalThis as any`) and PricingSection.tsx (`t(label as any)`) are low-impact i18n/build-time casts that are harder to fix without adding type complexity — skip for now.

