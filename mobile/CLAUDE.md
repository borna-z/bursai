# mobile/ — BURS React Native app

This file provides guidance to Claude Code (claude.ai/code) when working inside `mobile/`.
Standing rules. Read once per session before touching code.

## Project identity

| Field | Value |
|-------|-------|
| Project | `burs-mobile` (React Native via Expo SDK 54) |
| Location | `mobile/` inside the `bursai` monorepo |
| Backend | Supabase project ref `khvkwojtlkcvxjxztduj` (shared with web app) |
| Design handoff | `design_handoff_burs_rn/` (repo root — README, tokens, source/) |
| Distribution | Expo EAS Build → App Store + Play Store |
| Branch for ongoing work | `feat/mobile-rn-app` |

## Build & run

```bash
# inside mobile/
npm run ios        # open in iOS Simulator (requires Xcode)
npm run android    # open in Android emulator (requires Android Studio)
npm run web        # browser preview
npm start          # Expo dev server — pick target via QR / menu
```

### Required env (mobile/.env — never committed; copy from `.env.example`)

```
EXPO_PUBLIC_SUPABASE_URL=https://khvkwojtlkcvxjxztduj.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key-from-web-.env>
```

Expo inlines `EXPO_PUBLIC_*` at build time — same role as web's `VITE_*`.

## Standing rules — never break these

- **`supabase/` and `src/` are mostly off-limits.** Web app + edge functions live there. **Launch carve-outs:** mobile-launch waves M5 (modify `supabase/functions/send_push_notification/index.ts` to add Expo push branch) and M6 (add `supabase/functions/revenuecat_webhook/index.ts`) are explicitly authorized. Migrations under `supabase/migrations/` are authorized when a wave file specifies one. Web `src/` runtime code remains forbidden — type imports only.
- **Edge function additions allowed when a wave file authorizes them.** The launch needs `revenuecat_webhook` (M6) and the `send_push_notification` Expo branch (M5); both are inside their wave files. Anything beyond an authorized wave still requires explicit user approval.
- **Never push directly to `main`.** All changes via PR on `feat/mobile-rn-app` (or feature branches off it).
- **Single accent colour** — only the warm gold (`accent` token). No new brand colours. Borders + neutrals do everything else.
- **No emojis anywhere** in the UI. All glyphs are SVG via `react-native-svg`.
- **Italic Playfair** is reserved for: page titles, large numerals, eyebrows on a few signature spots, statement copy. Don't overuse.
- **Eyebrow micro-labels** above almost every section title — uppercase 10px / 0.18em / `fg2`.
- **Garment card stays as-is** — when wired up, reuse whatever card pattern the user already has in their existing app, don't redesign.
- **Light + dark both implemented from day one.** Both must work — `useTheme()` from `src/theme/ThemeProvider.tsx` is the only source of truth.
- **Token discipline.** Every colour, radius, spacing comes from `src/theme/tokens.ts`. Never hardcode `#FBF7EF` etc. inside a screen — use `t.card`.
- **Append-only** for any future i18n locale files (`src/i18n/locales/*.ts`) — same convention as web.

## Project structure

```
mobile/
  App.tsx                          ← root: SafeArea → Theme → Navigation
  src/
    theme/
      tokens.ts                    ← light + dark + radii + spacing + text scale
      ThemeProvider.tsx            ← context, useTheme(), useTokens()
    lib/
      supabase.ts                  ← Supabase RN client (AsyncStorage, polyfill)
    components/                    ← reusable UI primitives (see Component inventory)
    screens/                       ← one file per route, plus PlaceholderScreen
    navigation/
      RootNavigator.tsx            ← native-stack, MainTabs initial
```

## Build order — what's done, what's next

The handoff lists ~30 screens and 22 components. Build in this order. Do NOT skip ahead:

