

# DRAPE Theme & Polish Plan — Step 2/4

## Theme Rules Summary

These rules codify the existing design system for consistency going forward:

### Surface Hierarchy
- **Background** (`--background`): Page canvas. Warm off-white / deep noir.
- **Card** (`--card`): Primary surface. Pure white / lifted dark. Used for all content containers.
- **Secondary** (`--secondary`): Recessed surface. Used for muted backgrounds, chip unselected state, input fills.
- **Muted** (`--muted`): Skeleton/shimmer/empty placeholders only.

### Border Rules
- Card borders: `border-border/80` (already set in Card component -- good)
- Grid dividers inside cards: `border-border/50` (lighter, interior)
- No double-border stacking (card border + inner divider at same edge)

### Text Hierarchy
- **Primary**: `text-foreground` -- headings, labels, body
- **Secondary**: `text-muted-foreground` -- descriptions, captions, timestamps
- **Tertiary**: `text-muted-foreground/60` -- placeholder, disabled hints
- **Never** use `text-primary` for body text (it flips in dark mode)

### Accent Usage Rules
- Accent color on: selected states (chips, nav, grid cells), primary CTA background, badges for active status
- Accent color NOT on: body text, borders (use `border-border`), section headers
- Accent opacity: `bg-accent/5` for selected cell tint, `bg-accent/10` for icon pill backgrounds

### Button System
- **Primary CTA**: One per screen. `bg-accent text-accent-foreground`. Full width or prominent.
- **Secondary**: `variant="outline"` or `variant="secondary"`. Supporting actions.
- **Ghost**: `variant="ghost"`. Icon buttons, subtle nav.
- **Destructive**: `variant="destructive"`. Only for delete/remove confirmations.
- **All buttons**: Already have `active:scale-[0.97]` via buttonVariants. Remove all redundant `active:animate-press`.
- **Disabled**: `opacity-50 pointer-events-none` (already set).
- **Loading**: Use `<Loader2 className="w-4 h-4 animate-spin" />` inline, no separate spinner color.

### Chip System
- **Unselected**: `bg-secondary text-secondary-foreground` (current default -- good)
- **Selected**: `bg-accent text-accent-foreground shadow-sm` (current -- good)
- No outline variant chips in selection contexts (too much border noise)

### Motion Rules
- Press: `active:scale-[0.97]` (buttons) / `active:scale-[0.96]` (chips) -- already in component base
- Transitions: `transition-all` with default 150ms
- Page enter: `animate-drape-in` with stagger (50ms per child)
- Loading: `skeleton-shimmer` utility class
- No `active:animate-press` anywhere (redundant with scale)

### Typography Rules
- Headings: Sora font, sentence case (not ALL CAPS)
- Section eyebrow labels: `text-xs font-medium text-muted-foreground uppercase tracking-wide` via `SectionHeader`
- Body: Inter font, `text-sm`
- Caption: `text-xs text-muted-foreground`

### Accessibility
- All interactive elements: min `h-11` (44px) for buttons, `min-h-[44px]` for chips (lg size)
- Chip sm/md sizes used only in dense contexts (inline badges), never as primary tap targets
- Focus: `ring-2 ring-ring ring-offset-2` (already global)

---

## Implementation Changes

### 1. Remove ALL remaining `active:animate-press` (8 files)

Buttons already have `active:scale-[0.97]` baked into `buttonVariants`. The redundant `active:animate-press` class adds a competing animation. Remove it everywhere:

**Files:**
- `src/pages/OutfitDetail.tsx` -- ~10 instances
- `src/components/insights/AISuggestions.tsx` -- ~6 instances
- `src/components/plan/DayCard.tsx` -- ~5 instances
- `src/components/plan/QuickPlanSheet.tsx` -- 1 instance
- `src/components/plan/QuickGenerateSheet.tsx` -- 1 instance
- `src/components/outfit/PlannedOutfitsList.tsx` -- 1 instance
- `src/components/plan/SwapSheet.tsx` -- check and clean
- `src/components/plan/PlanningSheet.tsx` -- check and clean

### 2. Fix outline button hover state

The outline button currently hovers to `bg-accent text-accent-foreground` which is jarring (jumps to full accent color on hover). Change to a subtler hover:

**File: `src/components/ui/button.tsx`**
- Change outline variant from: `hover:bg-accent hover:text-accent-foreground`
- To: `hover:bg-secondary hover:text-foreground`

