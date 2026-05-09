# G4 — Wardrobe Gaps → Shopping Chat (replace Google bounce)

| Field | Value |
|---|---|
| Goal | "Find similar" / "Browse now" CTA per gap row that opens Shopping Chat with anchored gap context, replacing the Google search redirect. |
| Status | TODO |
| Branch | `fix/mobile-g4-wardrobe-gaps` |
| PR count | 1 |
| Depends on | G1 (StyleChat reads `route.params.gapContext`) |
| Complexity | S |
| Spec | [`docs/launch/g-campaign.md`](../g-campaign.md) |

## Background

Audit: `mobile/src/screens/PickMustHavesScreen.tsx:380–450` lets users mark gaps as "selected" but offers no fill-the-gap path beyond a Google search shortcut (per `src/components/gaps/gapRouteState.ts:3–9` web pattern, replicated to mobile as `Linking.openURL('https://www.google.com/search?q=' + encodeURIComponent(query))`).

Per `docs/launch/overview.md:41`: "Shopping Chat is supposed to be a mode in AIChat." The proper handoff is gap → Shopping Chat with `gapContext` so the Gemini run is anchored to "find me a {item_name} in {category}" and the user can converse from there.

G1 already extends StyleChatScreen to seed `route.params.{mode, gapContext}`. G4 just adds the call site.

## Files touched

### Modified
- `mobile/src/screens/PickMustHavesScreen.tsx` — under each gap row (or each "selected" gap row, design TBD per UX feel — go with all rows for discoverability), add a `<Button variant="ghost" size="sm">Find similar</Button>` that calls `nav.navigate('StyleChat', { mode: 'shopping', gapContext: { category: row.category, item_name: row.item_name } })`. Remove the existing Google `Linking.openURL` code path entirely (search the file for `google.com/search` and `Linking.openURL` to find the dead code; delete cleanly with no `// removed` comments).
- `mobile/src/i18n/locales/en.ts` + `sv.ts` — append `pickMustHaves.findSimilar`.

### Verified
- `mobile/src/navigation/MainStack.tsx` (or wherever StyleChat is registered) — confirm StyleChat accepts `mode` + `gapContext` route params types. G1 will have set this up; G4 just verifies.

## Pattern reference

- StyleChat seed contract from G1.
- Existing `Button` primitive from `mobile/src/components/Button.tsx`.

## Acceptance gates

- `tsc --noEmit` → 0 errors
- `eslint "src/**/*.{ts,tsx}" --max-warnings 0` → clean
- `expo-doctor` → passes
- Bundle delta ≤ +1 KB
- Manual: open PickMustHaves with at least one identified gap → tap "Find similar" → StyleChatScreen opens in shopping mode with the gap text prefilled.
- Manual: confirm no `google.com/search` URL is hit anywhere in PickMustHaves flow (grep verifies).
- i18n: en/sv updated.
- Code-reviewer: approved.
- Codex: 👍 / "no bugs found" + quiet window.
- Mandatory 2nd self-review: clean.

## Deploy

None.

## PR template

Title: `fix(mobile): G4 — Wardrobe Gaps "Find similar" routes to Shopping Chat`

Body:
- Replaces `Linking.openURL('google.com/search?q=...')` with in-app navigation to StyleChat shopping mode + gap context.
- Uses G1's `route.params.gapContext` contract.
- Plan: `docs/launch/waves/g4-wardrobe-gaps.md`
