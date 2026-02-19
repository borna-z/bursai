

# DRAPE Major Update Plan

This is a large update covering 5 distinct features. Given the scope, I recommend implementing them in phases across multiple messages to avoid errors.

---

## Phase 1: Fix Apple and Android Icons on Marketing Page

**Problem:** The PWA install section uses generic Lucide icons (`Apple` and `Chrome`) instead of the real Apple and Android brand logos.

**Solution:** Replace the Lucide icons with inline SVG components that render the actual Apple logo and Google Play / Android logo. These are well-known SVG paths that are freely available.

**Files to change:**
- `src/components/marketing/PWAInstallSection.tsx` -- Replace `<Apple>` with an inline Apple SVG and `<Chrome>` with an inline Android/Play Store SVG

---

## Phase 2: User-Selectable Accent Color (Logo Tint)

**Problem:** The logo is black and white, which feels flat. Users should be able to pick a favorite color during onboarding that tints the logo and acts as their personal accent.

**Solution:**
1. Add a new onboarding step (before body measurements) where users pick from 12 colors
2. Store the chosen color in the `preferences` JSONB column on `profiles` (as `accentColor`)
3. Create a React context (`AccentColorContext`) that reads the user's saved color and applies it as a CSS custom property (`--user-accent`)
4. Update `DrapeLogo.tsx` to apply a CSS filter or use the accent color as a background tint on the logo icon (using CSS `mix-blend-mode` or a colored overlay behind the transparent logo areas)

**12 color palette:**

| Name | Hex |
|------|-----|
| Crimson | #DC2626 |
| Coral | #F97316 |
| Amber | #F59E0B |
| Emerald | #10B981 |
| Teal | #14B8A6 |
| Sky | #0EA5E9 |
| Indigo | #6366F1 |
| Violet | #8B5CF6 |
| Fuchsia | #D946EF |
| Rose | #F43F5E |
| Slate | #64748B |
| Charcoal | #111111 (default) |

**Files to create/change:**
- `src/contexts/AccentColorContext.tsx` -- New context provider
- `src/components/onboarding/ColorPickerStep.tsx` -- New onboarding step
- `src/pages/Onboarding.tsx` -- Add color picker step before body measurements
- `src/pages/Settings.tsx` -- Add accent color picker in settings
- `src/components/ui/DrapeLogo.tsx` -- Apply accent color tint
- `src/App.tsx` -- Wrap with AccentColorProvider
- No database migration needed (uses existing `preferences` JSONB)

---

## Phase 3: Multi-Language Support (10 Languages)

**Problem:** The app is hardcoded in Swedish. Users should be able to choose from 10 languages at signup.

**Solution:**
1. Create an i18n system with translation files for each language
2. Add a language selector during onboarding (after color picker)
3. Store language preference in `preferences` JSONB as `language`
4. Create a `useTranslation` hook that returns translated strings
5. Marketing site stays in English (translate `marketing.ts` config)

**Supported languages:**
Swedish (sv), Norwegian (no), Finnish (fi), Danish (da), English (en), Spanish (es), French (fr), Mandarin (zh), Arabic (ar), Persian (fa), German (de), Portuguese (pt)

**Files to create/change:**
- `src/i18n/translations/` -- Translation files for each language
- `src/i18n/index.ts` -- Translation lookup system
- `src/hooks/useTranslation.ts` -- Hook for accessing translations
- `src/contexts/LanguageContext.tsx` -- Language context provider
- `src/components/onboarding/LanguagePickerStep.tsx` -- Onboarding step
- `src/config/marketing.ts` -- Convert to English
- All UI components -- Replace hardcoded Swedish strings with `t('key')` calls

**Note:** This is the largest change and will touch many files. The marketing page (`/marketing`) will be converted to English. The in-app experience defaults to the user's chosen language.

---

## Phase 4: Marketing Page to English

**Problem:** The marketing site is in Swedish but should be in English since it's the public-facing website.

**Solution:** Translate all strings in `src/config/marketing.ts` to English. This is a content-only change -- no structural code changes needed.

**Files to change:**
- `src/config/marketing.ts` -- Translate all Swedish text to English

---

## Phase 5: Plan Page Redesign (Premium Minimalist)

**Problem:** The Plan page feels cluttered with calendar events always visible, and tapping a day in the WeekStrip doesn't expand into a rich day view.

**Design principles:**
- Minimalist: hide information until requested
- Calendar events behind a small icon (tap to reveal in a popover)
- Tapping a day in WeekStrip opens an expanded "day detail" view
- Show outfit recommendation with explanation
- Beautiful, spacious layout with plenty of whitespace

**New Plan page UX flow:**

```text
+------------------------------------------+
|  Plan         [Hela veckan]              |
+------------------------------------------+
|  [Mon] [Tue] [Wed] [THU] [Fri] [Sat] [Sun]
|                     ^^^^                  
|                   selected                
+------------------------------------------+
|                                          |
|  Thursday, 20 February                   |
|  ~~~~~~~~~~~~~~~~~~~~~~~~                |
|  [Calendar icon]  2 events     [Weather] |
|                                          |
|  +------------------------------------+ |
|  |  Recommended Outfit                 | |
|  |  [4 garment images in a row]       | |
|  |                                     | |
|  |  "Perfect for your meeting at 10.   | |
|  |   Smart casual with navy tones."    | |
|  |                                     | |
|  |  [Swap]  [Details]                  | |
|  +------------------------------------+ |
|                                          |
|  [Mark as worn]        [Remove]          |
|                                          |
+------------------------------------------+
```

**Key changes:**
- `WeekStrip` stays but becomes the primary navigation
- Remove the vertical list of `DayCard` components -- only show the selected day
- Calendar events hidden behind a small calendar icon badge; tap opens a Popover showing the event list
- Selected day shows a single, beautiful expanded card with:
  - Date header with weather badge
  - Calendar event count (tap for details)
  - Outfit preview (large garment images)
  - AI explanation of why this outfit was chosen
  - Action buttons (Swap, Details, Mark worn, Remove)
- Empty state for unplanned days: two CTA buttons (Plan / Generate)

**Files to change:**
- `src/pages/Plan.tsx` -- Major restructure: single selected day view instead of day card list
- `src/components/plan/DayCard.tsx` -- Redesign as expanded "DayDetailView" with more space, better typography
- `src/components/plan/WeekStrip.tsx` -- Minor polish
- `src/components/plan/CalendarEventBadge.tsx` -- Wrap in Popover instead of always-visible badges

---

## Implementation Order

Given the scope, I recommend this order across multiple messages:

1. **Phase 1** (small) + **Phase 4** (content only) -- Fix icons + translate marketing to English
2. **Phase 5** -- Plan page redesign (standalone, no dependencies)
3. **Phase 2** -- Accent color system (onboarding + logo)
4. **Phase 3** -- i18n system (largest change, touches many files)

---

## Technical Notes

- **No database migrations needed** -- all new preferences (accent color, language) fit in the existing `preferences` JSONB column on `profiles`
- **RTL support** -- Arabic and Persian are RTL languages; the i18n system will need to set `dir="rtl"` on the root element when these languages are active
- **Marketing stays static** -- The marketing page is not translated dynamically; it's always in English
- **Accent color** -- Applied via CSS custom property so it cascades through the entire app without prop drilling
