## Wave 8.5 — Style Memory Bridge

Wave 8.5 fixes and unifies the existing BURS style memory system so outfit generation becomes more personalized and consistent across the app.

**Scope cap**
- Do NOT build a full Obsidian/knowledge-graph system in this wave.
- Do NOT build a pgvector/embedding system in this wave unless absolutely necessary.
- The current problem is NOT missing data — it is inconsistent signal names, weak ingestion, incomplete pair memory writing, no central persistent style summary, and incomplete privacy/export/reset for memory.

**Constraints (apply to every prompt in this wave)**
- Do not rewrite the whole app.
- Do not change existing product flows unless necessary.
- Do not break existing Supabase contracts.
- Do not remove current AI/style logic.
- Do not edit Supabase functions in the dashboard. All backend changes must be migrations and Edge Function/shared code changes.
- Preserve existing outfit completeness rules: separates require top + bottom + shoes; dress-led outfits require dress + shoes; outerwear is weather/context driven.
- Preserve existing tabs and user flows.

**Main objective**: a "BURS Style Memory Bridge" that does 4 things — (1) standardizes all memory/feedback signal names, (2) ensures save/wear/rate/skip/swap/reject events actually update feedback and pair memory, (3) creates and maintains a persistent `user_style_summaries` table, (4) makes both `burs_style_engine` and `style_chat` read the same summary before generating outfits.

---

### P82 — Audit current style memory wiring [DONE] (PR #708, 2026-04-29)

**Problem**
Before changing memory infrastructure, we need a precise picture of where signals are written, where they are read, where pair memory is updated, and which flows are missing the write. Skipping the audit risks duplicating systems and leaving silent gaps.

**Fix**
Search the repo for the memory surfaces and produce a written audit. No code changes in this prompt — output is the implementation note that subsequent prompts execute against.

Search terms:
- `feedback_signals`
- `garment_pair_memory`
- `wear_logs`
- `record_pair`
- pair memory
- `styleProfile`
- `style_chat`
- `burs_style_engine`
- `planned_skip`
- `swap_choice`
- `planned_follow_through`
- outfit feedback
- `SettingsPrivacy`
- `export`
- `delete_user_account`

For each search-result group, note:
- Where feedback signals are created
- Where they are consumed
- Where pair memory is written
- Where pair memory is read
- Where user profile / style preferences are read
- Which flows currently DO NOT update memory correctly

The audit lives in the PR body as the "Implementation note" section. Subsequent prompts cite it directly.

**Files**
- Audit doc only — no source changes in this prompt.

**Acceptance**
- PR body has a structured Implementation note covering all 6 categories above.
- The note names specific files + line numbers (or function names) for each category.

**Deploy** None.

---

### P83 — Standardize signal taxonomy [DONE] (PR #709, 2026-05-01)

**Problem**
Existing memory/feedback signals have inconsistent names across writers and readers (`swap_choice` vs `swap_garment`, `planned_skip` vs `skip_outfit`, `wear_confirm` vs `wear_outfit`, etc.). Readers only see partial coverage of any given signal because each writer uses a different name.

**Fix**
Create `supabase/functions/_shared/style-memory-signals.ts` (if it does not already exist). Define the canonical signal name union:

```typescript
export type CanonicalStyleMemorySignal =
  | 'save_outfit'
  | 'unsave_outfit'
  | 'rate_outfit'
  | 'wear_outfit'
  | 'skip_outfit'
  | 'reject_outfit'
  | 'swap_garment'
  | 'quick_reaction'
  | 'never_suggest_garment'
  | 'like_pair'
  | 'dislike_pair';
```

Plus a normalization helper:

```typescript
export function normalizeStyleMemorySignal(input: string): CanonicalStyleMemorySignal | null {
  // Map legacy/existing signals to canonical; return null on unknown.
  // - swap_choice            -> swap_garment
  // - planned_skip           -> skip_outfit
  // - planned_follow_through -> wear_outfit
  // - wear_confirm           -> wear_outfit
  // - save / saved           -> save_outfit
  // - reject / dislike / thumbs_down -> reject_outfit
  // - ignore                 -> skip_outfit
  // - like                   -> quick_reaction
  // - quick_reaction         -> quick_reaction (passthrough)
  // - every canonical name passthroughs.
}
```

