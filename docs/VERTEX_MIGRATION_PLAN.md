# Vertex AI + Gemini 3.x Migration Plan

**Status:** DRAFT (planning artifact — execution scheduled for Wave 10.5, the last sub-wave before Wave 11 App Store Launch Prep).
**Owner:** borna-z (solo founder).
**Target start:** After Wave 10 (RevenueCat + StoreKit) ships and before Wave 11 begins.
**Target finish:** Before TestFlight beta (Wave 11 P80).

---

## 1. Goal

Migrate BURS's entire AI surface from **Google AI Studio** (`generativelanguage.googleapis.com`, API-key auth, OpenAI-compatible endpoint for text) to **Vertex AI** (`aiplatform.googleapis.com`, service-account OAuth, native Gemini REST), and simultaneously upgrade from Gemini 2.5 models to Gemini 3.x.

### 1.1 Model mapping

| Legacy (AI Studio, 2.5) | Target (Vertex AI, 3.x) | Codename | Status |
|---|---|---|---|
| `gemini-2.5-flash` | `gemini-3-flash` | — | GA |
| `gemini-2.5-flash-lite` | `gemini-3.1-flash-lite-preview` | — | **Preview (no SLA)** |
| `gemini-2.5-flash-image` | `gemini-3.1-flash-image-preview` | **Nano Banana 2** | **Preview (no SLA)** |

### 1.2 Infrastructure change

| Concern | Current (AI Studio) | Target (Vertex AI) |
|---|---|---|
| Platform | `generativelanguage.googleapis.com` | `aiplatform.googleapis.com` |
| Region | Global (Google-managed) | **`europe-west4`** (EU data residency — aligns with Supabase `eu-central-1`) |
| Auth | `GEMINI_API_KEY` (single key, bearer) | GCP service account JSON → signed JWT (RS256) → OAuth 2.0 access token (1h TTL) |
| Text transport | OpenAI-compatible (`/v1beta/openai/chat/completions`, `messages[]`, `tools`) | Native Gemini REST (`/publishers/google/models/{model}:generateContent` + `:streamGenerateContent`, `contents[].parts[]`, `tools` with `functionDeclarations`) |
| Image transport | Native Gemini REST (`generateContent` with `inlineData` parts) | Identical shape — swap model path + add OAuth header |
| Streaming | SSE (`data:` frames) | SSE via `:streamGenerateContent?alt=sse` — frame shape differs slightly; see §4.4 |

### 1.3 New Supabase secrets

Add to prod Supabase project (`khvkwojtlkcvxjxztduj`) via SQL editor / dashboard:

```sql
-- Phase 1 prerequisite
INSERT INTO vault.secrets (name, secret) VALUES
  ('GCP_SERVICE_ACCOUNT_JSON_B64', '<base64-encoded service-account JSON>'),
  ('GCP_PROJECT_ID', '<gcp-project-id>'),
  ('GCP_LOCATION', 'europe-west4')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```

Corresponding edge-function env vars (set via `supabase secrets set`):

```bash
# `base64 < file | tr -d '\n'` is portable across GNU coreutils (Linux),
# BSD/macOS, and Git Bash on Windows. Avoid `base64 -w 0` — that flag
# is GNU-only and fails silently on macOS.
npx supabase secrets set \
  GCP_SERVICE_ACCOUNT_JSON_B64="$(base64 < /path/to/sa.json | tr -d '\n')" \
  GCP_PROJECT_ID="<project>" \
  GCP_LOCATION="europe-west4" \
  --project-ref khvkwojtlkcvxjxztduj
```

`GEMINI_API_KEY` stays in place during Phases 1-5 as the emergency-rollback lever (the existing client reads it, and until Phase 4 finishes not every function is on Vertex). Phase 6 removes it and the `GEMINI_*_URL_OVERRIDE` vars (used only by the local smoke-test mock server; see §4.5).

### 1.4 Service account scope

Minimum IAM role on the GCP project: `roles/aiplatform.user`. No Storage, BigQuery, or IAM-edit permissions required. Keep the SA dedicated to this workload — don't reuse an existing multi-purpose SA.