### Done
- [x] `tokens.ts` + `ThemeProvider`
- [x] `supabase.ts` (RN client)
- [x] Components: `Eyebrow`, `PageTitle`, `Caption`, `Button`, `IconBtn`, `Chip`, `Card`, `StatBlock`, `icons` (SVG set), `Skeleton`, `Spinner`, `FadeUp`, `BottomNav`
- [x] `RootNavigator` (every route registered with `PlaceholderScreen` for unbuilt ones)
- [x] `MainTabsScreen` (custom 4-tab container, FAB pushes onto root stack)
- [x] `HomeScreen` (real implementation)
- [x] `WardrobeScreen` / `PlanScreen` / `InsightsScreen` (placeholder stubs — real impls next PR)

### Next (in priority order)

1. **WardrobeScreen** — wire to existing garment card; add tabs/search/filter/grid.
2. **PlanScreen** — week strip, planned-outfit panel, upcoming list.
3. **InsightsScreen** — real Gauge + PaletteBar + wear-frequency bars + most-worn list.
4. **Add piece flow** (3 steps) — Step1/Step2/Step3.
5. **MoodOutfit** + **MoodFlow** — 12 SVG glyphs + 3-step flow.
6. **StyleMe** — occasion chips + outfit cards.
7. **StyleChat** — bubbles + composer + suggestion chips.
8. **TravelCapsule** wizard (6 steps).
9. Settings sub-pages (Appearance / Style / Notifications / Account / Privacy).
10. Auxiliary: ResetPassword / 404 / Share / PublicProfile / Billing.

### Components still pending

`Gauge`, `PaletteBar`, `OutfitCard`, `MoodCard`, `SourcePill`, `PhotoTile`, `WeekStrip`, `ListRow`, `SettingsRow`, `TogglePill`. Build the one each new screen needs, not all at once.

## Fonts

Tokens reference `PlayfairDisplay-Italic`, `PlayfairDisplay-MediumItalic`, `DMSans-Regular/Medium/SemiBold/Bold`.
The .ttf files aren't in `assets/fonts/` yet — RN falls back to system serif/sans until they're added.

To enable real fonts:
1. Drop `.ttf` files in `assets/fonts/`.
2. Wrap `App` in `useFonts({...})` from `expo-font`, return `null` until loaded.
3. Family names in `tokens.ts` already match the expected names — no token edits needed.

## Navigation contract

- `MainTabs` is the initial route — a custom container (NOT `@react-navigation/bottom-tabs`).
- `goTab: (id: TabId) => void` is passed from `MainTabsScreen` to its child tab screens.
- All non-tab routes are pushed onto the parent native-stack via `useNavigation().navigate('RouteName')`.
- The (+) FAB pushes `AddPieceStep1` onto the root stack — it's NOT a tab.
- Type the `useNavigation` hook with `NativeStackNavigationProp<RootStackParamList>` — every route is in the param list (see `RootNavigator.tsx`).

## Verification — after every screen / component change

```bash
npx tsc --noEmit          # 0 errors
```

Smoke-test in a simulator before opening a PR. There's no Vitest in `mobile/` yet — add `jest-expo` when component tests are needed.

## Commit style

Branch off `feat/mobile-rn-app`. Commits:
`feat(mobile): [ScreenName] — pixel-faithful RN implementation`
`feat(mobile): [Component] component`
`fix(mobile): [terse description]`

Open a PR per logical chunk (a screen + the components it needs).

## Anti-patterns to avoid

- Don't introduce a state library (Zustand/Jotai/etc.) without asking. React Query handles server state; component-local `useState` handles UI state.
- Don't import directly from `tokens.ts` inside a component file — go through `useTokens()` so theme changes propagate.
- Don't use `display: 'none'` for animations — use `Animated.Value` (already wired in `FadeUp` / `Spinner`).
- Don't reach into `../src` (the web app) — different platform, different bundler.
  **Carve-out (W2+):** `import type { Database } from '../../../src/integrations/supabase/types'` is permitted because the schema is shared and that file is auto-generated by `supabase gen types typescript --linked`. Type-only imports are stripped at build time so no runtime symbol leaks. No other reach-in is allowed; runtime helpers must be ported into `mobile/src/`.
