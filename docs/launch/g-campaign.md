# Mobile gap remediation — overnight 6-PR campaign
**Date:** 2026-05-09
**Status:** approved (user, 2026-05-09)
**Authority:** standing CEO overnight authority for post-launch theme PRs (per memory `feedback-overnight-autonomous-mode.md`).
**Branch base:** `main`. Each theme is its own PR.
**Wave preempt:** M38 (SettingsStyle 8-section editor) is paused; this campaign is higher priority. Resume M38 when G1–G6 are merged.

> Single source of truth for the campaign. Per-theme plan files live in `docs/launch/waves/g{1..6}-*.md` and are self-contained. Read this file once, then read the active theme's plan file, then implement.

---

## Why this campaign

Six concrete user-reported flow failures + one cross-cutting render bug:

1. Style/Shopping Chat — no outfit cards, no history sheet, mode toggle bleeds context, restyle button doesn't anchor into chat.
2. Home — recent outfits show colored gradients instead of garment thumbnails.
3. Travel Capsule — picker untappable, single-select trip type, saved list hidden, no per-day outfit screen, generation hangs.
4. Wardrobe Gaps — Google search redirect instead of in-app Shopping Chat handoff.
5. Style Me — no auto-weather, no adjust, limited occasion/formality, restyle redirects to start, no anchor before generate, save→preview state stuck.
6. Cross-cutting — `OutfitCard` takes `hues` props instead of garment data; `GarmentCard` has no loading shimmer; recurring "colored card" complaint across screens.

Audit performed by parallel Explore agents 2026-05-09. File:line references for every gap captured in the per-theme plans.

---

## Theme map (G1–G6) and dependency order

```
G6 (cross-cutting card primitive — no deps)
  │
  ├──> G2 (Recent Outfits real thumbs — uses G6 OutfitCard)
  │
  └──> G1 (Style/Shopping Chat — uses G6 inside chat)
        │
        ├──> G5 (Style Me — restyle navigates to G1 with anchors)
        │
        └──> G4 (Wardrobe Gaps → Shopping Chat — uses G1 navParam contract)
              │
              └──> G3 (Travel Capsule — uses G6 for per-day outfit cards)
```

**Sequential execution overnight.** G6 first (everything depends on it). After G6 merges, G2 and G1 are safe to run sequentially. After G1, G5 and G4. G3 last (highest surface area).

| PR | Theme | Surface area | Risk | Plan file |
|---|---|---|---|---|
| G6 | Cross-cutting card primitive | `mobile/src/components/{Garment,Outfit}Card.tsx`, `useGarmentImage`, callers | Med | `docs/launch/waves/g6-card-primitive.md` |
| G2 | Home Recent Outfits real thumbs | `mobile/src/screens/HomeScreen.tsx` (`RecentOutfitTile`) | Low | `docs/launch/waves/g2-home-recent-outfits.md` |
| G1 | Style/Shopping Chat | `StyleChatScreen.tsx`, `useStyleChat.ts`, new `ChatHistorySheet.tsx` | Med-high | `docs/launch/waves/g1-style-chat.md` |
| G5 | Style Me | `StyleMeScreen.tsx`, `useWeather.ts`, `useGenerateOutfit.ts` | Med-high | `docs/launch/waves/g5-style-me.md` |
| G4 | Wardrobe Gaps → Shopping Chat | `PickMustHavesScreen.tsx`, StyleChat navParam parsing | Low | `docs/launch/waves/g4-wardrobe-gaps.md` |
| G3 | Travel Capsule | `TravelCapsuleScreen.tsx`, `TravelGarmentPicker.tsx`, `useGenerateTravelCapsule.ts`, new `TravelOutfitsScreen.tsx` | High | `docs/launch/waves/g3-travel-capsule.md` |

---

## Decisions locked at brainstorm time (binding inputs to all plans)

