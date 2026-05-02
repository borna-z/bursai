# Wave 8.5 PR B — Integration + Wiring (Design)

This is the design document for Wave 8.5 PR B (P86 + P88 + P89 + P90 + P91 + P92).
PR A (Backend Foundation: P83 + P84 + P85 + P87) shipped in PR #709 and is fully
deployed to prod (migration applied, `memory_ingest` v1 deployed, 22 AI functions
redeployed for shared-module fanout).

PR B integrates the foundation: it wires every save/wear/skip/swap/reject/
quick-reaction/never-suggest surface through `memory_ingest`, switches both AI
engines to read `user_style_summaries` exclusively (with lazy materialization on
cache miss per D5), adds chat-driven preference extraction in `style_chat`, and
brings the privacy/export/delete/reset surface up to GDPR parity.

All architectural decisions D1–D5 are LOCKED in
`docs/launch/wave-8.5-p82-audit.md` §11. This document is the operational
implementation design — it does not re-litigate the architecture.

---

## Bundle decision

**One PR.** Tightly coupled: P86 writes canonical signals → P88 + P89 read them
through the summary → P90 exports/deletes the same tables → P91 tests the whole
flow. Splitting creates a half-deployed window where some flows write canonical
names but readers still expect legacy names — which the P83 normalize map
mitigates but does not eliminate. ~2500 LOC is in line with Wave 7 audit-fixes
(PR #688) and the 10-gate workflow (per `feedback-pr-gate-workflow.md` memory)
is built for this size.

Rejection criteria for "split anyway" — none triggered:
- Migration with backfill that needs prod observation before next migration
  ships → no migration in PR B except a small `reset_style_memory_atomic` RPC
  add, which is purely additive
- Shared-module change requiring 22-AI-function fanout → not happening (no
  `_shared/scale-guard.ts` or `_shared/burs-ai.ts` change)
- Independent acceptance criteria where one half can ship and the other cannot
  → no, P88+P89 depend on P86's canonical writes to be useful

---

## Scope summary (per prompt)

### P86 — Wire memory writes across every save/wear/skip/swap/reject surface

Rewrite `useFeedbackSignals` as a thin React Query mutation wrapper around
`supabase.functions.invoke('memory_ingest', ...)`. Replace direct
`from('feedback_signals').insert(...)` writes with edge-function invocations
across all callers. Add 4 new UI surfaces (per D4: quick reaction on Home,
Plan, OutfitGenerate, AIChat) plus garment-level "Never suggest" UI on
GarmentDetail.

Per D2, **no new wear-write paths are added.** `wear_logs` stays the canonical
wear-history surface; the summary builder (P87) projects each row as a
synthetic `wear_outfit` event during summary derivation.

### P88 — `burs_style_engine` reads `user_style_summaries`

Replace the legacy `feedback_signals.limit(200)` read with a single
`user_style_summaries` SELECT, lazy-materialize on cache miss via the
deterministic builder shipped in PR A. Wire the summary into outfit scoring
(boost preferred fields, penalize avoided, hard-skip on `avoid_rules` ≥ 0.7
confidence). Fix the D1 read-site at `:995` to penalize `outfit_id` for
`reject_outfit` events instead of `garment_id`.

### P89 — `style_chat` reads `user_style_summaries` + chat-driven extraction

Same summary read pattern as P88 (per-request memo cache, lazy materialization
on cache miss). Replace the inline 27-key extraction at lines 1268–1311 with a
single `summary_json` + `summary_text` injection block. Add deterministic
keyword/regex preference extraction (Option B, en + sv at v1) that runs
asynchronously after the chat turn responds and emits memory events via
`_shared/style-memory-ingest.ts` (the helper shipped in PR A).

### P90 — Privacy, export, delete cascade, reset

Extend `SettingsPrivacy.tsx`'s export bundle to cover all 12 missing tables
(P0+P1+P2 from audit §8b). Add `user_style_summaries` to the
`delete_user_account` cascade. Build a new edge function
`supabase/functions/reset_style_memory/` that calls a new SECURITY DEFINER
Postgres RPC `reset_style_memory_atomic` to wipe `feedback_signals` +
`garment_pair_memory` + `user_style_summaries` for the calling user in one
transaction. Add a "Reset style memory" UI control in SettingsPrivacy with
double-confirmation AlertDialog.

### P91 — Cross-cutting tests

Property-based test on the normalize map (1000 random strings, never throws,
returns canonical-or-null). Race test on `ingest_memory_event` RPC with
concurrent same-key writes. N=3 promotion threshold integration test against
the summary builder. avoid_rules hard-skip test against `burs_style_engine`.
Chat-extraction matrix (~25 patterns × 2 locales × {with/without active_look}
× {with/without negation}). Cross-user 403 test on memory_ingest.
Delete-cascade integration test asserting zero rows across 14+ tables.

### P92 — Wave 8.5 acceptance close-out

Mirror Wave 8 P57 pattern: 13-bullet checklist + 7-section PR summary in the
PR body. No code; verification only.

---

## Enterprise hardening details

### P86 — `useFeedbackSignals` rewrite

**Mutation pattern** (replaces fire-and-forget):

```typescript
// src/hooks/useFeedbackSignals.ts
export function useRecordMemoryEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordMemoryEventInput) => {
      const idempotencyKey = buildIdempotencyKey(input);
      return invokeEdgeFunction("memory_ingest", {
        body: { ...input, idempotency_key: idempotencyKey },
        retries: 3,                     // exponential backoff via wrapper
        timeoutMs: 8000,
      });
    },
    onError: (err, input) => {
      enqueueOfflineMemoryEvent(input); // IndexedDB queue, drained next session
      logTelemetry("memory_ingest_failure", { signal: input.signal_type, err });
    },
    onSuccess: (_, input) => {
      logTelemetry("memory_ingest_ok", { signal: input.signal_type });
    },
  });
}
```

**Idempotency key shape:**
```
${user_id}:${signal_type}:${outfit_id || sortedGarmentIds}:${floor(now/60s)}
```
1-minute granularity dedups double-tap and React StrictMode double-invokes.
Same key written twice within 60 s collapses on the server-side
`request_idempotency` lookup (P12 helper).

**IndexedDB offline fallback** — minimal scope: if the 3 retries exhaust,
enqueue the input to a `memory_event_queue` IDB store. Drain on next app start
in `AuthContext` after `SIGNED_IN`. Cap queue at 100 entries (oldest dropped).

**Optimistic UI updates** — for save/unsave the toggle flips immediately;
mutation error rolls back via React Query's optimistic update pattern.

### P86 — 7 callers + 4 new UI surfaces

Wire the mutation hook into these handlers (per audit §6a–6h):

| Surface | File:line | New behavior |
|---|---|---|
| OutfitDetail (rename only) | `src/pages/OutfitDetail.tsx:196,216,229,247,260` | Switch from legacy → canonical names through useRecordMemoryEvent |
| OutfitGenerate save | `src/pages/OutfitGenerate.tsx:335-347` | Wire `save_outfit` after persist |
| AIChat handleSaveFromChat | `src/pages/AIChat.tsx:1114-1161` | Wire `save_outfit` after insert |
| MoodOutfit auto-save | `src/pages/MoodOutfit.tsx:172-183` | Wire `save_outfit` after insert |
| UnusedOutfits auto-create | `src/pages/UnusedOutfits.tsx:97-108` | Wire `save_outfit` |
| AISuggestions handleTryIt | `src/components/insights/AISuggestions.tsx:233-237` | Wire `save_outfit` |
| TravelCapsule.addToCalendar | `src/components/travel/useTravelCapsule.ts:515-524` | Batch wire `save_outfit` per inserted outfit |
| useWeekGenerator | `src/hooks/useWeekGenerator.ts:138-150` | Per-day `save_outfit` |
| AIChat OutfitSuggestionCard swap | `src/components/chat/OutfitSuggestionCard.tsx:137-140` | Persist swap + `swap_garment` (currently local-only — deepest fix) |
| Plan calendar skip | `src/pages/Plan.tsx` (new) | New swipe-left or context-menu action → `useUpdatePlannedOutfitStatus({status:'skipped'})` + `skip_outfit` |

**4 new quick-reaction surfaces (D4):**
- `src/components/home/TodayOutfitCard.tsx` — emoji reaction row below outfit
- `src/pages/Plan.tsx` — reactions on planned outfit detail view
- `src/pages/OutfitGenerate.tsx` — reaction control in generated-outfit card
- `src/components/chat/OutfitSuggestionCard.tsx` — reaction row in chat card

Each wires `quick_reaction` with `metadata.value` ∈ {`love`, `like`, `meh`,
`dislike`}. UI matches existing OutfitDetail pattern (4-emoji ChipMulti).

**1 new garment-level surface:**
- `src/pages/GarmentDetail.tsx` — overflow menu item "Never suggest this" → AlertDialog confirm → `never_suggest_garment` event

**i18n** — append-only to `en.ts` + `sv.ts`:
- `quickReaction.{love,like,meh,dislike}` (4 keys)
- `garment.never_suggest_*` (3 keys: label, dialog title, dialog body)
- `plan.skip_outfit_*` (2 keys: action label, toast)
- `feedbackSignals.error_offline` (1 key — toast on offline-queue enqueue)

Other 12 locales fall through to en string per existing convention.

### P88 — burs_style_engine summary read

**Per-request memo cache** — top of the request handler:

```typescript
let summaryCache: UserStyleSummary | null | undefined;
async function getSummary(userId: string): Promise<UserStyleSummary | null> {
  if (summaryCache !== undefined) return summaryCache;
  summaryCache = await loadOrBuildSummary(supabaseAdmin, userId);
  return summaryCache;
}
```

**Lazy materialization** in `loadOrBuildSummary`:

```typescript
const { data: existing } = await supabaseAdmin
  .from("user_style_summaries").select("*").eq("user_id", userId).maybeSingle();

if (existing && !isStale(existing)) return existing;

// Cache miss or stale: build deterministically
const inputs = await loadSummaryInputs(supabaseAdmin, userId);
const t0 = Date.now();
const built = buildStyleSummary(inputs);
logTelemetry("summary_lazy_build", {
  user_id: userId,
  duration_ms: Date.now() - t0,
  signal_count: inputs.signals.length,
  outfit_count: inputs.outfits.length,
  was_stale: !!existing,
});
await supabaseAdmin.from("user_style_summaries").upsert({
  user_id: userId,
  summary_json: built.json,
  summary_text: built.text,
  confidence: built.confidence,
  version: built.version,
  updated_at: new Date().toISOString(),
}, { onConflict: "user_id" });

return { /* shape matches DB row */ };
```

`isStale(row)`: row older than 7 days OR `dirty_at IS NOT NULL` (dirty mark
written by `ingest_memory_event` RPC per PR A's design).

**Async stale-refresh** — if row exists but is mildly stale (1–7 d), serve the
cached row but kick a background rebuild via `EdgeRuntime.waitUntil(...)` so
the next request gets fresh data. Avoids blocking the current request on a
build.

**Scoring integration** — `_shared/outfit-scoring.ts` `scoreCombo` gets a new
optional parameter `summary?: UserStyleSummary`. New scoring contributions:
- `+0.15 × confidence` per `summary.preferred_colors` color match
- `−0.10 × confidence` per `summary.avoided_colors` color match
- `+0.20 × confidence` per `summary.preferred_fits` fit match
- `−0.15 × confidence` per `summary.avoided_fits` fit match
- `+0.25 × pair.weight` per `summary.favorite_pairings` pair found in candidate
- `−0.30 × pair.weight` per `summary.avoided_pairings` pair found
- **Hard skip** if any garment in the candidate matches an `avoid_rules` rule
  AND that rule's confidence ≥ 0.7

Confidence floor 0.3 — below that, log + ignore (per spec).

**D1 read-site fix** — `burs_style_engine:995`:

```typescript
// BEFORE: penalize sig.garment_id for reject events
// AFTER:
if (sig.signal_type === "reject_outfit" && sig.outfit_id) {
  // penalize the OUTFIT, not the garment
  outfitPenaltyMap.set(sig.outfit_id, (outfitPenaltyMap.get(sig.outfit_id) ?? 0) + 1);
} else if (sig.signal_type === "never_suggest_garment" && sig.garment_id) {
  // garment-level hard skip
  hardSkipGarmentIds.add(sig.garment_id);
}
```

**Pre-deploy MCP audit** — before merge, run via Supabase MCP:
```sql
SELECT signal_type, COUNT(*), COUNT(outfit_id) AS with_outfit_id, COUNT(garment_id) AS with_garment_id
FROM feedback_signals
WHERE signal_type IN ('reject', 'reject_outfit', 'dislike', 'thumbs_down', 'never_suggest_garment')
GROUP BY signal_type;
```

Expected: near-zero count, since the explicit reject UI doesn't exist today —
the audit's §6e confirms the flow doesn't exist. If legacy `reject` rows
exist with `garment_id` only (no `outfit_id`), the read-site fix above
silently drops them (the `&& sig.outfit_id` guard skips them). Contingency:
if the MCP audit returns >50 such rows, add a one-time inline migration in
this PR that backfills `outfit_id` from joined context where available, OR
re-classifies orphan-garment-id legacy rows to `never_suggest_garment` so
they keep contributing as garment-level hard-skip signals. Document the
chosen path in the PR body.

### P89 — style_chat summary read + extraction

**Summary read** — same pattern as P88. Replace the inline 27-key extraction
at `:1268-1311` with a single block injection:

```
PERSISTENT TASTE MEMORY:
${summary.summary_text}

PREFERRED COLORS: ${summary.summary_json.preferred_colors.join(", ")}
AVOIDED COLORS: ${summary.summary_json.avoided_colors.join(", ")}
PREFERRED FITS: ${summary.summary_json.preferred_fits.join(", ")}
FAVORITE PAIRINGS: ${formatPairings(summary.summary_json.favorite_pairings)}
AVOID RULES: ${summary.summary_json.avoid_rules.join("; ")}
```

The 27-key block is removed; the helper that built it is deleted (single
extraction now lives in the deterministic builder shipped in PR A — fulfills
the audit §P87 lift goal).

**Chat-driven extraction (Option B hardened)** — new module
`supabase/functions/_shared/style-chat-extraction.ts`:

```typescript
export interface ExtractedMemoryEvent {
  signal_type: CanonicalStyleMemorySignal;
  metadata: Record<string, unknown>;
  confidence: number;            // 0..1; 0.6 floor enforced at emit time
  pattern_id: string;             // for telemetry
}

export interface ExtractionContext {
  userTurn: string;
  locale: string;                 // 'en' | 'sv' | other (other → no-op + log)
  activeLook: { garment_ids: string[]; outfit_id?: string } | null;
  anchorGarmentId: string | null;
}

export function extractMemoryEvents(ctx: ExtractionContext): ExtractedMemoryEvent[];
```

**Pattern set v1** (en + sv, ~25 patterns total):

| Pattern ID | Locale | Trigger regex (case-insensitive, word-boundary) | Negation antipattern | Emits | Required context |
|---|---|---|---|---|---|
| `hate_X_en` | en | `\b(hate\|can'?t stand\|despise)\b` | `\b(don'?t hate\|not hate)\b` | `quick_reaction` value=`dislike` | activeLook OR anchorGarmentId |
| `hate_X_sv` | sv | `\b(hatar\|avskyr)\b` | `\b(inte hatar\|inte avskyr)\b` | `quick_reaction` value=`dislike` | activeLook OR anchorGarmentId |
| `love_X_en` | en | `\b(love\|adore)\b` | `\b(don'?t love\|not love)\b` | `quick_reaction` value=`love` | activeLook OR anchorGarmentId |
| `love_X_sv` | sv | `\b(älskar\|gillar verkligen)\b` | `\b(inte älskar)\b` | `quick_reaction` value=`love` | activeLook OR anchorGarmentId |
| `never_suggest_en` | en | `\bnever (suggest\|show me)\b` | `\bnever\s+\b(say\|mind)\b` | `never_suggest_garment` | anchorGarmentId required |
| `never_suggest_sv` | sv | `\b(visa aldrig\|föreslå aldrig)\b` | — | `never_suggest_garment` | anchorGarmentId required |
| `more_like_this_en` | en | `\b(more like (this\|that)\|along these lines)\b` | — | `like_pair` over activeLook.garment_ids | activeLook required |
| `more_like_this_sv` | sv | `\b(mer (såna\|sådana här))\b` | — | `like_pair` | activeLook required |
| `too_formal_en` | en | `\btoo (formal\|fancy\|dressy)\b` | — | `quick_reaction` value=`meh` + metadata.formality_shift=−1 | activeLook |
| `too_formal_sv` | sv | `\bför (formell\|fin)\b` | — | (same) | activeLook |
| `too_casual_en` | en | `\btoo (casual\|basic\|plain)\b` | — | `quick_reaction` value=`meh` + metadata.formality_shift=+1 | activeLook |
| `too_casual_sv` | sv | `\bför (vardaglig\|enkel)\b` | — | (same) | activeLook |
| `dislike_color_en` | en | `\b(don'?t like\|hate) (the )?(red\|blue\|green\|black\|white\|...)\b` | — | `quick_reaction` value=`dislike` + metadata.color_avoid | (none) |
| `dislike_color_sv` | sv | `\b(gillar inte\|hatar) (röd\|blå\|grön\|svart\|vit\|...)\b` | — | (same) | (none) |

**Confidence scoring** — each pattern hit starts at base 0.7, adjusts by:
- +0.1 if active_look or anchor present (binding strengthens signal)
- +0.1 if turn length < 15 words (terse statement is more decisive)
- −0.2 if any negation antipattern matches
- −0.3 if turn contains `?` (questions are not commitments)
- Clamped to [0, 1]

Floor at 0.6 to emit. Below 0.6 — log to `analytics_events` with
`outcome=below_threshold` for telemetry, do not write a signal.

**Async dispatch** — extraction runs after the chat turn responds:

```typescript
const responseStream = await streamGeminiResponse(...);
EdgeRuntime.waitUntil((async () => {
  try {
    const events = extractMemoryEvents({
      userTurn: lastUserTurn,
      locale,
      activeLook: chatBody.active_look,
      anchorGarmentId: chatBody.anchor_garment_id,
    });
    for (const ev of events) {
      if (ev.confidence < 0.6) {
        logTelemetry("style_chat_extraction_below_threshold", {
          pattern_id: ev.pattern_id,
          confidence: ev.confidence,
        });
        continue;
      }
      await ingestMemoryEvent(supabaseAdmin, {
        user_id: userId,
        signal_type: ev.signal_type,
        metadata: { ...ev.metadata, source: "style_chat_extraction", pattern_id: ev.pattern_id },
      });
      logTelemetry("style_chat_extraction_emit", {
        pattern_id: ev.pattern_id,
        signal_type: ev.signal_type,
        confidence: ev.confidence,
      });
    }
  } catch (err) {
    // never block chat turn on extraction failure
    logTelemetry("style_chat_extraction_error", { err: String(err) });
  }
})());
return responseStream;
```

**Pre-existing deno-check fix** (Fix Protocol exception (a)) — 5 TS errors in
`style_chat/index.ts` (Findings Log row 2026-04-24):
- `:1161` `TS2345` SupabaseClient mismatch on `getCalendarContext`
- `:1162` `TS2345` SupabaseClient mismatch on `getRecentOutfitsContext`
- `:1163` `TS2345` SupabaseClient mismatch on `getRejectionsContext`
- `:1164` `TS2345` SupabaseClient mismatch on `getWardrobeContext`
- `:1337` `TS2304` undefined `StyleChatIntentKind`

Fix pattern from PR #681: cast `supabase as ReturnType<typeof createClient>`
at each call site. Resolve `StyleChatIntentKind` import / type definition.
Document in PR body as "Scope expansion."

### P90 — privacy / export / delete / reset

**Export bundle extension** — `SettingsPrivacy.tsx:67-72` becomes:

```typescript
const tables = await Promise.all([
  supabase.from("garments").select("*").eq("user_id", userId),
  supabase.from("outfits").select("*, outfit_items(*)").eq("user_id", userId),
  supabase.from("profiles").select("*").eq("id", userId),
  // P0 (memory)
  supabase.from("user_style_summaries").select("*").eq("user_id", userId),
  supabase.from("feedback_signals").select("*").eq("user_id", userId),
  supabase.from("garment_pair_memory").select("*").eq("user_id", userId),
  supabase.from("wear_logs").select("*").eq("user_id", userId),
  // P1
  supabase.from("chat_messages").select("*").eq("user_id", userId),
  supabase.from("outfit_feedback").select("*").eq("user_id", userId),
  supabase.from("outfit_reactions").select("*").eq("user_id", userId),
  supabase.from("swap_events").select("*").eq("user_id", userId),
  supabase.from("planned_outfits").select("*").eq("user_id", userId),
  // P2
  supabase.from("user_style_profiles").select("*").eq("user_id", userId),
  supabase.from("inspiration_saves").select("*").eq("user_id", userId),
]);
```

For users with very large histories, build the export as a streamed JSON Blob
table-by-table rather than one mega-object — lower peak memory:

```typescript
const blobParts: Blob[] = [new Blob([`{"exportedAt":"${new Date().toISOString()}",`])];
for (const [name, rows] of tableEntries) {
  blobParts.push(new Blob([`"${name}":${JSON.stringify(rows)},`]));
}
blobParts.push(new Blob([`"version":1}`]));
const downloadBlob = new Blob(blobParts, { type: "application/json" });
```

**Delete cascade** — `delete_user_account/index.ts` adds explicit deletes
before `auth.admin.deleteUser` (parity, not strict acceptance — FK CASCADE
already covers the P1+P2 tables):

```typescript
await supabaseAdmin.from("user_style_summaries").delete().eq("user_id", userId); // P0
await supabaseAdmin.from("swap_events").delete().eq("user_id", userId);          // P1 parity
await supabaseAdmin.from("user_style_profiles").delete().eq("user_id", userId);  // P1 parity
await supabaseAdmin.from("outfit_reactions").delete().eq("user_id", userId);     // P1 parity
await supabaseAdmin.from("inspiration_saves").delete().eq("user_id", userId);    // P2 parity
```

**Reset style memory** — new edge function + new RPC.

Migration `<ts>_reset_style_memory_atomic.sql`:

```sql
CREATE OR REPLACE FUNCTION public.reset_style_memory_atomic(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signals_deleted int;
  v_pairs_deleted int;
  v_summaries_deleted int;
BEGIN
  -- Cross-user write protection: caller must be service_role
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'reset_style_memory_atomic: service_role required';
  END IF;

  DELETE FROM public.feedback_signals WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_signals_deleted = ROW_COUNT;

  DELETE FROM public.garment_pair_memory WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_pairs_deleted = ROW_COUNT;

  DELETE FROM public.user_style_summaries WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_summaries_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'feedback_signals_deleted', v_signals_deleted,
    'garment_pair_memory_deleted', v_pairs_deleted,
    'user_style_summaries_deleted', v_summaries_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_style_memory_atomic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_style_memory_atomic(uuid) TO service_role;
```

Edge function `supabase/functions/reset_style_memory/index.ts` — standard
auth/rate-limit/subscription template (matches `memory_ingest`):

- CORS preflight
- `checkOverload`
- anon-client + `getUser()` JWT auth
- service-role client
- `enforceRateLimit` — new tier `reset_style_memory: { maxPerHour: 5, maxPerMinute: 1 }`
- `enforceSubscription` (paid feature, locked users redirect to paywall)
- `request_idempotency` claim/cache (destructive op — double-tap guard)
- `analytics_events` audit row BEFORE the RPC call (forensic trace)
- `await supabaseAdmin.rpc('reset_style_memory_atomic', { p_user_id: userId })`
- `analytics_events` audit row AFTER (with deletion counts)
- Return `{ ok: true, tables_cleared: { feedback_signals, garment_pair_memory, user_style_summaries }, counts: {...} }`

**`scale-guard.ts` change** — new `reset_style_memory` tier added.
This is purely additive (no other consumer reads this key) — same precedent
as P9 PR #657, P52 `start_trial`, P85 `memory_ingest`. Per CLAUDE.md Shared
Module Deploy Map convention, additive tier entries do NOT trigger 22-AI-fn
fanout — only the new `reset_style_memory` function consumes it.

**SettingsPrivacy UI** — new SettingsRow inside the existing "Your Rights"
Collapsible (lines 214–232), wrapped in an AlertDialog matching the Delete
Account pattern (lines 252–283):

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" className="...">
      {t("settings.gdpr.reset_memory")}
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t("settings.gdpr.reset_memory_title")}</AlertDialogTitle>
      <AlertDialogDescription>
        <p>{t("settings.gdpr.reset_memory_warning")}</p>
        <p>{t("settings.gdpr.reset_memory_what_clears")}</p>
        <p>{t("settings.gdpr.reset_memory_what_preserves")}</p>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
      <AlertDialogAction onClick={handleResetMemory}>
        {t("settings.gdpr.reset_memory_confirm")}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

`handleResetMemory` invokes `reset_style_memory`, on success invalidates
React Query keys (`['user-style-summary', userId]`,
`['feedback-signals', userId]` if a hook is added later), shows
`toast.success(t("settings.gdpr.reset_success"))`. On failure, error toast.

i18n keys (append-only en + sv):
- `settings.gdpr.reset_memory`
- `settings.gdpr.reset_memory_title` / `_warning` / `_what_clears` / `_what_preserves` / `_confirm`
- `settings.gdpr.reset_success` / `_error`

### P91 — test surface

| Test | File | Assertion |
|---|---|---|
| Property-based normalize | `_shared/__tests__/style-memory-signals.test.ts` (extends PR A's file) | 1000 random strings → never throws → returns canonical-or-null only |
| Race RPC | `_shared/__tests__/memory-ingest-race.test.ts` (new, integration) | 5 concurrent calls with same idempotency_key → exactly 1 feedback_signals row, exactly 1 garment_pair_memory delta |
| N=3 promotion | `_shared/__tests__/style-summary-builder.test.ts` (extends PR A's file) | 2 dislikes → no `avoided_colors` entry; 3 dislikes → `avoided_colors` includes color with confidence ≥ 0.5 |
| avoid_rules hard-skip | `burs_style_engine/__tests__/avoid-rules.test.ts` (new) | User with `avoid_rules: ["skinny_jeans", confidence: 0.8]` → generated outfits never include skinny jeans |
| Chat extraction matrix | `_shared/__tests__/style-chat-extraction.test.ts` (new) | 25 patterns × 2 locales × {with/without active_look} × {with/without negation} |
| Cross-user 403 | `memory_ingest/__tests__/auth.test.ts` (extends PR A's tests) | JWT user A, body user_id=B → 403 |
| Delete cascade | `delete_user_account/__tests__/cascade.test.ts` (extends if exists, new otherwise) | Create user → fill 14 user-authored tables → delete account → assert 0 rows in all 14 |
| Useful smoke | `useFeedbackSignals/__tests__/integration.test.tsx` | save_outfit toggle fires memory_ingest invoke with correct body shape + idempotency key |

### P92 — close-out

13-bullet checklist + 7-section PR summary in the PR body. Verification only.

---

## Risk register

| ID | Risk | Mitigation | Owner prompt |
|---|---|---|---|
| R1 | Lazy-build first-call latency on heavy users (>1y history) | Structured `summary_lazy_build` log with `duration_ms`; alert threshold via Sentry if any single build > 5 s; defaults if build throws | P88 + P89 |
| R2 | `ingest_memory_event` partial-write on RPC failure | RPC wraps all 3 writes in single transaction (PR A design); integration race test in P91 | P91 |
| R3 | D1 read-site swap re-interprets historical reject rows | Pre-deploy MCP audit query (in P88 deploy section); near-zero count expected | P88 |
| R4 | Pre-existing style_chat deno-check errors block CI | Fix inline as scope expansion; documented in PR body | P89 |
| R5 | Quick-reaction extends to 4 surfaces — most LOC-heavy single block | Sub-agent dispatch per surface in parallel; code-reviewer on aggregate | P86 |
| R6 | memory_ingest latency on every save/wear/swap | Background invoke + optimistic UI; React Query mutation pattern; user sees no latency | P86 |
| R7 | Offline IndexedDB queue could grow unbounded | Cap at 100 entries; oldest dropped; queue length surfaced in telemetry | P86 |
| R8 | False-positive chat extraction emits incorrect signals | Confidence floor 0.6 + active_look binding requirement + negation guard; below-threshold emissions logged for telemetry-driven tuning | P89 |
| R9 | Reset RPC gives users a footgun (clears confidence) | Double-confirmation AlertDialog matching Delete Account UX; analytics_events audit row | P90 |

---

## Deploy radius (post-merge)

1. `npx supabase db push --linked --yes` — 1 new migration (`reset_style_memory_atomic` RPC)
2. Deploy `burs_style_engine` (P88 summary read + D1 fix + scoring integration)
3. Deploy `style_chat` (P89 summary read + extraction + 5 deno-check fixes)
4. Deploy `delete_user_account` (P90 cascade)
5. Deploy `reset_style_memory` (new fn, P90)
6. **Conditional**: redeploy `memory_ingest` ONLY IF `_shared/style-memory-ingest.ts` is modified in this PR (expected: not modified — PR A's helper already supports the chat-extraction call shape `ingestMemoryEvent(supabaseAdmin, { user_id, signal_type, metadata })`)

5 guaranteed deploys + 1 conditional. No 22-AI-function fanout (no
`_shared/scale-guard.ts` semantic change beyond the additive
`reset_style_memory` tier; no `_shared/burs-ai.ts` change).

---

## Files touched (estimated)

### New
- `supabase/migrations/<ts>_reset_style_memory_atomic.sql`
- `supabase/functions/reset_style_memory/index.ts`
- `supabase/functions/_shared/style-chat-extraction.ts`
- `src/lib/memoryEventQueue.ts` (IndexedDB offline fallback for P86)
- 8+ test files (per P91 matrix above)

### Modified
- `src/hooks/useFeedbackSignals.ts` (rewrite)
- `src/pages/OutfitDetail.tsx` (rename legacy → canonical)
- `src/pages/OutfitGenerate.tsx` (wire save + add quick reaction)
- `src/pages/AIChat.tsx` (wire save + swap + quick reaction)
- `src/pages/MoodOutfit.tsx` (wire save)
- `src/pages/UnusedOutfits.tsx` (wire save)
- `src/components/insights/AISuggestions.tsx` (wire save)
- `src/components/travel/useTravelCapsule.ts` (wire save)
- `src/hooks/useWeekGenerator.ts` (wire save)
- `src/components/chat/OutfitSuggestionCard.tsx` (wire swap + quick reaction)
- `src/components/home/TodayOutfitCard.tsx` (add quick reaction)
- `src/pages/Plan.tsx` (add skip + quick reaction)
- `src/pages/GarmentDetail.tsx` (add never-suggest)
- `src/pages/settings/SettingsPrivacy.tsx` (extend export + add reset UI)
- `supabase/functions/burs_style_engine/index.ts` (P88)
- `supabase/functions/_shared/outfit-scoring.ts` (P88 scoring integration)
- `supabase/functions/style_chat/index.ts` (P89 summary read replacing 27-key extraction at :1268-1311 + 5 pre-existing deno-check fixes + extraction dispatch)
- `supabase/functions/style_chat/wardrobe-context.ts` (no change in PR B — `buildTasteMemoryBlock` preserved per audit §P89; deprecation deferred until summary covers same insights)
- `supabase/functions/delete_user_account/index.ts` (P90 cascade)
- `supabase/functions/_shared/scale-guard.ts` (additive tier for reset_style_memory)
- `supabase/functions/_shared/style-memory-ingest.ts` (P85 helper extension if P89 needs it)
- `supabase/config.toml` (new function entry)
- `src/i18n/locales/en.ts` (append-only)
- `src/i18n/locales/sv.ts` (append-only)
- `CLAUDE.md` (CURRENT PROMPT flip + LAST UPDATED + Completion Log row)
- `docs/launch/wave-8.5-style-memory.md` (status flips on 6 prompts)

Estimated total: ~30 modified + ~5 new = ~35 files; ~2500 LOC.

---

## Acceptance gates (must all pass before push)

- [ ] `npx tsc --noEmit --skipLibCheck` → 0 errors
- [ ] `npx eslint . --max-warnings 0` → 0 warnings
- [ ] `npm run build` → clean, no warnings
- [ ] `npx vitest run` → all pass
- [ ] `deno check supabase/functions/burs_style_engine/index.ts` → 0 errors
- [ ] `deno check supabase/functions/style_chat/index.ts` → 0 errors (after pre-existing fixes)
- [ ] `deno check supabase/functions/reset_style_memory/index.ts` → 0 errors
- [ ] `deno check supabase/functions/memory_ingest/index.ts` → 0 errors (regression check)
- [ ] `deno check supabase/functions/delete_user_account/index.ts` → 0 errors
- [ ] `npx supabase db push --linked --dry-run --yes` → lists only PR B's 1 migration
- [ ] code-reviewer subagent → no P0/P1 unresolved
- [ ] CLAUDE.md tracker updates committed in same PR
- [ ] PR body includes 7-section Wave 8.5 acceptance summary (P92 deliverable)

---

## Followups (NOT in this PR)

- **Migration to Option C extraction** (P89 long-term) — once telemetry shows
  Option B's precision/recall, decide whether to lift extraction into a
  structured-output Gemini tool-call.
- **Translator pass on extraction patterns** — extend the en+sv pattern set to
  the other 12 supported locales (matches Wave 6 P40 deferred translator-pass
  pattern).
- **Per-user quick-reaction history surface** — let users see + revoke their
  own reactions in Settings (data-portability adjacent; nice-to-have).
- **Summary-text injection to currently-summary-blind functions** —
  `mood_outfit`, `clone_outfit_dna`, `suggest_accessories`, `wardrobe_aging`,
  `wardrobe_gap_analysis`, `style_twin` (audit §5a flagged them; not Wave 8.5
  scope).