Do NOT break existing stored values. Normalize at read/write boundaries (the helper). Pre-existing rows with legacy signal names stay valid; readers run them through the helper before comparing.

**Files**
- `supabase/functions/_shared/style-memory-signals.ts` (new — or extend if the audit found one)

**Acceptance**
- All 11 canonical names exported.
- Helper maps every legacy name listed above.
- Unknown inputs return `null` (caller decides whether to drop or log).

**Deploy** None (shared module — consumer functions deploy in P85+).

---

### P84 — Persistent user_style_summaries table [DONE] (PR #709, 2026-05-01)

**Problem**
There is no central persistent style summary. Each AI function re-derives a summary on the fly (when at all) — inconsistent, expensive, and doesn't capture cross-session signals.

**Fix**
New migration `<ts>_user_style_summaries.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.user_style_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_json jsonb not null default '{}'::jsonb,
  summary_text text,
  confidence numeric default 0,
  version integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_style_summaries_user_id
  ON public.user_style_summaries (user_id);
CREATE INDEX IF NOT EXISTS idx_user_style_summaries_updated_at
  ON public.user_style_summaries (updated_at);

ALTER TABLE public.user_style_summaries ENABLE ROW LEVEL SECURITY;

-- Users can read their own summary
CREATE POLICY "users_select_own_style_summary"
  ON public.user_style_summaries FOR SELECT
  USING (user_id = auth.uid());

-- Service role can manage summaries (writes happen from edge functions)
CREATE POLICY "service_role_all_style_summary"
  ON public.user_style_summaries FOR ALL
  TO service_role USING (true) WITH CHECK (true);
```

