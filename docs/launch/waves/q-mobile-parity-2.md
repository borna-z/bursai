# Q — Mobile parity sweep #2

| Field | Value |
|---|---|
| Goal | Four themed PRs that close visible-to-user mobile gaps surfaced post-launch: Home SmartDayBanner garment thumbs, chat outfit-card render+refine parity, Plan/Generate flow with date-aware planning, Wardrobe filters wired with server counts + new personal flags (Lingerie / Wishlist / In Laundry). |
| Status | IN PROGRESS — Q-A DONE (PR #826); Q-D1 DONE (PR #827 silent-failure guard); Q-D2 (refine parity, this branch); Q-B / Q-C1 / Q-C2 TODO |
| Branch base | `main` |
| PR count | 4 (Q-A, Q-D, Q-B, Q-C) — Q-C internally split into Q-C1 (server counts) + Q-C2 (schema flags) for review-ability |
| Migrations | One — `garments` adds three personal-flag booleans (Q-C2 only) |
| Complexity | M (Q-A, Q-D) · L (Q-B) · XL (Q-C) |
| Authority | Standing CEO post-launch theme-PR authority — multi-agent review → fix → mandatory 2nd review pass → merge if clean → next theme |

## Background

Post-launch manual QA on 2026-05-11 surfaced four user-visible parity gaps the launch parity sweep (Wave P, PRs A-D) did not cover:

1. **Home SmartDayBanner** renders the recommendation card with neutral hue placeholders instead of real garment thumbnails — the data is present (`top1.outfit.outfit_items[].garment`), only the prop wiring is wrong.
2. **Plan + OutfitGenerate** result screen renders four colored placeholder squares ("Real garment images land in W9" — that wave never landed). There is no date-picker UI anywhere on mobile; "Wear today" is hard-coded to today.
3. **Wardrobe** filters Recently Added / Most Worn / Unworn this season / Lingerie / Wishlist / Gaps render labels but show "—" or no count. Recently/Most/Unworn are wired but client-side filtered on page-1 only (collapse to "—" on paginated wardrobes). Lingerie / Wishlist / In Laundry are pure UI stubs with no backend column.
4. **Chat** assistant-generated outfit messages don't appear at all — no explanation text, no card, no images. Beyond that root cause, the chat outfit card lacks multi-item lock + Refine button + `locked_slots[]` request shape that web already has.

Web is the source-of-truth reference for every fix.

## PR order & ordering rationale

1. **Q-A** — SmartDayBanner garment thumbs · single-file fix · ~5-min diff
2. **Q-D** — Chat outfit card render + full refine parity · diagnose-first; biggest UX win
3. **Q-B** — Plan/Generate flow rework with new PlannerSheet
4. **Q-C1** — Wardrobe smart-filter server counts (code-only, no migration)
5. **Q-C2** — Wardrobe personal-flags schema migration + filter wiring + edit-form toggles

Sequenced smallest-blast-radius first; migration last so it lands after the bulk of UI work is reviewed.

---

## Q-A · Home SmartDayBanner garment thumbnails — DONE (PR #826, merged 2026-05-11)

### Bug
`mobile/src/components/SmartDayBanner.tsx:147-151` passes only `hues={[…]}` to `OutfitCard`. The `OutfitCard` component (`mobile/src/components/OutfitCard.tsx:46`) accepts a `garments?: OutfitCardGarment[]` prop that renders real signed-URL `GarmentImageTile`s when present; the banner has the data (`top1.outfit.outfit_items`) but never extracts and forwards it.

Result: the banner renders a working layout (eyebrow + title + card + caption) but the 2×2 card tiles stay as neutral placeholder squares — exactly the user-reported "fully functional but pictures do not show".

### Fix
Single-file edit:

```tsx
// SmartDayBanner.tsx ~147
const cardGarments = (outfit.outfit_items ?? [])
  .map((it) => it.garment)
  .filter((g): g is NonNullable<typeof g> => !!g);

<OutfitCard
  name={outfitName}
  sub={subLabel}
  garments={cardGarments}
  hues={hues}
/>
```

`hues` stays as the length-fallback signal — `OutfitCard.tsx:78` prefers `garments` when non-empty.

### Files touched

#### Modified
- `mobile/src/components/SmartDayBanner.tsx` — derive `garments` from `outfit_items`, pass to `OutfitCard`

### Acceptance

- When `useSmartDayRecommendation` returns a `top1.outfit` with hydrated `outfit_items[].garment`, banner card renders real garment thumbs.
- When `outfit_items` is empty or unhydrated, banner card falls back to neutral tiles (existing parity-A behavior).
- Banner still self-hides on `hasPlannedOutfit || error || !top1` (no behaviour change to gating).

### Gates
TS 0 · ESLint `"src/**/*.{ts,tsx}"` 0 warnings · expo-doctor pass · expo export under threshold.

---

## Q-D · Chat outfit card render + refine parity — split into Q-D1 + Q-D2

### Diagnosis (2026-05-11)

The reported symptom "nothing renders — no bubble, no card, no text, just my user message and then silence" was traced to `useStyleChat.ts:647`: the SSE `onError` handler **silently filtered the assistant placeholder out of `messages`**, AND in some failure paths the user-facing banner was also suppressed:

- Banner gate: `error && error !== SUBSCRIPTION_SENTINEL ? error : null` (`StyleChatScreen.tsx:459`). Empty-string `err.message` is falsy → banner suppressed.
- Paywall path: `error === SUBSCRIPTION_SENTINEL` → banner suppressed by design (Alert fires elsewhere) but the assistant placeholder was ALSO filtered out → if the Alert was dismissed quickly or missed, the user saw silence.
- Generic stream failure (timeout / network blip / RLS): if `err.message` came through empty, both surfaces hid → silence.

Q-D therefore splits into:

- **Q-D1 (this branch, silent-failure guard + diagnostics):** stop dropping the assistant placeholder on error; fill it with a localized fallback so the user always sees that their turn happened. Always set a non-empty `error` string so the banner renders. Add Sentry tags for `chatTurnMode` + `errorName` + extra `errorMessage` so the underlying root cause is observable next time. Pure mobile-side fix; no edge-function changes.
- **Q-D2 (follows, refine parity):** full multi-item lock + Refine button + `locked_slots[]` request payload + refine-mode hint. Waits until Q-D1 lands and we confirm assistant messages reliably render.

### Q-D1 — Silent-failure guard

**Files touched:**
- `mobile/src/hooks/useStyleChat.ts` — `onError` keeps the assistant placeholder with a localized fallback content, always surfaces a non-empty error string, emits Sentry tags for diagnosis.
- `mobile/src/i18n/locales/en.ts` + `sv.ts` — three new keys appended (`chat.error.generic`, `chat.error.inlineFallback`, `chat.error.inlineFallback.premium`). Append-only.

**Acceptance:**
- A stream error never leaves the user staring at silence — the failed assistant bubble shows a fallback explanation, AND the inline banner renders with a non-empty error message AND the Retry pill works to re-fire the turn.
- Paywall failures keep their existing premium Alert flow but the inline bubble now carries premium-flavoured copy so the user knows it's a gate, not a bug.
- Sentry captures `errorName` and `chatTurnMode` tags + `errorMessage` extra on every non-paywall failure so the underlying root cause is observable.
- No regression to the success path: a normal turn still streams text + outfit card exactly as before.

### Q-D2 — Refine parity (deferred)

### Q-D2 bugs (out of scope for Q-D1)

**D-2 (parity):** Once Q-D1 lands, mobile `OutfitSuggestionCard.tsx:66-197` still lacks:
- Multi-item lock UI (per-tile lock badge in refine mode). Web `src/components/chat/OutfitSuggestionCard.tsx:199-212`.
- "Refine" CTA alongside Try / Save. Web `src/components/chat/OutfitSuggestionCard.tsx:328-336`.
- Refine-mode hint Caption ("Tap garments to lock them"). Web `src/components/chat/OutfitSuggestionCard.tsx:388-405`.
- `locked_slots[]` in the edge request. Mobile `useStyleChat.stream.ts:40-59` only emits `selected_garment_ids` (single anchor) — `style_chat` already accepts `locked_slots`; mobile just never sends it.

### Fix

**Step 1 — Diagnose D-1.** Add a temporary `console.log` to the message-render pipeline (`StyleChatScreen.messageItem.tsx:51-172` and `useStyleChat.stream.ts` envelope ingestion) and reproduce on EAS dev build. Read the actual envelope payload. Remove the log once root cause is known. **Do not patch blindly** — verify whether (a) the stream is closing before completion, (b) the assistant message is filtered out by a `role` check, (c) the envelope's `render_outfit_card` flag is missing, or (d) MessageItem render gate `showOutfitCard = !isUser && outfitGarmentIds.length > 0` short-circuits because `outfitGarmentIds` is empty.

**Step 2 — D-1 fix.** Smallest viable patch for the diagnosed root cause. Likely candidate areas: envelope parser, message persistence to chat state, MessageItem render gate.

**Step 3 — D-2 refine parity.** State machine in `StyleChatScreen.tsx`:
```ts
const [refineMode, setRefineMode] = useState<{ messageId: string; lockedIds: Set<string> } | null>(null);
```

`OutfitSuggestionCard` new props: `isRefining: boolean`, `lockedIds: Set<string>`, `onToggleLock: (id: string) => void`, `onEnterRefine: () => void`, `onSubmitRefine: () => void`.

Per-tile overlay (lock pill) when `isRefining`, tap toggles inclusion in `lockedIds`.

Refine button row layout — `Try | Refine | Save` when not in refine mode; `Cancel | Submit refine` when in refine mode. Submit re-invokes the chat send with the locked set.

`useStyleChat.stream.ts:buildRequestBody` — accept new `lockedSlots?: string[]` param, include in payload as `locked_slots` when non-empty.

Replace long-press single-anchor flow with multi-item lock as the primary interaction. Long-press behaviour stays as a quick shortcut: "lock only this garment + enter refine mode" (preserves the existing muscle memory).

### Files touched

#### Modified
- `mobile/src/screens/StyleChatScreen.tsx` — refine-mode state + handlers, wire to `OutfitSuggestionCard`
- `mobile/src/screens/StyleChatScreen.messageItem.tsx` — pass refine props through
- `mobile/src/components/chat/OutfitSuggestionCard.tsx` — lock badges, Refine button, hint Caption, new props
- `mobile/src/hooks/useStyleChat.stream.ts` — `lockedSlots` param, `locked_slots` in payload
- `mobile/src/i18n/locales/en.ts` + `sv.ts` — new keys for Refine / "Tap to lock" / Cancel-refine / Submit-refine (append only)

#### New
None expected. Lock badge is an in-card overlay, not a new primitive.

### Acceptance

- D-1: assistant outfit messages render reliably — explanation text + card + 4 garment thumbnails — on EAS dev build, on three back-to-back generations.
- D-2.1: tapping "Refine" enters refine mode; refine-mode hint appears.
- D-2.2: tapping a garment tile toggles a lock badge; multiple tiles can be locked simultaneously.
- D-2.3: submitting refine sends `locked_slots: [id, id, …]` in the `style_chat` request body (verifiable via dev-server proxy log or temporary console.log on the request).
- D-2.4: the regenerated outfit keeps locked items and swaps the rest.
- D-2.5: long-press still works as a shortcut: locks the long-pressed item + auto-enters refine mode.

### Gates
TS · ESLint · expo-doctor · expo export · manual EAS-dev verification (Vision Camera / stream behaviour can't be tested in Expo Go and tsc/eslint won't catch a streaming regression).

### Out of scope
- No new edge function. `style_chat` already accepts `locked_slots` — verify shape via reading `supabase/functions/style_chat/index.ts` before submitting.
- No anchor-from-wardrobe-screen changes (parity-D already wired wardrobe→chat anchor push).

---

## Q-B · Plan/Generate flow — kill intermediate result page, date-aware planning

### Bugs
- `mobile/src/screens/OutfitGenerateScreen.tsx:609-636` renders four placeholder colored squares with `PLACEHOLDER_HUES` — no garment images. Original W9 wave that was supposed to wire real images never shipped.
- `mobile/src/screens/PlanScreen.tsx:458` "Create Outfit" navigates `nav.navigate('OutfitGenerate')` with no date param — the selected Plan date is lost.
- `OutfitGenerateScreen.tsx:320-350` "Wear today" handler always calls `markWorn` for today via `navigateToWornOutfit` — no date is plumbed through.
- No date-picker UI exists anywhere on mobile. Web `src/pages/Plan.tsx:62-66` has `PlanningSheet` / `QuickPlanSheet` / `PreselectDateSheet`. Web `src/pages/OutfitGenerate.tsx:360-368` navigates to `OutfitDetail` with `state: { openPlanner: true }` for the plan flow.

### Fix

**B-1 — Remove the placeholder result UI.** Delete the four-hue grid block (`OutfitGenerateScreen.tsx:609-636`) and the surrounding result page entirely. After `persistOutfit.mutate` resolves with `{ outfitId }`, immediately `nav.replace('OutfitDetail', { id: outfitId, openPlanner: true, preselectDate })`. The user lands on the real outfit card with images.

**B-2 — Thread `initialDate` from Plan to Generate.** `PlanScreen.tsx:458`:
```ts
<Button
  label={tr('plan.empty.cta')}
  onPress={() => nav.navigate('OutfitGenerate', { initialDate: selectedDate.toISOString() })}
  block
/>
```
Add `initialDate?: string` to `OutfitGenerate` route params in `RootNavigator.tsx`. Read it in `OutfitGenerateScreen`, pass through as `preselectDate` to the `OutfitDetail` navigation on submit.

**B-3 — `PlannerSheet` component (new).** Bottom-sheet modal with:
- Date picker (use `@react-native-community/datetimepicker` if already in deps; otherwise a minimal week-strip picker matching the visual language of `ThisWeekSection`)
- "Wear today" quick-select button
- "Save without planning" secondary action
- Confirm button — writes to `planned_outfits` for the chosen date; if date === today, also fires `markWorn`

**B-4 — OutfitDetail auto-mount sheet.** Read `route.params.openPlanner` (boolean) and `route.params.preselectDate` (ISO string). When `openPlanner === true`, mount `PlannerSheet` open on first render. Sheet dismiss clears the param so back-nav doesn't re-open it.

**B-5 — `planForDate` mutation.** If `usePlannedOutfits.ts` doesn't already export a mutation for `(outfitId, date) → upsert planned_outfits row`, add one mirroring the web equivalent. Single Supabase `.upsert({ user_id, outfit_id, planned_date }, { onConflict: 'user_id,planned_date' })`.

### Files touched

#### Modified
- `mobile/src/screens/OutfitGenerateScreen.tsx` — delete placeholder result UI, rewire submit→detail navigation, accept `initialDate` route param, pass `preselectDate` through
- `mobile/src/screens/PlanScreen.tsx` — pass `initialDate` when navigating to OutfitGenerate
- `mobile/src/screens/OutfitDetailScreen.tsx` — read `openPlanner` + `preselectDate` route params, mount `PlannerSheet` open
- `mobile/src/navigation/RootNavigator.tsx` — route param types for `OutfitGenerate.initialDate` + `OutfitDetail.openPlanner` + `OutfitDetail.preselectDate`
- `mobile/src/hooks/usePlannedOutfits.ts` — add `usePlanOutfitForDate` mutation if not present
- `mobile/src/i18n/locales/en.ts` + `sv.ts` — keys for planner sheet titles, actions, hints (append only)

#### New
- `mobile/src/components/PlannerSheet.tsx` — new bottom-sheet primitive (modal + Animated + date picker + actions)

### Acceptance

- Generating an outfit from a tab (StyleMe / Home StyleChat / Plan empty state) persists the outfit and lands the user on `OutfitDetail` with the `PlannerSheet` open.
- From Plan empty state: the sheet's date defaults to the Plan-screen-selected date.
- From elsewhere: the sheet's date defaults to today.
- Tapping "Wear today" in the sheet writes today's `planned_outfits` row AND marks the outfit worn (existing `markWorn` mutation) AND dismisses the sheet.
- Tapping a future date and confirming writes a `planned_outfits` row for that date; outfit is NOT marked worn.
- The placeholder-hue result page no longer appears anywhere.
- TodaysLookHero "Wear today" path is unchanged (already correctly today-only for the hero on Home).

### Gates
TS · ESLint · expo-doctor · expo export · manual flow check on EAS dev build.

### Out of scope
- No web-side changes.
- No new edge function.
- No changes to `markWorn` / `useMarkOutfitWorn` semantics — Q-B only adds date-aware *planning*, not date-aware wearing.

---

## Q-C · Wardrobe filters — server counts + personal flags (split into Q-C1 + Q-C2)

### Bugs (covers both sub-PRs)

`mobile/src/screens/WardrobeScreen.tsx:310-339` renders six `SmartTile` chips:

| Chip | Current state |
|---|---|
| Recently Added | `fmtCount(totalCount)` — falls to `"—"` when `hasNextPage` (paginated wardrobes) |
| Most Worn | `fmtCount(garments.filter(g => (g.wear_count ?? 0) > 3).length)` — same `"—"` collapse on paginated data |
| Unworn this season | `fmtCount(garments.filter(g => !g.last_worn_at).length)` — same collapse |
| In Laundry | hard-coded `num="—"` |
| Wishlist | hard-coded `num="—"`, tap shows "coming soon" toast |
| Gaps | hard-coded `num="—"`, navigates to `WardrobeGapsScreen` (already working) |

Three (Recently / Most / Unworn) need server-counted hooks; three (Lingerie / Wishlist / In Laundry) need new schema columns + backend wiring. Lingerie is mentioned in the user's list but does not currently exist as a chip in the rendered UI (the visible six are Recently / Most / Unworn / Laundry / Wishlist / Gaps). Q-C2 adds Lingerie as a new tile and the matching `is_lingerie` flag.

### Q-C1 · Server-counted Recently / Most Worn / Rarely Worn (code-only)

**Fix:**

- Port web's `useSmartFilterCounts` hook (`src/hooks/useGarments.ts:451-463`) to mobile. Three Supabase queries with `{ head: true, count: 'exact' }` for the three predicates:
  - Recently Added: total garments (or restrict to `created_at > now - 30d` if web does)
  - Most Worn: `wear_count > 0`
  - Rarely Worn: `last_worn_at IS NULL OR last_worn_at < now - 30 days` (`RARELY_WORN_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000`)
- Rename "Unworn this season" → "Rarely Worn" for web parity. **`mobile/src/i18n/locales/*` is append-only** per CLAUDE.md — add new key `wardrobe.smartFilter.rarelyWorn` and switch the JSX to read it; leave the old key intact.
- Wire each chip's `onPress` to a filtered-list view. Add new screen `WardrobeFilteredListScreen` accepting `route.params.filter: 'recently' | 'mostWorn' | 'rarelyWorn'` that renders a sorted `useGarments` query result with the same predicate.

**Files touched (Q-C1):**

#### Modified
- `mobile/src/screens/WardrobeScreen.tsx` — replace client-side filter counts with `useSmartFilterCounts` reads, wire onPress
- `mobile/src/i18n/locales/en.ts` + `sv.ts` — append keys for "Rarely Worn", filter-list titles
- `mobile/src/navigation/RootNavigator.tsx` — new route type for `WardrobeFilteredList`

#### New
- `mobile/src/hooks/useSmartFilterCounts.ts` — server-counted counts hook (ported from web pattern)
- `mobile/src/screens/WardrobeFilteredListScreen.tsx` — read-only filtered garment list screen

### Q-C2 · Personal flags schema + Lingerie / Wishlist / In Laundry wiring

**Fix:**

**Migration** (one file):

```sql
-- supabase/migrations/<ts>_garment_personal_flags.sql
alter table public.garments
  add column if not exists is_lingerie boolean not null default false,
  add column if not exists is_wishlist boolean not null default false,
  add column if not exists is_in_laundry boolean not null default false;

create index if not exists idx_garments_user_lingerie
  on public.garments (user_id) where is_lingerie;
create index if not exists idx_garments_user_wishlist
  on public.garments (user_id) where is_wishlist;
create index if not exists idx_garments_user_laundry
  on public.garments (user_id) where is_in_laundry;
```

Partial indexes — each flag is true on a small subset of rows.

**Per CLAUDE.md migration discipline + 2026-05-11 standing rule:** the migration file is committed in the same PR as the consuming code. **Claude runs `npx supabase db push --linked --yes` from `main` after the PR merges.** No `apply_migration` via MCP. Timestamp in the filename is set at commit time (the canonical `YYYYMMDDHHMMSS` of the commit moment).

**Code wiring:**

- Extend `useSmartFilterCounts` (from Q-C1) with three more queries: `is_lingerie = true`, `is_wishlist = true`, `is_in_laundry = true`.
- Add a new "Lingerie" tile to `WardrobeScreen.tsx` smart-tile row (sits before / after "Wishlist" — decide on visual ordering at implementation time, after a quick visual check on device).
- Replace `num="—"` hard-codes for Wishlist + In Laundry + Lingerie with real counts from the new hook.
- Wire each chip's onPress to `WardrobeFilteredListScreen` with the appropriate filter key.
- `GarmentDetailScreen.tsx` — add three toggles (Lingerie / Wishlist / In Laundry) to the edit form so the user can flip the flags. Use existing `SettingsRow` primitive with a right-aligned switch.
- `useUpdateGarment.ts` — accept the three new optional fields in the mutation input.
- `WardrobeFilteredListScreen` — extend its `filter` enum with `'lingerie' | 'wishlist' | 'laundry'`.

**Files touched (Q-C2):**

#### Modified
- `mobile/src/screens/WardrobeScreen.tsx` — add Lingerie tile, switch three counts from `"—"` to real, wire onPress
- `mobile/src/hooks/useSmartFilterCounts.ts` — three more server-count queries
- `mobile/src/screens/GarmentDetailScreen.tsx` — three new toggles in edit form
- `mobile/src/hooks/useUpdateGarment.ts` — pass-through for new fields
- `mobile/src/screens/WardrobeFilteredListScreen.tsx` — three new filter cases
- `mobile/src/i18n/locales/en.ts` + `sv.ts` — append keys for new toggles, tile labels, filter-list titles

#### New
- `supabase/migrations/<ts>_garment_personal_flags.sql` — schema migration

### Acceptance

**Q-C1:**
- All three of Recently Added / Most Worn / Rarely Worn chips show real counts on wardrobes of any size (no `"—"` collapse).
- Tapping a chip opens a filtered list of garments matching that predicate.
- Web behaviour unchanged.

**Q-C2:**
- Migration applied cleanly via `npx supabase db push --linked --yes` (Claude runs this from `main` after merge — see 2026-05-11 standing rule).
- Garment Detail edit form has three new toggles; saving the form persists the flags.
- Wardrobe screen shows real counts for Lingerie / Wishlist / In Laundry.
- Tapping each chip opens the corresponding filtered list.
- No regression on existing wardrobe flows (add garment, edit garment, browse).

### Gates (per Q-C sub-PR)

TS · ESLint · expo-doctor · expo export. Q-C2 additionally: `npx supabase migration list --linked` clean before commit, and the migration file is present in the same PR diff.

### Out of scope
- No web UI for the three new flags (web doesn't expose these filters; this is mobile-only feature extension, which is fine — flags are additive and don't break web reads).
- No bulk-edit UI for the flags. Per-garment toggles only.
- No "In Laundry → auto-clear after N days" automation. The flag is manually set + cleared.
- No notifications when items linger in laundry. Future wave.

---

## Per-PR review loop (all four)

Per the standing CEO post-launch theme-PR authority and the Codex 👍 / "no bugs" merge gate:

1. Implement → local gates green (TS · ESLint `"src/**/*.{ts,tsx}"` `--max-warnings 0` · expo-doctor · expo export)
2. Run code-reviewer subagent on the diff using the verbatim brief from `mobile/CLAUDE.md`
3. Push branch, open PR targeting `main` (PR title prefix `fix(mobile): parity-Q-{A|B|C1|C2|D}`)
4. Wait for Codex 👀 → loop fix→re-ping with bare `@codex` until 👍 or "no bugs found"
5. Run a self-review pass on the diff with fresh eyes; fix anything found; re-scan until a full pass finds nothing
6. **Mandatory 2nd review pass** — re-run code-reviewer subagent after Codex gate is met
7. Merge if clean
8. For Q-C2: after merge, Claude switches to `main`, pulls, and runs `npx supabase db push --linked --yes`; verifies with `npx supabase migration list --linked`
9. Update tracker (`docs/launch/overview.md` CURRENT WAVE pointer) and `docs/launch/completion-log.md`
10. Continue to next theme

## Anti-patterns

- Don't ship Q-D step 2-3 (refine parity) before Q-D step 1 (render diagnosis) is fixed and verified — patching refine UI on top of a still-broken render pipeline guarantees rework.
- Don't widen `OutfitCard` props or refactor it during Q-A — just pass `garments`.
- Don't add a "remove from laundry after N days" flow in Q-C2 — flags are user-managed.
- Don't `apply_migration` via MCP in Q-C2 — write the file, commit it; Claude runs `db push` from `main` after merge (2026-05-11 standing rule).
- Don't rename or remove the legacy `'wardrobe.unwornThisSeason.*'` i18n keys in Q-C1 — locale files are append-only per CLAUDE.md.
- Don't add Lingerie / Wishlist / In Laundry to web — out of scope.
- Don't combine PRs to save round-trips. Four (five with Q-C split) themed PRs sequentially.

## Out of scope (track for future Q+1 wave)

- Plan calendar's full month-view date-picker UX (Q-B uses a single sheet with a date picker; a richer calendar view is a separate wave).
- Outfit-detail planner-history (showing "planned for: Jun 4, 11, 18" on the outfit card itself) — additive.
- Wardrobe smart-filter sort options inside the filtered list (always sort by `last_worn_at desc` for Most Worn etc. in Q-C; configurable sort is a polish PR).
- A "Mark all laundry clean" bulk action — future flow.
- Web-side parity for Lingerie / Wishlist / In Laundry flags — open question for product, not this wave.