Key rotation: Google recommends rotating SA JSON keys every 90 days. Rotation procedure is a single `INSERT ... ON CONFLICT DO UPDATE` in `vault.secrets` — no code change (the auth shim reads the secret on every token refresh).

---

## 2. Scope

### 2.1 Shared modules (4)

| File | Change |
|---|---|
| `supabase/functions/_shared/burs-ai.ts` | Rewrite transport: Vertex REST + OAuth. Preserve the public `callBursAI()` / `streamBursAI()` signatures so callers don't change. Internal adapter converts OpenAI-style `messages[]` ↔ Gemini-native `contents[].parts[]`. |
| `supabase/functions/_shared/gemini-image-client.ts` | Rewrite transport: Vertex REST + OAuth. Swap `GEMINI_IMAGE_MODEL` constant. Shape of `contents[].parts[]` body stays — only endpoint + auth header change. |
| `supabase/functions/_shared/render-eligibility.ts` | Same as image client: swap `GEMINI_TEXT_MODEL` + endpoint + auth. |
| `supabase/functions/_shared/scale-guard.ts` | Revisit `RATE_LIMIT_TIERS` for the preview models — Vertex per-project QPS quotas differ from AI Studio. Adjust caps if Google bumps us down. |

### 2.2 New shared module (1)

| File | Purpose |
|---|---|
| `supabase/functions/_shared/vertex-auth.ts` | **NEW.** SA JSON → JWT (RS256, claims: `iss`, `scope=https://www.googleapis.com/auth/cloud-platform`, `aud=https://oauth2.googleapis.com/token`, `iat`, `exp` (+1h)) → exchange at `https://oauth2.googleapis.com/token` for a Bearer access token. In-memory token cache per isolate, 55-minute TTL (5 min before the 1h expiry), refresh on 401. Export `getVertexAccessToken(): Promise<string>`. |

### 2.3 Edge functions (22 total — audit table in §3)

- **5 Tier 1** — low-risk (batch/background/low-volume user-facing).
- **7 Tier 2** — medium-risk (user-triggered, non-real-time).
- **7 Tier 3 hot path** — one PR per function.
- **3 image generators** — batched together in Phase 5.

Counted against the current 41 deployed edge functions. Non-AI functions (Stripe, calendar, `delete_user_account`, `cleanup_ai_cache`, `daily_reminders`, etc.) are out of scope.

---

## 3. Per-function audit

Derived from the actual code in the Wave 4-C worktree (2026-04-23). "Current model" is the **primary** chain link — the fallback is always the other one in the pair. "Streaming" = uses `streamBursAI()` or direct SSE. "Multimodal" = sends `inlineData` / `image_url` parts.

### 3.1 Tier 1 — Phase 2 (low-risk)

| Function | Current model | Complexity | Streaming | Multimodal | Rate limit (hr/min) |
|---|---|---|---|---|---|
| `wardrobe_aging` | `gemini-2.5-flash-lite` | trivial | no | no | 15 / 3 |
| `style_twin` | `gemini-2.5-flash-lite` | trivial | no | no | 15 / 3 |
| `summarize_day` | `gemini-2.5-flash-lite` | standard | no | no | 40 / 8 |
| `wardrobe_gap_analysis` | `gemini-2.5-flash-lite` | standard | no | no | 15 / 3 |
| `prefetch_suggestions` | `gemini-2.5-flash-lite` | standard | no | no | cron-only (batch) |

### 3.2 Tier 2 — Phase 3 (medium-risk)

| Function | Current model | Complexity | Streaming | Multimodal | Rate limit (hr/min) |
|---|---|---|---|---|---|
| `detect_duplicate_garment` | `gemini-2.5-flash-lite` | standard | no | no | 40 / 8 |
| `visual_search` | `gemini-2.5-flash-lite` | standard | no | **yes** | 30 / 5 |
| `suggest_accessories` | `gemini-2.5-flash-lite` | standard | no | no | 30 / 5 |
| `suggest_outfit_combinations` | `gemini-2.5-flash-lite` | standard | no | no | 30 / 5 |
| `clone_outfit_dna` | `gemini-2.5-flash-lite` | complex | no | no | 20 / 4 |
| `assess_garment_condition` | `gemini-2.5-flash` | complex | no | **yes** | 30 / 5 |
| `travel_capsule` | `gemini-2.5-flash-lite` | complex | no | no | 15 / 3 |

