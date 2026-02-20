

# DRAPE UI Audit & Polish Plan

## UI Issues List

| # | Screen | Issue | Severity | Fix |
|---|--------|-------|----------|-----|
| 1 | Wardrobe | Hardcoded Swedish string `"328: plagg"` and `"131: Underkläder"` not using i18n | Medium | Move to `t()` calls |
| 2 | Wardrobe | FABs (Scan + Add) overlap garment grid content at bottom-right, especially on short screens | High | Add `pb-36` to content area so last cards are never hidden behind FABs |
| 3 | Wardrobe | Category grid uses `border-border` (full opacity) vs Home which uses `border-border/50` -- inconsistent divider weight | Medium | Standardize to `border-border/50` everywhere for grids |
| 4 | Plan | Hardcoded Swedish strings everywhere ("Idag", "Imorgon", "Planerad", "Ingen outfit planerad", etc.) not using i18n | Medium | Move to `t()` calls |
| 5 | OutfitGenerate | All strings hardcoded Swedish ("Skapar din outfit...", "Kunde inte skapa outfit", etc.) | Medium | Move to `t()` calls |
| 6 | Insights | `CardTitle` uses default `text-2xl` sizing but page titles are `text-base` -- size mismatch within cards | Low | Already overridden with `text-base`; consistent |
| 7 | Insights | Premium upsell card uses `text-primary` which is nearly invisible on light theme (charcoal-on-white is fine, but the gradient `from-primary/10` is very subtle) | Low | Keep as-is; works in both modes |
| 8 | OutfitSlotCard | Swedish slot labels hardcoded (`Överdel`, `Underdel`, etc.) not i18n | Medium | Move to `t()` |
| 9 | SettingsPrivacy | Still references `burs` in export filename and email (`privacy@burs.se`) | High | Change to `drape` |
| 10 | Home | CTA button uses inline `bg-accent` + manual color classes instead of variant pattern | Low | Acceptable; uses accent color consistently |
| 11 | Plan (desktop) | `ScrollArea` sidebar with `MiniDayCard` list can look sparse -- not as polished as mobile strip | Low | Desktop is secondary; acceptable |
| 12 | Auth | "ELLER" separator is hardcoded Swedish | Low | Move to `t()` |
| 13 | Wardrobe | `SettingsGroup` used without title for search/filter collapsibles -- creates inconsistent card grouping (missing `title` prop sometimes, present other times with fallback `'Kategori'`) | Medium | Remove `|| 'Kategori'` fallback; always use `t()` key |
| 14 | Multiple pages | Inconsistent content padding: Home uses `px-4 pb-6 pt-2`, Wardrobe uses `p-4`, Settings uses `px-4 pb-6 pt-4`, Outfits uses `p-4` | Medium | Standardize to `px-4 pb-6 pt-4` with `max-w-lg mx-auto` |
| 15 | Multiple pages | Inconsistent section spacing: Home `space-y-5`, Wardrobe `space-y-4`, Settings `space-y-6` | Medium | Standardize to `space-y-5` |
| 16 | Outfits | Tab `stagger-drape` animation on TabsContent creates visible opacity-0 flash on already-rendered cards | Low | Remove `opacity-0` from card base class; keep `animate-drape-in` with fill-mode |
| 17 | Multiple | `active:animate-press` used alongside `active:scale-[0.97]` in button base -- redundant | Low | Remove inline `active:animate-press` where button variant already includes `active:scale-[0.97]` |

## Implementation Plan

### Phase 1: Fix remaining BURS references (Critical)

**File: `src/pages/settings/SettingsPrivacy.tsx`**
- Change export filename from `burs-export-...` to `drape-export-...`
- Change `privacy@burs.se` to `privacy@drape.se`

### Phase 2: Standardize layout tokens

**File: `src/pages/Wardrobe.tsx`**
- Change content wrapper from `p-4 space-y-4` to `px-4 pb-6 pt-4 space-y-5 max-w-lg mx-auto`
- Add `pb-36` to prevent FAB overlap with content
- Change category grid borders from `border-border` to `border-border/50`
- Replace hardcoded `"plagg"` with `t('wardrobe.garments_count')` or similar
- Replace hardcoded `'Underkläder'` with i18n key

**File: `src/pages/Outfits.tsx`**
- Change content from `p-4` to `px-4 pb-6 pt-4 space-y-0 max-w-lg mx-auto`

**File: `src/pages/Insights.tsx`**
- Wrap in `max-w-lg mx-auto` container

### Phase 3: Create shared `SectionHeader` component

