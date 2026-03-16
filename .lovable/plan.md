

# BURS Product Audit — Findings & Phased Improvement Plan

## What Was Audited
All major screens and flows: Home, Wardrobe, Plan, Insights, AI Chat, OutfitGenerate, OutfitDetail, GarmentDetail, LiveScan, MoodOutfit, Onboarding, Auth, Settings, Discover, Landing, BottomNav, PaywallModal, QuickActionsRow, AISuggestions, AnimatedRoutes, AppLayout, AuthContext, and ProtectedRoute.

---

## What Is Strong (Preserve)

- **Auth flow**: Clean editorial design, OAuth + email, password validation, forgot password — polished and complete
- **Onboarding**: 5-step state machine with progress bar, animated transitions, style quiz, accent color picker — well-structured
- **Wardrobe**: Virtualized grid/list toggle, swipeable cards, infinite scroll, smart filters, FAB with scan/photo options, bulk select — production-grade
- **LiveScan**: Camera feed with focus reticle, auto-detect, confidence indicator, scan overlay phases — premium feel
- **Outfit generation (new)**: Clean state machine (picking/generating/error), 18 styles, 6 occasions, weather auto-inject — just rebuilt, working
- **OutfitDetail**: Slot-based garment list, swap sheet with safe/bold/fresh modes, star rating, feedback chips, share/download, photo feedback — feature-rich
- **GarmentDetail**: Hero image, floating controls, laundry toggle, condition assessment, cost-per-wear, similar items — complete
- **Plan page**: Week strip, day summary, auto-generate week, calendar integration, multi-outfit per day — well thought out
- **BottomNav**: Frosted glass, animated pill, haptic feedback, route prefetch — premium
- **Surface design system**: 4-tier hierarchy (hero/secondary/inset/interactive) — consistent
- **i18n**: Full language context with locale-aware date formatting
- **Session persistence**: Recently fixed, now stable without sessionStorage hacks

---

## Issues Found

### High Impact

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | **Discover page is a dead end** — shows only a title and WardrobeProgress component, no actual content or tools | `Discover.tsx` | High |
| 2 | **OutfitGenerate button label says "Generate outfit"** — violates BURS brand tone ("Style me" per brand guidelines) | `OutfitGenerate.tsx` | Medium |
| 3 | **`remember_me` is still written to localStorage** on Auth page (lines 65, 78) but no longer read anywhere after the session fix — dead code that could confuse future devs | `Auth.tsx` | Low |
| 4 | **Discover is not in BottomNav** — it exists as a route but has no primary navigation entry, making it undiscoverable | `BottomNav.tsx` + `AnimatedRoutes.tsx` | Medium |
| 5 | **App.css contains Vite boilerplate** — logo spin animation, `.read-the-docs` class, root padding/centering — none of it is used | `App.css` | Low |
| 6 | **`console.log` in OutfitDetail** — debug logging left in production render path (line 430) | `OutfitDetail.tsx` | Low |
| 7 | **QuickActionsRow has only 2 buttons** — feels sparse for the primary home action area; "Style me" and "Plan tomorrow" could benefit from a third contextual action | `QuickActionsRow.tsx` | Low |
| 8 | **Swap sheet description is hardcoded English** — "Choose how different you want the replacement to feel." not i18n'd | `OutfitDetail.tsx` line 64 | Medium |
| 9 | **Generate button text "Generate outfit"** not using brand copy ("Style me") | `OutfitGenerate.tsx` line 199 | Medium |
| 10 | **AISuggestions "handlePlan" calls handleTryIt** — plan button creates the outfit but doesn't navigate to the Plan page with a date selector; it behaves identically to "Try it" | `AISuggestions.tsx` line 231-233 | Medium |

### Low Impact / Polish

- OutfitGenerate weather badge shows raw `t(weather.condition)` which may not resolve for all condition strings
- PaywallModal uses amber/orange gradient which doesn't match the neutral BURS palette
- GarmentDetail "Use in outfit" navigates to `/` with state `prefillGarmentId` but Home doesn't consume this state

---

## Phased Improvement Plan

### Phase 1 — Safe First Pass (implement now)
1. **Remove dead App.css boilerplate** — zero risk, removes Vite template leftovers
2. **Remove console.log from OutfitDetail** — clean production output
3. **Clean up dead `remember_me` localStorage writes from Auth.tsx** — remove lines 65 and 78
4. **Fix hardcoded English in OutfitDetail swap sheet description** — use `t()` key
5. **Update OutfitGenerate button copy** from "Generate outfit" to "Style me" per brand guidelines

### Phase 2 — Medium Effort (next session)
1. **Rebuild Discover page** with actual content: style tools, wardrobe gap analysis, challenges, mood outfit entry
2. **Fix AISuggestions "Plan" button** to navigate to Plan page with outfit pre-selected for a date
3. **Add a third quick action** to Home (e.g., "Ask Stylist" linking to `/ai`)

### Phase 3 — Strategic (future)
1. Evaluate whether Discover should replace Insights in the BottomNav or become a sub-section
2. Audit all edge function error paths for consistent i18n
3. Add empty state animations that feel editorial rather than generic