### 3.3 Tier 3 — Phase 4 (hot path, one PR per function)

| Function | Current model | Complexity | Streaming | Multimodal | Rate limit (hr/min) | Phase 4 order |
|---|---|---|---|---|---|---|
| `analyze_garment` | `gemini-2.5-flash` | complex | no | **yes** | 40 / 8 | 1 (enrichment, re-runnable) |
| `outfit_photo_feedback` | `gemini-2.5-flash` | complex | no | **yes** | 20 / 4 | 2 |
| `burs_style_engine` | `gemini-2.5-flash` | complex | no | no | 30 / 5 | 3 (core outfit generator) |
| `generate_outfit` | `gemini-2.5-flash` | complex | no | no | 30 / 5 | 4 (thin shim over burs_style_engine) |
| `mood_outfit` | `gemini-2.5-flash` | complex | **yes** | no | 30 / 5 | 5 (streaming + hardcoded keepalive) |
| `shopping_chat` | `gemini-2.5-flash` | standard | **yes** | no | 60 / 10 | 6 (streaming) |
| `style_chat` | `gemini-2.5-flash` (mixed)* | trivial / standard | **yes** | no | 60 / 10 | 7 (LAST — largest function, ~2300 LOC) |

*`style_chat` uses `trivial` (180 max tokens) for CONVERSATIONAL mode (greetings, short replies, fashion-knowledge Q&A) and `standard` for outfit-generation / follow-up / knowledge modes.

### 3.4 Image generation — Phase 5

| Function | Current model | Complexity | Streaming | Multimodal | Rate limit (hr/min) |
|---|---|---|---|---|---|
| `render_garment_image` | `gemini-2.5-flash-image` | `modelType: image-gen` | no | **yes** | 30 / 3 |
| `generate_garment_images` | `gemini-2.5-flash-image` | `modelType: image-gen` | no | no | 20 / 3 |
| `generate_flatlay` | `gemini-2.5-flash-image` | `modelType: image-gen` | no | **yes** | 15 / 3 |

`render_garment_image` also invokes the **text-gate** (`validateRenderedGarmentOutputWithGemini` in `_shared/render-eligibility.ts`) which uses `gemini-2.5-flash` directly. That text call migrates in Phase 5 alongside the image call to keep the pipeline coherent.

---

## 4. Breaking changes checklist

### 4.1 Parameter renames

| Old name (2.5) | New name (3.x) | Where used today | Migration impact |
|---|---|---|---|
| `thinking_budget` | `thinking_level` (enum: `off` / `low` / `medium` / `high`) | **Not used** anywhere in BURS (verified via grep) | None — just ensure the auth shim / new `callBursAI` signature rejects `thinking_budget` at the typecheck boundary to prevent accidental reintroduction. |

### 4.2 Thought signatures (new mandatory field in 3.x)

Gemini 3.x chat continuations must include each prior turn's `thought_signature` when the model returned one. Without it, the model may refuse the request or degrade reasoning quality.