**New file: `src/components/ui/section-header.tsx`**
- Simple component: uppercase tracking-wide muted label
- Replaces inline `<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">` used in Home, Wardrobe, etc.
- Props: `title: string`, `className?: string`

### Phase 4: Hardcoded string cleanup

**Files affected:**
- `src/pages/Plan.tsx` -- Move all hardcoded Swedish strings to i18n keys (Idag, Imorgon, Planerad, Ingen outfit planerad, etc.)
- `src/pages/OutfitGenerate.tsx` -- Move all strings to i18n
- `src/components/outfit/OutfitSlotCard.tsx` -- Move slot labels to i18n
- `src/i18n/translations.ts` -- Add missing keys for all the above

### Phase 5: Minor visual consistency fixes

- **Remove redundant `active:animate-press`** on buttons that already get `active:scale-[0.97]` from `buttonVariants` (affects ~15 places across Plan, Wardrobe, Outfits, Insights, OutfitDetail)
- **Standardize spinner color**: Some pages use `text-accent`, others `text-primary`, others `text-muted-foreground`. Standardize loading spinners to `text-muted-foreground` for subtlety

### Phase 6: Verify in preview

After all changes, navigate through every screen (Auth, Home, Wardrobe, Plan, AI Chat, Settings, Outfits, Insights, GarmentDetail, OutfitDetail) to confirm coherent, premium appearance.

---

## Technical Details

### New i18n keys needed (added to `src/i18n/translations.ts`):

```
wardrobe.garments_count: "{count} plagg" / "{count} garments"
wardrobe.underwear: "Underkläder" / "Underwear"
plan.today: "Idag" / "Today"
plan.tomorrow: "Imorgon" / "Tomorrow"
plan.planned: "Planerad" / "Planned"
plan.no_outfit: "Ingen outfit planerad" / "No outfit planned"
plan.add_garments_first: "Lägg till plagg först" / "Add garments first"
plan.need_garments: "Du behöver plagg i garderoben." / "You need garments."
plan.add: "Lägg till" / "Add"
plan.plan: "Planera" / "Plan"
plan.create_for_me: "Skapa åt mig" / "Create for me"
plan.swap: "Byt" / "Swap"
plan.details: "Detaljer" / "Details"
plan.mark_worn: "Markera som använd" / "Mark as worn"
plan.remove: "Ta bort" / "Remove"
plan.used: "Använd" / "Used"
plan.plan_week: "Planera din vecka" / "Plan your week"
generate.creating: "Skapar din outfit..." / "Creating your outfit..."
generate.matching: "Matchar plagg för {occasion}" / "Matching garments for {occasion}"
generate.error_title: "Kunde inte skapa outfit" / "Could not create outfit"
generate.error_desc: "Ett fel uppstod" / "An error occurred"
generate.back: "Tillbaka" / "Back"
generate.retry: "Försök igen" / "Try again"
auth.or: "eller" / "or"
slot.top: "Överdel" / "Top"
slot.bottom: "Underdel" / "Bottom"
slot.shoes: "Skor" / "Shoes"
slot.outerwear: "Ytterkläder" / "Outerwear"
slot.accessory: "Accessoar" / "Accessory"
slot.dress: "Klänning" / "Dress"
slot.fullbody: "Helkropp" / "Full body"
slot.unknown_garment: "Okänt plagg" / "Unknown garment"
slot.swap: "Byt ut" / "Swap"
```

### New component: `SectionHeader`

```tsx
interface SectionHeaderProps {
  title: string;
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <h3 className={cn(
      "text-xs font-medium text-muted-foreground uppercase tracking-wide px-1",
      className
    )}>
      {title}
    </h3>
  );
}
```

### Files modified (summary):
1. `src/pages/settings/SettingsPrivacy.tsx` -- BURS to DRAPE
2. `src/pages/Wardrobe.tsx` -- layout tokens, i18n, border consistency, FAB overlap fix
3. `src/pages/Outfits.tsx` -- layout tokens
4. `src/pages/Insights.tsx` -- layout tokens
5. `src/pages/Plan.tsx` -- i18n strings
6. `src/pages/OutfitGenerate.tsx` -- i18n strings
7. `src/pages/Auth.tsx` -- i18n "eller"
8. `src/components/outfit/OutfitSlotCard.tsx` -- i18n slot labels
9. `src/components/ui/section-header.tsx` -- new shared component
10. `src/i18n/translations.ts` -- new keys
11. `src/pages/Home.tsx` -- use SectionHeader
12. Various files -- remove redundant `active:animate-press`