`summary_json` shape (documented in code; stored as untyped JSONB so future fields don't break existing rows):
- `preferred_colors`, `avoided_colors` — arrays
- `preferred_fits`, `avoided_fits` — arrays
- `style_archetypes` — array
- `formality_center` — number 0-100
- `frequent_occasions` — array
- `favorite_pairings`, `avoided_pairings` — arrays of `{a: garment_id, b: garment_id, weight: number}`
- `avoid_rules` — array of strings
- `weather_preferences` — object keyed by weather state
- `confidence_by_category` — object keyed by category

Do NOT allow arbitrary frontend writes unless the current project pattern already allows it safely.

**Files**
- new migration `supabase/migrations/<ts>_user_style_summaries.sql`

**Acceptance**
- `npx supabase db push --dry-run` reports the new migration only.
- Authenticated user can `SELECT` their own row; cross-user `SELECT` returns nothing.
- Service-role write/read works.

**Deploy** Post-merge: `npx supabase db push --linked --yes`.

---

### P85 — Memory ingestion helper [DONE] (PR #709, 2026-05-01)

**Problem**
With canonical signals (P83) and a summary table (P84) in place, we need ONE function that all flows funnel through. Otherwise each writer re-implements normalization + pair-memory updates + summary refresh.

**Fix**
Create or update an Edge Function/shared helper called `memory_ingest`. If `record_pair` (or any equivalent function found in the P82 audit) already exists, REUSE it or refactor it safely instead of duplicating logic. If a better existing function is already a near-fit, extend that instead of adding unnecessary new functions.

Inputs:
- `user_id` (verified via JWT in edge function path)
- `event_type` — string, normalized via `normalizeStyleMemorySignal`
- `outfit_id?`, `garment_ids?`, `removed_garment_ids?`, `added_garment_ids?`
- `rating?`, `feedback_text?`
- `context?` jsonb
- `source?`

Behavior:
1. Normalize `event_type` using `normalizeStyleMemorySignal` (drop event with logged warning if unmapped).
2. Insert/update `feedback_signals` with the canonical signal name when appropriate.
3. Write `wear_logs` when canonical event is `wear_outfit` and existing app flow does NOT already do it (verify against the P82 audit).
4. Update `garment_pair_memory`:
   - Positive weight: `save_outfit`, `wear_outfit`, high `rate_outfit` (≥4), `like_pair`.
   - Negative weight: `reject_outfit`, `skip_outfit`, `dislike_pair`, `never_suggest_garment`.
   - `swap_garment`: reduce weight for removed-garment pairings; optionally increase for added-garment pairings.
5. Update or refresh `user_style_summaries` (calls the deterministic builder in P87).
6. Idempotent where possible to avoid double-counting the same event.
7. Cross-user write protection: every write matches `user_id` from the verified caller; never allow one user to write memory for another user.

**Files**
- new or extended `supabase/functions/memory_ingest/index.ts` OR `supabase/functions/_shared/style-memory-ingest.ts` (depending on audit findings)
- shared module imports in callers (wired up in P86)

**Acceptance**
- Calling with `event_type: 'swap_choice'` writes a `feedback_signals` row whose canonical signal is `swap_garment`.
- Repeat call within the idempotency window writes a single row.
- Cross-user write attempt (`user_id` mismatch with JWT) returns 403.

**Deploy** New `memory_ingest` function (if function path chosen). No deploy if shared-helper-only — consumers redeploy in P86.

---

### P86 — Pair memory auto-write across all flows [DONE-partial] (PR #712, 2026-05-02 — top 3 high-volume save surfaces wired; deferred sub-surfaces tracked in CLAUDE.md Findings Log)

**Problem**
Per the P82 audit, several user flows do not reliably update memory. Frontend-only state changes get lost on reload; backend updates miss when feedback only flows through frontend.

**Fix**
Wire each of these flows into the memory ingestion path (P85). Memory updates must reach Supabase — do not rely only on frontend local state.

User flows that must update memory:
- Save outfit → `save_outfit`
- Unsave outfit → `unsave_outfit`
- Rate outfit (rating ≥1) → `rate_outfit`
- Mark outfit as worn → `wear_outfit`
- Skip planned outfit → `skip_outfit`
- Follow through with planned outfit → `wear_outfit`
- Swap garment → `swap_garment` (with `removed_garment_ids` + `added_garment_ids`)
- Reject outfit → `reject_outfit`
- Quick reaction → `quick_reaction`
- "Never suggest this" if it exists → `never_suggest_garment`

For each flow, add a unit test that asserts the memory write happens (mock the ingest call; assert call args).

**Files**
- frontend handlers identified in P82 audit (likely under `src/hooks/`, `src/pages/AIChat.tsx`, `src/pages/Plan.tsx`, `src/components/outfit/`)
- shared backend hooks if any flow calls a server-side mutation directly

**Acceptance**
- Audit-listed flows each have a test asserting the memory write happens.
- Manual smoke: save → wear → swap, then `feedback_signals` shows rows with canonical names.

**Deploy** Frontend changes auto-deploy. Backend changes redeploy whichever functions changed.

---

### P87 — Deterministic user style summary builder [DONE] (PR #709, 2026-05-01)

**Problem**
We need a summary that's reproducible from data, not opaque AI inference. Gemini-based summaries drift between calls and aren't auditable. Deterministic = same inputs always produce the same summary. Do NOT use Gemini for summary unless already established and safe.

**Fix**
Implement a deterministic summary builder.

Inputs:
- profile preferences
- garments
- outfits ratings/feedback
- wear_logs
- feedback_signals
- garment_pair_memory
- planned_outfits follow-through/skip behavior

Inferences (each with a confidence score):
- preferred colors from worn/saved/high-rated garments
- avoided colors from rejected/low-rated/skipped garments
- preferred fits / avoided fits
- favorite categories / underused categories
- favorite pairings / avoided pairings
- preferred formality level (mean of worn/saved formality scores)
- frequent contexts/occasions
- avoid rules from repeated negative behavior

Confidence rules:
- explicit feedback > repeated behavior > single event > AI inference
- do not overfit from one action — minimum N=3 occurrences before promoting to "preferred" / "avoided"

Output `summary_text` is compact and safe to inject into AI prompts (≤500 chars target). Example:

> "User prefers minimalist smart-casual outfits in black, grey and beige. They tend to avoid skinny fits and loud colors. Loafers work well for dinner contexts. Outerwear should be included under cold/rainy conditions."

**Files**
- new shared helper `supabase/functions/_shared/style-summary-builder.ts`
- the helper is called by P85's `memory_ingest` to refresh `user_style_summaries`

**Acceptance**
- Same inputs always produce identical `summary_json` + `summary_text`.
- One single negative event does NOT push a category into `avoided_*`.
- Three consistent negative events on the same color DO push it into `avoided_colors` with confidence ≥0.5.

**Deploy** Whichever functions consume the builder (likely just `memory_ingest` post-P85).

---

### P88 — burs_style_engine reads user_style_summaries [DONE] (PR #712, 2026-05-02)

**Problem**
The outfit-generation engine doesn't currently use a persistent summary. It re-derives style context per request. This is expensive and inconsistent across calls.

**Fix**
Update `supabase/functions/burs_style_engine/index.ts` so before outfit generation/scoring it loads the user's `user_style_summaries` row.

Use the summary in the internal style context/scoring (NOT just in the prompt text):
- Boost scoring for preferred colors / fits / archetypes.
- Penalize avoided colors / fits.
- Boost proven favorite pairings (using `garment_pair_memory` + summary's `favorite_pairings`).
- Penalize avoided pairings.
- Respect `avoid_rules` (hard skip, not just soft penalty).
- Improve occasion/context matching.

Hard rules the summary CANNOT override:
- Outfit completeness: separates require top + bottom + shoes; dress-led requires dress + shoes; outerwear is weather/context driven.
- Low-confidence (<0.3) memories: log + ignore.

Do not blindly obey low-confidence memories. Cache the summary read per-request so repeated calls within one request don't re-fetch.

**Files**
- `supabase/functions/burs_style_engine/index.ts`
- `supabase/functions/_shared/outfit-scoring.ts` (if scoring lives there — confirm via grep)

**Acceptance**
- Generation log shows the loaded summary's `version` + `confidence`.
- Outfit scoring respects `avoid_rules` (test: user with `avoid: skinny_jeans` rule never gets skinny jeans in suggestions).
- No regression in completeness — every generated outfit still has the required slots.

**Deploy** `burs_style_engine`.

---

### P89 — style_chat reads the same summary [DONE] (PR #712, 2026-05-02)

**Problem**
The stylist chat doesn't share the same memory surface as outfit generation. User preferences expressed in chat ("never suggest this") don't reach outfit generation; preferences inferred from outfit generation don't surface in chat advice.

**Fix**
Update `supabase/functions/style_chat/index.ts` so the stylist chat:
- Loads `user_style_summaries` at the top of each chat turn (same loader as P88's engine).
- Uses the summary as durable taste memory in the system prompt.
- Updates memory when the user says clear preferences:
  - "I hate skinny jeans" → `dislike_pair` or `avoid_rules` entry
  - "never suggest this" → `never_suggest_garment` (for the focused garment)
  - "more like this" → `like_pair` for the displayed pairings
  - "too formal" / "too basic" → low-confidence preference shift on formality
- Avoid storing random one-off chat text as permanent truth unless confidence is clear.
- Write normalized feedback / memory events when the user rejects, swaps, or asks for changes via chat.

**Files**
- `supabase/functions/style_chat/index.ts`
- shared system-prompt builder if one exists

**Acceptance**
- Chat preferences explicitly stated ("I hate X") create a `feedback_signals` + summary update.
- Chat-derived preferences influence subsequent outfit generation.
- Outfit-derived preferences influence chat advice.

**Deploy** `style_chat`.

---

### P90 — Privacy / export / reset for memory [DONE] (PR #712, 2026-05-02)

**Problem**
Existing privacy export + delete flows predate `user_style_summaries` and don't include the new memory surface. Users can't see what BURS knows about them, and deleting an account leaves orphan memory rows.

**Fix**
Update `SettingsPrivacy` (or relevant privacy/data export code) so the export includes:
- profile
- garments
- outfits
- planned_outfits
- wear_logs
- feedback_signals
- garment_pair_memory
- user_style_summaries
- chat_messages (if already part of user data)
- any other memory/personalization tables surfaced by P82's audit

Add or wire a "Reset style memory" backend path if missing. Reset clears:
- feedback_signals
- garment_pair_memory
- user_style_summaries
- style-related inferred memory

Reset does NOT delete (unless existing UX explicitly says it will):
- garments
- outfits
- account

`delete_user_account` must include `user_style_summaries` cleanup + any new memory tables in its cascade.

**Files**
- `src/pages/settings/SettingsPrivacy.tsx` (or equivalent)
- `supabase/functions/delete_user_account/index.ts`
- new edge function `supabase/functions/reset_style_memory/index.ts` (if not already wired)
- export endpoint code (likely client-side build of a JSON download)

**Acceptance**
- Export download includes every table listed above.
- Reset style memory wipes those four tables for the calling user without touching wardrobe/outfits/account.
- Post-`delete_user_account` cascade: zero orphan rows in `user_style_summaries`.

**Deploy** `delete_user_account` + new `reset_style_memory` (if added).

---

### P91 — Memory bridge tests [DONE-partial] (PR #712, 2026-05-02 — extraction matrix + foundation tests + 11 hook tests + audit-driven test fixtures shipped; full N=3 + race + cross-user 403 + delete-cascade integration matrix deferred to follow-up PR)

**Problem**
The bridge has many moving parts. Without tests, regressions creep in silently.

**Fix**
Add or update tests for:

1. `normalizeStyleMemorySignal`:
   - Maps every legacy signal correctly (one assertion per legacy → canonical pair).
   - Unknown values return null (do not crash).
   - All 11 canonical names passthrough.
2. Memory ingestion (`memory_ingest` or shared helper):
   - `save_outfit` creates positive pair memory.
   - `wear_outfit` creates positive pair memory and/or wear log.
   - `skip_outfit` / `reject_outfit` creates negative signal.
   - `swap_garment` handles `removed_garment_ids` and `added_garment_ids` correctly.
   - Cross-user writes blocked (403 / null).
   - Idempotency prevents double-counting within the configured window.
3. `user_style_summaries`:
   - Summary updates after repeated saved/worn behavior.
   - Single event does NOT create overconfident summary.
   - Avoided fits / colors appear after repeated (≥3) negative feedback.
4. `burs_style_engine`:
   - Reads `user_style_summaries`.
   - Respects `avoid_rules`.
   - Does not break outfit completeness.
5. `style_chat`:
   - Reads `user_style_summaries`.
   - Clear user preference statement creates/updates a memory event.
6. Privacy:
   - Export includes all memory tables.
   - Reset style memory clears memory but keeps wardrobe/outfits.
   - `delete_user_account` cascade includes new tables.

**Files**
- `supabase/functions/_shared/__tests__/style-memory-signals.test.ts` (new)
- existing function `__tests__/` directories per surface
- frontend test files for Settings + Privacy flows

**Acceptance**
- All 6 categories above have at least one test each.
- `npx vitest run` green; `npm run build` + `npm run lint` + `npm test` (or repo's existing test command) all pass.

**Deploy** None (test-only).

---

### P92 — Wave 8.5 acceptance close-out [DONE-partial] (PR #712, 2026-05-02 — pipeline gate (tsc 0/eslint 0/build 16.31s/vitest 1676/1676) + tracker updates + this PR body include the 7-section summary; full 13-bullet checklist verification deferred to follow-up since several deferred sub-surfaces remain)

**Problem**
Wave-close validation per the spec. The 11-step plan needs a final pass that verifies everything ships together correctly.

**Fix**
Run the full pipeline + grep checks before marking the wave complete:
- `npm run build` passes.
- `npm run lint` passes (or `npx eslint . --max-warnings 0`).
- `npx vitest run` passes (or repo's existing test command).
- `npx supabase migration list --linked` and `db push --dry-run` clean.
- `npx tsc --noEmit --skipLibCheck` zero errors.
- No broken imports.
- No duplicated memory systems (e.g., a parallel "preferences" table doing the same job as `user_style_summaries`).
- No frontend-only memory writes for important events (P82 audit covers this).
- Both `burs_style_engine` and `style_chat` use the same persistent `user_style_summaries`.
- Pair memory is automatically updated by save / wear / rate / skip / swap / reject flows.
- Privacy export includes all memory / personalization data.
- Reset style memory exists or is wired safely.
- PR summary lists ALL changed files across the wave + explains why each was changed.

PR summary output format (per the spec):
1. Brief diagnosis of current memory wiring (from P82 audit, refreshed).
2. List of files changed across the wave.
3. Database migrations added.
4. Exact signal taxonomy implemented.
5. Explanation of how outfit generation now uses memory.
6. Test results.
7. Any remaining risks or follow-up work.

Do not deploy in this prompt. Only verify.

**Files**
- None (close-out is verification-only).

**Acceptance**
- The 13-bullet close-out checklist all green in the PR body.
- The 7-section output format above is filled in.

**Deploy** None (verification only).

---