Same for ghost variant:
- From: `hover:bg-accent hover:text-accent-foreground`
- To: `hover:bg-secondary hover:text-foreground`

This makes hover states calmer and consistent with the Scandinavian theme.

### 3. Standardize loading spinner color

Multiple spinner color variants exist across the codebase. Standardize all to `text-muted-foreground`:

**Files to update:**
- `src/pages/OutfitDetail.tsx` line 43: `text-primary` to `text-muted-foreground`
- `src/components/insights/AISuggestions.tsx` line 64, 79: `text-primary` to `text-muted-foreground`
- `src/components/plan/QuickPlanSheet.tsx` line 64: `text-primary` to `text-muted-foreground`
- `src/components/plan/QuickGenerateSheet.tsx` line 315: keep inline (already inside button)
- `src/components/insights/AISuggestions.tsx` LoadingIndicator: change the large spinner icon from `text-primary animate-pulse` to `text-muted-foreground animate-pulse`

### 4. Fix DayCard hardcoded strings (missed in Step 1)

**File: `src/components/plan/DayCard.tsx`**
- Line 54: `'Idag'` to `t('plan.today')`
- Line 56: `'Imorgon'` to `t('plan.tomorrow')`
- Line 84: `'Använd'` to `t('plan.used')`
- Line 152: `'Byt'` to `t('plan.swap')`
- Line 161: `'Detaljer'` to `t('plan.details')`
- Line 173: `'Markera som använd'` to `t('plan.mark_worn')`
- Line 181: `'Ta bort'` to `t('plan.remove')`
- Line 190: `'Ingen outfit planerad.'` to `t('plan.no_outfit')`
- Line 202: `'Planera'` to `t('plan.plan')`
- Line 212: `'Skapa åt mig'` to `t('plan.generate')`
- Add `useLanguage` import and `t` destructure

### 5. Fix AISuggestions hardcoded strings

**File: `src/components/insights/AISuggestions.tsx`**
- All loading steps, labels ("Prova", "Dölj", "Varför detta funkar", "AI-förslag", "Personliga kombinationer", etc.) are hardcoded Swedish
- Add `useLanguage` import and move strings to i18n keys

### 6. Fix PlannedOutfitsList hardcoded strings

**File: `src/components/outfit/PlannedOutfitsList.tsx`**
- Line 169: `'Idag'` / `'Imorgon'` hardcoded
- Line 189: `'Inga planerade'` / `'Planera outfits via datumväljaren.'`
- Line 124-135: Dialog strings "Radera?", "Kan inte ångras.", "Avbryt"

### 7. Fix QuickPlanSheet and QuickGenerateSheet hardcoded strings

Both sheets have extensive hardcoded Swedish UI text. Add i18n.

### 8. Add new i18n keys for components above

Add translation keys for all the component-level strings found in DayCard, AISuggestions, PlannedOutfitsList, QuickPlanSheet, QuickGenerateSheet, and SwapSheet.

### 9. Chip tap target size

Ensure chips used as primary selection controls use `size="lg"` (which gives `min-h-[44px]`). Currently the occasion/style chips in QuickGenerateSheet use default `size="md"` (`py-1.5`). These are primary tap targets and should be `size="lg"`.

### 10. Card shadow consistency

The Card component currently has `shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]` which is barely visible. This is correct for the calm aesthetic. No change needed, but document as intentional.

### 11. Input field height

Input fields are `h-10` (40px). For mobile tap targets, bump to `h-11` (44px) to meet the 44px minimum.

**File: `src/components/ui/input.tsx`**
- Change `h-10` to `h-11`

---

## Technical Summary

| Change | Files | Impact |
|--------|-------|--------|
| Remove `active:animate-press` | 8 files | Cleaner motion, no competing animations |
| Calm button hover states | 1 file (button.tsx) | Subtler outline/ghost hover |
| Standardize spinners | 4 files | Consistent loading feel |
| DayCard i18n | 1 file + translations | Full localization |
| AISuggestions i18n | 1 file + translations | Full localization |
| PlannedOutfitsList i18n | 1 file + translations | Full localization |
| QuickPlanSheet i18n | 1 file + translations | Full localization |
| QuickGenerateSheet i18n | 1 file + translations | Full localization |
| Input height 44px | 1 file (input.tsx) | Accessibility compliance |
| Chip size for tap targets | 2 files | Accessibility compliance |

Total: ~15 files modified, ~50 new i18n keys added.