- Don't reimplement the web's `useGarments` / `useProfile` etc. by hand — port them once needed, but talk to the user before doing so to keep auth / cache layers consistent.

---

## Mobile Launch — Per-PR Workflow (added 2026-05-04)

The launch plan ships in waves M0–M14. **Source of truth:** `docs/launch/mobile-launch-overview.md` — read it once per session to find the current wave.

### Token-budget contract per PR session

A fresh agent picking up a wave should read:
1. This file (`mobile/CLAUDE.md`) — auto-loaded.
2. Root `CLAUDE.md` — auto-loaded.
3. `docs/launch/mobile-launch-overview.md` — find CURRENT WAVE pointer.
4. **The single wave file** for the current wave (e.g. `docs/launch/mobile-w0-sentry.md`).
5. **Only** the source files named in the wave's "Files touched" section.

No exploratory reads. No sibling wave files. The wave file is self-contained — full code skeletons, migrations, screen diffs, acceptance gates, PR template.

### Hook pattern (every new mobile hook follows this)

Mirror `mobile/src/hooks/useAddGarment.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { captureMutationError } from '../lib/sentry'; // M0 onwards

export function useThing() {
  const queryClient = useQueryClient();
  const { user, session } = useAuth();

  return useMutation({
    mutationFn: async (input) => {
      if (!user) throw new Error('Not authenticated');
      // either supabase.from('table').select/insert/update/delete()
      // OR fetch(`${supabaseUrl}/functions/v1/<name>`, {
      //      headers: { Authorization: `Bearer ${session.access_token}` }
      //    })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['x'] }),
    onError: captureMutationError('useThing'),
  });
}
```

For queries (read-only): `useQuery({ queryKey: ['x', user?.id], enabled: !!user, queryFn: ... })`.

### Pre-push gates (every PR)

```bash
cd mobile && npx tsc --noEmit          # 0 errors — required
```

There is no eslint or build pipeline yet for `mobile/`. Bundle/runtime health is verified at the M13 TestFlight cut, not per-PR.

### Code-reviewer subagent before push (mandatory)

Call `Agent(subagent_type="superpowers:code-reviewer", ...)` with this brief verbatim:
> Review this diff against `feat/mobile-rn-app`. Check: (1) does it satisfy the wave's acceptance criteria? (2) are any callers of changed symbols broken? (3) does new code follow the `useAddGarment.ts` hook pattern (useAuth + supabase from `../lib/supabase` + captureMutationError on mutations)? (4) any drift from the wave file's skeletons? Report under 200 words.

Don't open the PR until the reviewer is clean.

### Tracker updates (in the same PR — never separate)

Inside the wave's PR commit:
1. Flip the wave's row in `docs/launch/mobile-launch-overview.md` from `🔄 TODO` to `[DONE] (PR #<num>, YYYY-MM-DD)`.
2. Move CURRENT WAVE pointer to the next `🔜 TODO` wave.
3. Update `LAST UPDATED`.
4. Append to `docs/launch/completion-log.md` with `M<N>` prefix.
5. New findings → `docs/launch/findings-log.md` with `M<N>` prefix.

PR number placeholder resolved via `git commit --amend --no-edit && git push --force-with-lease` immediately after `gh pr create`.

### Hard-rule additions for launch waves

- Wave files that touch `supabase/migrations/` MUST follow the root `CLAUDE.md` Database Migration Rules (matching timestamps, vault for secrets, post-deploy smoke test if introducing a cron).
- Wave files that touch `supabase/functions/` MUST include the deploy command in the wave: `npx supabase functions deploy <name> --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`.
- New hooks live in `mobile/src/hooks/`, never in screens.
- Migrations + edge function changes deploy AFTER `db push`, never before.