**Impact on BURS:**
- **`style_chat`** and **`shopping_chat`** preserve multi-turn context via `chat_messages` table. Migration must (a) capture the `thought_signature` field on each assistant turn into a new `chat_messages.thought_signature TEXT` column (nullable), and (b) replay it on the next request.
- **Sequencing rule (Codex P1 on PR #667):** the schema migration + shared signature-handling plumbing in `_shared/burs-ai.ts` MUST ship as a standalone PR BEFORE either chat function flips to the new transport. If `shopping_chat` flipped first without the plumbing in place, every multi-turn conversation in its 24h observation window would degrade. See Phase 4's PR 4-6 (new prep-only PR) in §7.
- **All other functions** are single-turn — no impact.

Open question: does the 3.x API require thought_signatures on function-calling turns too? Needs verification against Vertex AI docs during Phase 1 implementation. If yes: `clone_outfit_dna`, `mood_outfit`, `suggest_outfit_combinations`, `wardrobe_gap_analysis`, `travel_capsule` (all use tools) need signature preservation within a single request's tool-call loop.

### 4.3 Media tokenization changes

3.x counts image tokens differently than 2.5 (Google's changelog — verify exact multipliers pre-migration). Multimodal callers and their per-request `max_tokens` budgets:

| Function | Images per request | `max_tokens` today | Action |
|---|---|---|---|
| `analyze_garment` | 1 garment image | complex default (1200) | Benchmark with a sample of real garments; adjust if budget underfits. |
| `outfit_photo_feedback` | 1 selfie + N garment refs | complex default | Benchmark — this is the most image-heavy call. |
| `visual_search` | 1 query image | standard default (600) | Benchmark. |
| `assess_garment_condition` | 1 garment image | complex default | Benchmark. |
| `render_garment_image` | 1 source image (input) | image-gen (N/A — output bytes, not tokens) | No action — token budget doesn't apply to image output. |
| `generate_flatlay` | 2-5 garment refs | image-gen | No action. |

Mitigation: add a `retrieval.input_tokens` log field on every multimodal call in Phase 2-4 so we can spot budget overruns in `analytics_events` telemetry within 24h of launch.

### 4.4 SSE streaming — keepalive preservation

Three functions stream: `mood_outfit`, `shopping_chat`, `style_chat`. The behavior that must survive the transport swap:

**`mood_outfit`** — hardcoded constants at `supabase/functions/mood_outfit/index.ts:15-16`:
```typescript
const KEEPALIVE_INTERVAL_MS = 2000;
const HARD_ABORT_TIMEOUT_MS = 28000;
```
These fire keepalive pings (`: keepalive\n\n`) on the response stream every 2s so Supabase's edge-runtime proxy doesn't close an apparently-idle connection. The Vertex SSE parser in the new `streamBursAI` must interleave its own keepalive pings on the outbound stream even when Vertex hasn't emitted a frame in that window.

**`shopping_chat` + `style_chat`** — use `streamBursAI()` from `_shared/burs-ai.ts` which injects keepalive centrally via the `transformStream` wrapper. This wrapper must be re-implemented 1:1 against Vertex SSE; the Vertex frame shape is:

```
data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}

```
vs the AI Studio OpenAI-compat shape of:
```
data: {"choices":[{"delta":{"content":"..."}}]}

```

New streaming adapter in Phase 1 converts Vertex SSE → OpenAI-style delta internally so no downstream caller cares.

### 4.5 Smoke-test mock server

`src/test/smoke/mocks/mock-server.ts` + `gemini.ts` currently respond to AI Studio endpoint shapes. After Phase 6, they must respond to Vertex shapes. Until then, the three env-var overrides (`GEMINI_URL_OVERRIDE`, `GEMINI_IMAGE_URL_OVERRIDE`, `GEMINI_TEXT_URL_OVERRIDE`) stay in place so the local smoke suite keeps working during the migration. Phase 6 replaces with `VERTEX_URL_OVERRIDE` + updated fixture bodies.

### 4.6 Cost ledger + `RENDER_PROMPT_VERSION`

- `estimateCost()` in `_shared/scale-guard.ts` uses per-1K-token prices. New prices required for all three target models — add to the pricing map during Phase 1.
- `RENDER_PROMPT_VERSION` in `render_garment_image` (currently `v2`) must bump to `v3` during Phase 5 so in-flight `v2` credit reservations don't short-circuit the new image model. Same pattern as Wave 3-B.

### 4.7 `ai_response_cache` — cold cache post-migration

Migration changes the prompt model tag (from model ID embedded in cache_key). Every cached response becomes unreachable after each phase's deploy. TTLs are short (30 min – 12 h per consumer) — natural decay, acceptable per the L554 (Wave 2-C) precedent. No manual cache invalidation needed.

---

## 5. Risk flags

### 5.1 Preview-model instability

**Risk:** `gemini-3.1-flash-lite-preview` and `gemini-3.1-flash-image-preview` (Nano Banana 2) are preview — no SLA, capacity, latency, or schema guarantees. Google reserves the right to break them without deprecation notice during preview.

**Mitigation — per-request fallback on preview-specific error classes:**

In the new `burs-ai.ts` transport, on receipt of any of these response conditions against a preview model, fall back to the next link in the chain (which after Phase 2 is always `gemini-3-flash` GA):

| Error signal | Action |
|---|---|
| HTTP 503, 502, 504 | Fall back on attempt 1 (don't waste retry budget on preview overload) |
| HTTP 400 with message containing `schema` or `invalid_argument` | Fall back (preview API shape drifted) |
| HTTP 429 with `model-specific quota` | Fall back (preview tier has lower caps than GA) |
| Candidate returns empty `parts[]` with `finishReason: OTHER` or no finishReason | Fall back (preview nondeterminism) |
| JSON.parse failure on response body | Fall back (preview emitted malformed stream) |

**Observability for mitigation:** add `analytics_events.metadata.fallback_from_preview = true` when the fallback fires, so we can quantify preview unreliability in prod and decide if we should demote specific Tier 1 functions to GA Flash permanently.

### 5.2 Vertex AI quota limits in `europe-west4`

Vertex AI enforces per-project, per-region, per-model QPS and TPM quotas. Default quotas are much lower than AI Studio's generous free-tier/paid-tier caps. Pre-launch action items:

1. **Before Phase 2 deploys**: submit a Vertex AI quota increase request for `aiplatform.googleapis.com/online_prediction_requests_per_minute_per_model` in `europe-west4` for each of the three target models, sized to BURS's expected launch load × 3.
2. **During Phase 4**: if preview-model quota is the bottleneck on `gemini-3.1-flash-lite-preview`, consider downgrading Tier 1 functions to GA Flash for launch (accept higher cost per call vs. risk of user-facing 429s).
3. **Wave 11 launch checklist**: monitor Vertex Cloud Monitoring dashboards for the first 72h post-launch.

### 5.3 Regional data residency + latency

`europe-west4` is geographically closer to BURS's EU users (primary market: Sweden, Nordics, UK, Netherlands) than AI Studio's routed-global endpoint. Expected latency improvement: 20-60ms per call. Watch for:
- Cold-start latency spike when a rarely-called function re-warms its isolate + re-fetches the OAuth token. Phase 1's 55-min token cache amortizes this; confirm with P95 latency telemetry post-migration.
- Cross-region fallback: if `europe-west4` has capacity issues, Vertex AI does NOT auto-failover to another region for generativemodel endpoints. Manual `GCP_LOCATION` swap is the contingency (single env-var change + function redeploy).

### 5.4 Thought-signature migration risk for chat

Without thought_signature preservation, 3.x chat quality may silently degrade on multi-turn conversations. Detection will be user-reported ("the AI forgot what we were talking about"). Mitigation: the `chat_messages.thought_signature TEXT NULL` column migration + shared signature-handling plumbing in `_shared/burs-ai.ts` ships as a **standalone prep-only PR (4-6)** BEFORE any chat function flips (per Codex P1 on PR #667 — originally bundled with `style_chat`'s flip, which would have left `shopping_chat` running on 3.x for 24h without signature support). Adapter stores + replays signatures from the moment PR 4-6 lands; PRs 4-7 and 4-8 then flip the two chat functions with the plumbing already in place.

### 5.5 Rollback strategy

Each phase ships as its own PR. If a phase causes user-visible regressions in the first 24h post-deploy:
1. **Phase 2, 3, 5 (multi-function bundles)**: `git revert <merge-commit> && npx supabase functions deploy <each function>`. Takes ~10 min.
2. **Phase 4 (per-function)**: revert the single-function PR + redeploy only that function. Takes ~2 min per function.
3. **Full rollback to AI Studio**: revert Phase 1 (which removes all the shared-module code). `GEMINI_API_KEY` must still be valid (kept through Phase 5) so the old transport works. All 22 AI functions need redeploy.

Rollback risk-mitigation: keep `GEMINI_API_KEY` provisioned until Phase 6 closes and prod has been stable for 7 days.

---

## 6. Cost impact summary

Numbers below are directional (based on Google's published per-model pricing at the time of plan authoring; verify Phase 1 day-of against current Vertex AI pricing).

| Model | Usage profile | Expected cost delta vs 2.5 equivalent |
|---|---|---|
| `gemini-3-flash` (GA) | Tier 3 hot path + `burs_style_engine` + all `complex` callers | **Flat** (pricing parity with 2.5 Flash) |
| `gemini-3.1-flash-lite-preview` | Tier 1 + most Tier 2 + trivial/standard callers | **~3× up** per-token during preview period |
| `gemini-3.1-flash-image-preview` (Nano Banana 2) | Image generation (3 functions) | **Flat to down** (preview pricing similar or cheaper than 2.5 Flash Image) |

### 6.1 Impact on blended unit economics

- Tier 1 functions (`wardrobe_aging`, `style_twin`, `summarize_day`, etc.) are relatively infrequent per user per day (mostly cron/batch-driven or onboarding-only). A 3× per-call cost hit is small in absolute terms: estimated at <5% of total AI cost per user per month, given their low frequency.
- Tier 3 streaming + image gen dominate per-user AI spend. These are on **flat** pricing (Flash GA + Nano Banana 2) — net impact minimal.
- Net expected blended cost delta per active user per month: **+0% to +8%** depending on user's mix of Tier 1 vs Tier 3 usage. Well within the premium-tier margin.

### 6.2 Revisit trigger

If `gemini-3.1-flash-lite-preview` graduates to GA with a pricing cut (Google's typical post-preview pricing pattern), or if the 3× preview premium persists >90 days, evaluate:
1. Re-route trivial callers to `gemini-3-flash` (GA, flat cost) and accept the slight token budget increase.
2. Cache-more-aggressively: bump TTLs on `wardrobe_aging`, `style_twin`, `summarize_day` from current 30min-12h to 24-48h.

---

## 7. Phase-by-phase breakdown

Each phase is a single PR unless noted. Verification bar (per root CLAUDE.md Fix Protocol) applies to every PR: `tsc --noEmit --skipLibCheck`, `eslint --max-warnings 0`, `npm run build`, `vitest run`, `deno check` on every touched edge function, code-reviewer subagent, Codex review loop.

### Phase 1 — Shared Vertex client + auth shim

**Scope:**
- New `supabase/functions/_shared/vertex-auth.ts` (~150 LOC): SA-JSON → JWT (RS256 via `crypto.subtle`) → OAuth token exchange → in-memory cache + auto-refresh. Unit tests for JWT construction, token TTL math, 401-retry flow.
- Rewrite `supabase/functions/_shared/burs-ai.ts` transport:
  - Swap `GEMINI_URL` → Vertex endpoint with `GCP_PROJECT_ID` + `GCP_LOCATION` from env.
  - Replace `x-goog-api-key` with `Authorization: Bearer <token>` fetched via `getVertexAccessToken()`.
  - Internal adapter: convert `messages[]` ↔ `contents[].parts[]` on request; convert `choices[0].delta` ↔ `candidates[0].content.parts` on response. Callers continue passing OpenAI-shaped `messages[]`.
  - Update `COMPLEXITY_CHAINS` to new model IDs.
  - Preview-model fallback logic (§5.1) wired into the retry chain.
  - SSE streaming adapter (§4.4) that converts Vertex `streamGenerateContent` frames to OpenAI-style deltas AND injects keepalive pings.
- Update `supabase/functions/_shared/scale-guard.ts` `estimateCost()` pricing map for all three target models.
- **Deploy: none.** The new code paths are unreached by any function until Phase 2 starts flipping callers. This phase ships as "code on main, no behavior change."

**Gate before Phase 2:** unit tests green, `deno check` green, a manual dev-console test from the worktree shell that calls `getVertexAccessToken()` against the real GCP project and succeeds.

**Estimated effort:** 1-2 days.

### Phase 2 — Tier 1 (5 functions, 1 PR)

**Scope:** flip `wardrobe_aging`, `style_twin`, `summarize_day`, `wardrobe_gap_analysis`, `prefetch_suggestions` to the new transport. Model IDs update automatically via `COMPLEXITY_CHAINS`.

**Deploy:** 5 functions.

**Regression verification:**
- Smoke-local suite passes (local Supabase + Vertex mock).
- Manual spot-check: trigger each function from the dev console, confirm response envelope shape matches prior outputs (`.gaps`, `.summary`, etc.).
- 24h prod observation: `analytics_events.metadata.fallback_from_preview` rate, P95 latency, error rate.

**Gate before Phase 3:** 24h of clean prod telemetry.

**Estimated effort:** 0.5 day.

### Phase 3 — Tier 2 (7 functions, 2 PRs)

**Split by multimodal:**
- **PR 3-A (non-multimodal):** `detect_duplicate_garment`, `suggest_accessories`, `suggest_outfit_combinations`, `clone_outfit_dna`, `travel_capsule`.
- **PR 3-B (multimodal):** `visual_search`, `assess_garment_condition`. These two also exercise the §4.3 image-tokenization changes — benchmark `max_tokens` before/after the swap and adjust if needed.

**Deploy:** 5 + 2 = 7 functions total.

**Gate before Phase 4:** 24h of clean telemetry after PR 3-B.

**Estimated effort:** 1 day.

### Phase 4 — Tier 3 hot path (8 PRs, one per function + 1 prep-only PR)

**Order (riskiest last):**

1. **PR 4-1: `analyze_garment`** — enrichment is idempotent-re-runnable (the job queue can re-enrich any garment), so regressions are recoverable.
2. **PR 4-2: `outfit_photo_feedback`** — multimodal (selfie + garments); most complex image-heavy call. Benchmark token budget.
3. **PR 4-3: `burs_style_engine`** — core outfit generation. Regressions here hurt the entire outfit UX.
4. **PR 4-4: `generate_outfit`** — thin shim over `burs_style_engine`; trivial to migrate once `burs_style_engine` is stable.
5. **PR 4-5: `mood_outfit`** — streaming + hardcoded keepalive constants. First PR to exercise the new SSE adapter's keepalive-injection guarantee end-to-end. Single-turn, no signature concern.
6. **PR 4-6: Thought-signature plumbing (prep-only, no function flip)** — lands the `chat_messages.thought_signature TEXT NULL` migration + producer/consumer logic in `_shared/burs-ai.ts` so the next two PRs have a working signature path. No function's transport flips in this PR — `shopping_chat` and `style_chat` continue calling AI Studio + 2.5 Flash. Acceptance gate: adapter correctly captures `thought_signature` from any assistant turn (dry-run against Vertex mock) AND replays it on the next user turn; pre-migration `chat_messages` rows with `NULL` pass through unchanged.
7. **PR 4-7: `shopping_chat`** — streaming. Uses `streamBursAI()` generic keepalive. Signature plumbing from PR 4-6 already active.
8. **PR 4-8: `style_chat`** — LAST. Largest function (~2300 LOC), all four modes (OUTFIT_GENERATION / FOLLOW_UP / KNOWLEDGE / CONVERSATIONAL). Signature plumbing from PR 4-6 already active.

**Why the split (Codex P1 on PR #667):** originally this phase was 7 PRs with the `chat_messages.thought_signature` migration bundled into the final `style_chat` PR. That meant `shopping_chat` (PR 4-6 in the old order) would have flipped to Gemini 3 for 24h WITHOUT the signature column or adapter — every multi-turn shopping conversation in that window would silently degrade or error. Splitting out the plumbing as PR 4-6 (prep-only, no function flip) lands the safety net before either chat function flips.

**Per-PR gate:** 24h clean telemetry AND no user-reported regressions on that specific flow. PR 4-6 has a manual-QA gate (dry-run signature capture + replay against the Vertex mock) rather than a telemetry gate, since no function flips.

**Estimated effort:** 4-6 days total (including 24h cooldown between PRs 4-5 through 4-8; PR 4-6 has a short gate because no prod impact).

### Phase 5 — Image generation (1 PR)

**Scope:**
- `supabase/functions/_shared/gemini-image-client.ts` — swap `GEMINI_IMAGE_MODEL` to `gemini-3.1-flash-image-preview`, swap endpoint + auth to Vertex.
- `supabase/functions/_shared/render-eligibility.ts` — swap `GEMINI_TEXT_MODEL` to `gemini-3-flash`, swap endpoint + auth to Vertex.
- `RENDER_PROMPT_VERSION` v2 → v3 (§4.6).
- Regenerate visual quality benchmark: run Nano Banana 2 against the existing 6 category prompt variants (ghost_mannequin / shoes / bag / flat_lay / jewelry / accessory_generic from Wave 3-B) on a sample of 20 garments. Visual inspection for logo preservation, color fidelity, mannequin rejection accuracy.

**Deploy:** `render_garment_image`, `generate_garment_images`, `generate_flatlay` (3 functions + the two shared modules bundled into each).

**Rollback:** Phase 5 is a single PR. Revert + redeploy if visual quality regresses.

**Gate before Phase 6:** 48h of clean telemetry (image gen has longer feedback latency than text — users notice bad renders on a 1-2 day lag).

**Estimated effort:** 1-1.5 days.

### Phase 6 — Cleanup (1 PR)

**Scope:**
- Remove the OpenAI-compatible adapter layer inside `_shared/burs-ai.ts` now that all callers are on Vertex-native.
- Remove `GEMINI_API_KEY` secret from Supabase (after 7-day stability window).
- Remove `GEMINI_URL_OVERRIDE` / `GEMINI_IMAGE_URL_OVERRIDE` / `GEMINI_TEXT_URL_OVERRIDE` env-var handling from the three shared modules — replace with a single `VERTEX_URL_OVERRIDE` for the smoke-test mock server.
- Update `src/test/smoke/mocks/gemini.ts` → `src/test/smoke/mocks/vertex.ts` with new response shapes matching Vertex REST.
- Update Root `CLAUDE.md` Project Identity section, line 1029: "AI" cell becomes:
  > Gemini 3.x via Vertex AI (`aiplatform.googleapis.com`, region `europe-west4`, SA OAuth). Models: `gemini-3-flash` (complex), `gemini-3.1-flash-lite-preview` (trivial/standard), `gemini-3.1-flash-image-preview` / "Nano Banana 2" (image generation).
- Update `supabase/functions/CLAUDE.md` §"AI Calls" routing table with new model IDs + new env-var list.
- Findings Log review: any findings deferred during Phases 2-5 that belong in Wave 11 go into a "Scheduled: Wave 11" annotation; anything trivial closes here.

**Deploy:** All 22 AI functions (shared-module change radius).

**Estimated effort:** 1 day.

### 7.1 Total effort envelope

**~7-10 working days** from Phase 1 start to Phase 6 close, assuming no major Codex / code-reviewer blockers and the preview-model APIs don't shift during execution. Doubled contingency (14-20 days) given preview instability risk.

**Slot in plan:** Wave 10.5 — between Wave 10 (RevenueCat + StoreKit) and Wave 11 (Launch Prep). The 2-3 week window between Wave 10 close and TestFlight submission (Wave 11 P80) fits the contingency envelope with ~1 week buffer for any emergent issues.

---

## 8. Open questions (resolve during Phase 1)

1. **Thought signatures + function calling** — do 3.x tool-call loops require signature preservation across intra-request tool turns? (§4.2.) If yes, seven tool-using functions (`clone_outfit_dna`, `mood_outfit`, `suggest_outfit_combinations`, `wardrobe_gap_analysis`, `travel_capsule`, `style_chat`, `burs_style_engine`) need signature plumbing in their call loops. Resolve by reading Vertex AI 3.x function-calling docs before Phase 3.
2. **Preview-model quota ceilings** — what per-project QPS is Google willing to give us on `gemini-3.1-flash-lite-preview` in `europe-west4` for a pre-launch account? Submit quota request in Phase 1 so increases are approved before Phase 2 deploys.
3. **Nano Banana 2 aspect-ratio support** — does `gemini-3.1-flash-image-preview` still accept `imageConfig.aspectRatio: "4:5"` exactly as 2.5 Flash Image did? Verify in Phase 5 spike before committing to the image swap.
4. **Streaming keepalive frame format** — does Vertex's SSE transport accept bare `: keepalive\n\n` comment frames, or does it require a different keepalive convention? Verify with a live `curl` against `streamGenerateContent?alt=sse` in Phase 1.

---

## 9. Related docs

- **Execution tracker:** `CLAUDE.md` § Launch Plan (Wave 10.5 prompts reference this plan).
- **Per-prompt specs:** `LAUNCH_PLAN.md` § "Wave 10.5 — Vertex AI + Gemini 3 Migration".
- **Prior shared-module precedents:** Wave 2-C (L554 — `ai_response_cache` schema change bundled with 22-function redeploy) and Wave 3-B (Render-magic bundle — `RENDER_PROMPT_VERSION` bump with credit ledger invalidation). Same blast-radius pattern applies here.