1. **Themed PRs**, one per area. No mega-PR.
2. **M38 preempted.** Resume when G6 merged.
3. **Standing CEO overnight authority applies:** review → fix → mandatory 2nd review pass → merge if clean → next theme.
4. **Occasions/formality:** match web's 6 (casual, work, evening, date, workout, travel) and 4 dynamic formality submodes (Formal Office, Business Casual, Relaxed Office, Baseline) — **plus a `Custom…` chip with a text input** that pipes free-form occasion strings into the engine.
5. **OutfitCard refactor (G6):** accept `garments: { id, rendered_image_path, original_image_path }[]` as a new prop. Keep `hues` as a fallback when garments aren't provided so legacy callers don't crash. New consumers pass garments; legacy gets gradients until upgraded.
6. **Loading state:** `useGarmentImage` + GarmentCard get a `isResolving` derived state. While resolving, render a shimmer skeleton, not the gradient. Gradient stays as the genuinely-no-image fallback.
7. **Chat history scope (G1):** ChatHistorySheet shows threads grouped by mode + date. Switching mode loads that mode's thread list and clears the active message buffer.
8. **Restyle contract (G1+G5):** "Restyle" navigates to `StyleChatScreen` with `route.params = { mode: 'stylist', anchorGarmentIds: string[], sourceOutfitId?: string }`. StyleChatScreen seeds the anchor row from params on mount.
9. **Shopping handoff (G4):** "Find similar" navigates to `StyleChatScreen` with `route.params = { mode: 'shopping', gapContext: { category, item_name } }`. StyleChatScreen seeds the input prefill + sets mode = shopping on mount.
10. **Travel capsule schema (G3):** the edge function already returns `outfits[]` grouped by `.day`. Mobile just needs to render it. No backend changes.
11. **No new edge functions.** All work is mobile-only + UI-only. Backend signatures unchanged.

---

## Per-theme acceptance gates (drop-in for plan files)

### G6 — Cross-cutting card primitive
- [ ] `OutfitCard` accepts a `garments` prop and renders real thumbs in a 2×2 grid via `useGarmentImage` per item.
- [ ] `OutfitCard` falls back to `hues` gradient if `garments` is undefined (legacy compat).
- [ ] `GarmentCard` exposes a `isResolving` shimmer state distinct from "no image."
- [ ] Shimmer uses `Animated.Value` opacity oscillation; matches web's `animate-pulse` rhythm.
- [ ] No callers crash. `tsc --noEmit` clean. ESLint clean. Bundle size delta ≤ +5 KB.

### G2 — Home Recent Outfits
- [ ] `RecentOutfitTile` (mobile/src/screens/HomeScreen.tsx:767–824) iterates `outfit.outfit_items.slice(0,4)` and renders real thumbs via the upgraded `OutfitCard` (or via `useGarmentImage` directly if simpler).
- [ ] Loading shimmer visible during signed-URL fetch.
- [ ] Falls back to existing gradient hue if all garment image_paths are null.
- [ ] No data-layer changes; consumes the existing `useOutfits` query shape.

### G1 — Style/Shopping Chat
- [ ] `MessageItem` in `StyleChatScreen.tsx` renders an `OutfitSuggestionCard`-equivalent when `stylistMeta?.render_outfit_card && resolvedOutfitIds.length > 0`. Uses upgraded `OutfitCard` (G6).
- [ ] New `ChatHistorySheet` component (modal) lists threads grouped by mode + date. Triggered from header icon.
- [ ] `useStyleChat.setMode(mode)` reloads history filtered by `mode` and clears the active message buffer; mode-toggle no longer bleeds context.
- [ ] StyleChatScreen reads `route.params.{mode, anchorGarmentIds, gapContext}` on mount and seeds state accordingly.
- [ ] Chat pings `@codex` clean.

### G5 — Style Me
- [ ] `useWeather` requests `expo-location` permission, calls `Location.getCurrentPositionAsync()`, falls back to Stockholm if denied/error.
- [ ] "Adjust" weather button opens a bottom sheet with temperature + condition input that updates `useWeather` state.
- [ ] Occasion chips: 6 web-parity values + `Custom…` chip → text input.
- [ ] Formality chips: 4 engine submodes (Formal Office, Business Casual, Relaxed Office, Baseline).
- [ ] Anchor garment picker (bottom sheet) above formality chips; passes `anchor_garment_ids` to generate call.
- [ ] "Restyle" calls `nav.navigate('StyleChat', { mode: 'stylist', anchorGarmentIds, sourceOutfitId })` instead of `reset()`.
- [ ] After save, screen transitions to a "Saved ✓" state (badge + outfit detail link).

### G4 — Wardrobe Gaps
- [ ] `PickMustHavesScreen` adds a "Find similar" button per gap row.
- [ ] Button calls `nav.navigate('StyleChat', { mode: 'shopping', gapContext: { category, item_name } })`.
- [ ] Existing Google bounce code path removed.

### G3 — Travel Capsule
- [ ] `TravelGarmentPicker` grid is height-constrained (`maxHeight: 320`) with internal scroll; tappable from any state.
- [ ] Trip type stays single-select; new Occasions multi-select chips (9 web-parity options) appear below trip type. Both pipe into edge function payload.
- [ ] Saved-capsules list rendered unconditionally on form sub-step (lift out of `subStep === 'picker'` gate at lines 485–511).
- [ ] `useGenerateTravelCapsule` keep-alive: extend `callEdgeFunction` timeout to 90s; verify timeout starts on response-byte arrival, not request start. Add abort + retry-once on first-byte timeout.
- [ ] After generation, must-haves screen shows actual garment thumbs (uses G6 `OutfitCard`).
- [ ] New `TravelOutfitsScreen` parses `capsule.outfits[]` grouped by `.day`; renders Day Header + per-outfit `OutfitCard` (G6) with garment thumbs.
- [ ] Navigation from packing list → outfits screen via second CTA or tab.

