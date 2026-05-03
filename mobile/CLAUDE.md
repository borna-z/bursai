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

- **Never touch `supabase/` or `src/`.** Those are the web app + edge functions; mobile is read-only against the Supabase project. Edge functions are deployed once and consumed by both apps.
- **Never add new edge functions** unless the user explicitly says so. Mobile-specific server work goes through the existing Wave plan in root `CLAUDE.md`.
- **Never push directly to `main`.** All changes via PR on `feat/mobile-rn-app` (or feature branches off it).
- **Single accent colour** — only the warm gold (`accent` token). No new brand colours. Borders + neutrals do everything else.
- **No emojis anywhere** in the UI. All glyphs are SVG via `react-native-svg`.
- **Italic Playfair** is reserved for: page titles, large numerals, eyebrows on a few signature spots, statement copy. Don't overuse.
- **Eyebrow micro-labels** above almost every section title — uppercase 10px / 0.18em / `fg2`.
- **Garment card stays as-is** — when wired up, reuse whatever card pattern the user already has in their existing app, don't redesign.
- **Light + dark both implemented from day one.** Both must work — `useTheme()` from `src/theme/ThemeProvider.tsx` is the only source of truth.
- **Token discipline.** Every colour, radius, spacing comes from `src/theme/tokens.ts`. Never hardcode `#FBF7EF` etc. inside a screen — use `t.card`.
- **Append-only** for any future i18n locale files (`src/i18n/locales/*.ts`) — same convention as web.

## Project layout (read by `ls` — see `RootNavigator.tsx` for route map)

`App.tsx` → SafeArea → Theme → Navigation. Source under `src/`: `theme/` (tokens + ThemeProvider), `lib/supabase.ts` (RN client w/ AsyncStorage), `components/` (UI primitives), `screens/` (one file per route + PlaceholderScreen), `navigation/RootNavigator.tsx` (native-stack, MainTabs initial). Build status (done vs pending screens/components) lives in PR descriptions + `git log`, not here — drifts too fast in this file.

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
- Don't reimplement the web's `useGarments` / `useProfile` etc. by hand — port them once needed, but talk to the user before doing so to keep auth / cache layers consistent.