---

## Per-PR loop (overnight CEO mode)

For each theme G6 → G2 → G1 → G5 → G4 → G3:

1. **Branch off main.** `git checkout main && git pull && git checkout -b fix/mobile-g{N}-{slug}`
2. **Read the plan file.** `docs/launch/waves/g{N}-{slug}.md`. Self-contained — don't read sibling plans.
3. **Implement.** Mobile-only edits. No edge function changes.
4. **Run gates** (per `mobile/CLAUDE.md`):
   - `cd mobile && npx tsc --noEmit` → 0 errors
   - `cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0` (NOTE: glob form, not `--ext` — they catch different warnings)
   - `cd mobile && npx expo-doctor` → passes
   - `cd mobile && npx expo export -p ios -o /tmp/expo-export` → bundle ≤ baseline + 30 KB
5. **`code-reviewer` subagent pass.** Use the brief in `mobile/CLAUDE.md` lines 119–124. Fix all P0/P1.
6. **Commit + push + open PR** targeting `main`. Title: `fix(mobile): G{N} — {short title}`. Body links to plan file.
7. **Codex review loop** (per `feedback-codex-review-loop.md`):
   - Push triggers Codex automatically. Wait for 👀 reaction.
   - Fix every Codex finding (including design). Resolve threads after each fix.
   - Re-ping with `@codex` after each round.
   - Loop until **one positive signal** (👍 OR "no bugs found") + 5-min quiet window.
   - HARD STOP if quota exhausted — flag in PR comment, surface to user, do not merge.
8. **Mandatory 2nd self-review pass** (per `feedback-self-review-after-codex.md`): re-read full diff with fresh eyes, scan for bugs Codex missed, fix, re-scan, until a full pass finds nothing. Only then merge.
9. **Merge.** Squash. Delete branch.
10. **Tracker update.** Append to `docs/launch/completion-log.md` (one line per theme: PR # + brief outcome).
11. **Move to next theme.** Recheckout main, pull, branch.

**Failure modes that escalate (do not auto-merge):**
- Hardcoded fake data introduced anywhere (per `feedback-no-hardcoded-stubs.md`).
- Tests would need to be skipped/xfail'd to merge.
- Type errors that "shouldn't matter" — they always matter.
- Codex quota exhausted without a positive signal.
- Self-review finds something on the post-Codex pass and the fix triggers a NEW Codex round that doesn't reach a positive signal.

In any escalation case: park the PR clean and ready to merge, post a comment summarizing what's blocked, move to the next theme.

---

## What we will NOT touch in this campaign

- `supabase/functions/*` — no edge function edits. All gaps are mobile UI-side.
- `supabase/migrations/*` — no schema work.
- `src/` web tree — type imports allowed (per CLAUDE.md), runtime imports forbidden.
- `mobile/src/i18n/locales/*` — append-only. Any new strings get appended to both `en.ts` and `sv.ts` per `feedback-pr-gate-workflow.md`.
- `M38 SettingsStyle` work. Resumes after this campaign.

---

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| G6 OutfitCard refactor breaks legacy callers (SmartDayBanner, MoodFlowScreen) | Med | `garments` is an optional prop with `hues` fallback. tsc + eslint + manual screen sweep before merge. |
| G1 ChatHistorySheet adds performance cost on cold open | Low | Lazy-load thread list with paged query; render only after sheet opens. |
| G3 keep-alive change masks a real edge function regression | Low | Log first-byte timestamp on every generate call; surface to Sentry. |
| Codex quota exhausts mid-campaign | Med | HARD STOP protocol per memory. Last clean PR merges; subsequent themes park as draft. |
| Per-day outfit data shape (G3) doesn't match assumption | Med | First step in G3 plan is to log the `outfits[]` payload from a real generate run before writing UI. |
| G5 anchor picker breaks Style Me's existing single-screen flow | Low | Anchor picker is an optional bottom sheet; nothing changes if user doesn't open it. |

---

## What "done" looks like for the campaign

- 6 PRs merged to main.
- `docs/launch/completion-log.md` updated.
- M38 wave file untouched and ready to resume.
- A morning-summary comment on the parent thread listing each merged PR + any escalations + what was deferred.
- No regressions: bundle size within budget, no new Sentry events tied to the campaign branches.
