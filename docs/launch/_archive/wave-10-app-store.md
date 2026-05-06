## Wave 10 — RevenueCat + StoreKit IAP

Note: RevenueCat specifics decided at execution time based on current API.

### P70 — RevenueCat account + SDK install

- Create RevenueCat account
- `npm install @revenuecat/purchases-capacitor`
- Initialize SDK on app launch

---

### P71 — RevenueCat webhook → Supabase mirror

- New edge function `revenuecat_webhook` that receives RC events
- Mirrors subscription state to `subscriptions` table (same shape as Stripe webhook)

---

### P72 — Configure products in App Store Connect + RevenueCat

- Create monthly + yearly subscriptions in ASC
- Link in RevenueCat dashboard
- Match SKU names to Stripe product IDs for cross-platform consistency

---

### P73 — Client-side purchase flow

- `useRevenueCat` hook for Offerings, Purchase, CustomerInfo
- Integrate into PaywallModal

---

### P74 — Restore purchases flow

- Call `Purchases.restorePurchases()` on "Restore" button
- Update subscription state

---

### P75 — Dual-path billing resolver

- `useSubscription` detects platform (iOS vs other)
- iOS → RevenueCat
- Web/Android → Stripe (both write to same `subscriptions` table)

---

### P76 — iOS introductory offer

- Configure 3-day free trial as introductory offer in ASC
- Verify first-purchase triggers it
- Align with Stripe trial for parity

---

### P77 — Receipt validation defense endpoint

- New edge function `verify_iap_receipt` as defense-in-depth
- RevenueCat handles most, but endpoint allows independent verification

---

## Wave 10.5 — Vertex AI + Gemini 3 Migration (Pre-Launch)

Migrate BURS from **Google AI Studio + Gemini 2.5** → **Vertex AI (`aiplatform.googleapis.com`, region `europe-west4`, service-account OAuth) + Gemini 3.x**. Six phases, one PR per phase (Phase 4 splits into 7 per-function PRs due to hot-path risk).

**Model mapping:**
- `gemini-2.5-flash` → `gemini-3-flash` (GA)
- `gemini-2.5-flash-lite` → `gemini-3.1-flash-lite-preview` (**preview, no SLA**)
- `gemini-2.5-flash-image` → `gemini-3.1-flash-image-preview` ("Nano Banana 2", **preview, no SLA**)

**Full plan** — architecture, per-function audit (22 functions across 4 tiers), breaking changes (thinking_level rename, mandatory thought signatures, media tokenization, SSE keepalive preservation), risk flags (preview-model instability + per-request fallback to GA Flash, regional quota), cost impact (+0-8% blended per-user), 6-phase breakdown: see [`docs/VERTEX_MIGRATION_PLAN.md`](docs/VERTEX_MIGRATION_PLAN.md).

**Slot rationale:** After Wave 10 (RevenueCat + StoreKit) stabilizes subscriptions and before Wave 11 launch prep, so TestFlight beta runs on the final AI stack. The preview models require a ~2-3 week observation window, which fits the wave-10→wave-11 gap.

**Pre-requisites before P(V1) opens:**
- [ ] GCP project + service account provisioned with `roles/aiplatform.user` in `europe-west4`.
- [ ] Supabase vault secrets inserted: `GCP_SERVICE_ACCOUNT_JSON_B64`, `GCP_PROJECT_ID`, `GCP_LOCATION=europe-west4`.
- [ ] Edge-function env vars set via `supabase secrets set`.
- [ ] Vertex AI quota increase submitted for all three target models (`gemini-3-flash`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-flash-image-preview`) in `europe-west4`, sized to launch load × 3.

### P(V1) — Phase 1: Shared Vertex client + auth shim

**Problem**
All 22 Gemini-calling edge functions today authenticate with `GEMINI_API_KEY` against `generativelanguage.googleapis.com`. No shared OAuth machinery exists for Vertex AI.

**Fix**
1. New `supabase/functions/_shared/vertex-auth.ts`:
   - Read `GCP_SERVICE_ACCOUNT_JSON_B64` + base64-decode + parse.
   - Construct RS256 JWT with claims: `iss=sa.email`, `scope=https://www.googleapis.com/auth/cloud-platform`, `aud=https://oauth2.googleapis.com/token`, `iat=now`, `exp=now+3600`. Sign via `crypto.subtle.sign("RSASSA-PKCS1-v1_5", ...)`.
   - Exchange at `https://oauth2.googleapis.com/token` for Bearer access token.
   - In-memory token cache per isolate, 55-min TTL (refresh 5 min before 1h expiry).
   - Auto-refresh + retry on 401.
   - Export `getVertexAccessToken(): Promise<string>`.
2. Rewrite `supabase/functions/_shared/burs-ai.ts` transport:
   - Swap `GEMINI_URL` → `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${model}:generateContent` (and `:streamGenerateContent` for streaming).
   - Replace `x-goog-api-key` with `Authorization: Bearer ${await getVertexAccessToken()}`.
   - Internal adapter: OpenAI `messages[]` ↔ Gemini `contents[].parts[]` request; OpenAI `choices[0].delta` ↔ Gemini `candidates[0].content.parts` response.
   - Update `COMPLEXITY_CHAINS` + `MODEL_CHAINS` to new model IDs.
   - Per-model fallback on preview-specific errors: 503/502/504, schema 400, model-specific 429, empty `parts[]`, JSON.parse failure → advance to next chain link (always GA `gemini-3-flash` after Phase 2).
   - SSE streaming adapter: parse Vertex `data: {candidates...}` frames, convert to OpenAI-style deltas, inject `: keepalive\n\n` pings when Vertex is silent > 2s (preserves mood_outfit's KEEPALIVE_INTERVAL_MS=2000 contract).
3. Update `supabase/functions/_shared/scale-guard.ts` `estimateCost()` pricing map with per-1K-token prices for the three target models.
4. Unit tests: JWT construction + header shape, token cache TTL math, 401 → refresh + retry, OpenAI↔Gemini shape conversion, SSE keepalive injection on silent upstream.

**Files**
- `supabase/functions/_shared/vertex-auth.ts` (new)
- `supabase/functions/_shared/burs-ai.ts`
- `supabase/functions/_shared/scale-guard.ts`
- `supabase/functions/_shared/__tests__/vertex-auth.test.ts` (new)
- `supabase/functions/_shared/__tests__/burs-ai.test.ts` (extended)

**Acceptance**
- Unit tests pass (incl. 1-hour clock skew + 401-refresh scenarios).
- `deno check` green on `burs-ai.ts` + `vertex-auth.ts`.
- Manual: dev-console call to `getVertexAccessToken()` against real GCP project returns a valid token.
- No production caller invokes the new transport — code lands inert until Phase 2 ships.

**Deploy** none.

---

### P(V2) — Phase 2: Tier 1 (5 functions, one PR)

**Problem**
Tier-1 functions (cron/batch/low-volume) are the safest first flip target — low user-visibility regression cost, can be re-run if something breaks.

**Fix**
Flip to the new transport (no per-function code changes — callers all invoke `callBursAI()`, which picks up the new transport automatically):
- `wardrobe_aging`
- `style_twin`
- `summarize_day`
- `wardrobe_gap_analysis`
- `prefetch_suggestions`

Verify each function's complexity maps to the correct new model via `COMPLEXITY_CHAINS`.

**Files**
- `supabase/functions/_shared/burs-ai.ts` (deployment bundle refresh only; no code change in Tier-1 functions themselves)

**Acceptance**
- Smoke-local suite passes.
- Manual spot-check of each function's response envelope shape matches pre-migration outputs.
- 24h prod telemetry: `analytics_events.metadata.fallback_from_preview` rate < 5%, P95 latency delta within ±100ms.

**Deploy** 5 functions.

---

### P(V3) — Phase 3: Tier 2 (7 functions, two PRs)

**Problem**
Tier-2 functions are user-triggered but not in critical real-time UX. Multimodal (image-input) callers carry extra §4.3 risk from 3.x token-counting changes.

**Fix**
- **PR 3-A — non-multimodal:** `detect_duplicate_garment`, `suggest_accessories`, `suggest_outfit_combinations`, `clone_outfit_dna`, `travel_capsule`.
- **PR 3-B — multimodal + token budget benchmark:** `visual_search`, `assess_garment_condition`. Before merge, instrument `retrieval.input_tokens` logging on each; run representative-sample requests; adjust `max_tokens` if the image-token count materially shifts the budget.

**Files**
- Shared module redeploy via each function's bundle.

**Acceptance**
- Non-multimodal PR: 24h clean telemetry.
- Multimodal PR: 24h clean telemetry + no observed token-budget overruns in `analytics_events`.

**Deploy** 7 functions.

---

### P(V4) — Phase 4: Tier 3 hot path (8 PRs — one per function + one prep-only PR)

**Problem**
Tier-3 functions own the core user-visible UX. A regression on any of them (style_chat silently degrading mid-conversation, generate_outfit producing incomplete outfits, analyze_garment misclassifying a freshly-added garment) is high-cost. One PR per function caps blast radius.

**Fix — PR sequence (riskiest last):**

**PR 4-1 — `analyze_garment`.** Enrichment is idempotent-re-runnable via job queue. Rollback cost: low.

**PR 4-2 — `outfit_photo_feedback`.** Multimodal, image-heavy. Benchmark token budget before merge.

**PR 4-3 — `burs_style_engine`.** Core outfit generator. Monitor: 24h of `analytics_events` for outfit generation success rate, user acceptance (click-through on suggested outfits).

**PR 4-4 — `generate_outfit`.** Thin shim over burs_style_engine. Trivial.

**PR 4-5 — `mood_outfit`.** Streaming + hardcoded keepalive. First end-to-end exercise of the new SSE adapter's keepalive injection against a real preview model. Single-turn — no signature concern.

**PR 4-6 — Thought-signature plumbing (prep-only, NO function flip).** Per Codex P1 on PR #667 — lands the `chat_messages.thought_signature TEXT NULL` schema migration + producer/consumer logic in `_shared/burs-ai.ts` BEFORE either chat function flips. `shopping_chat` + `style_chat` continue calling AI Studio + 2.5 Flash at this point. Contents:
1. Migration `supabase/migrations/<ts>_chat_messages_thought_signature.sql` — `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS thought_signature TEXT`. Nullable. No backfill (pre-migration rows aren't 3.x conversations).
2. `_shared/burs-ai.ts` adapter captures `thought_signature` from Vertex assistant turns and replays it on the next user turn. Defensive null-handling for rows that predate the column.
3. Manual-QA gate: dry-run the adapter against the Vertex mock server — assert signature capture + replay works, pre-migration `NULL` rows pass through unchanged.

**PR 4-7 — `shopping_chat`.** Streaming, `streamBursAI` generic keepalive path. Signature plumbing from PR 4-6 already active.

**PR 4-8 — `style_chat`.** LAST. Largest function (~2300 LOC), all four modes (OUTFIT_GENERATION / FOLLOW_UP / KNOWLEDGE / CONVERSATIONAL). Signature plumbing from PR 4-6 already active.

**Why the 4-6 split:** originally Phase 4 was 7 PRs with the `thought_signature` schema + adapter bundled into the `style_chat` flip. That meant `shopping_chat` would have flipped to Gemini 3 for 24h WITHOUT the signature column or adapter — every multi-turn shopping conversation in that window would silently degrade or error. Splitting the plumbing as prep-only PR 4-6 lands the safety net before either chat function flips.

**Files**
- 7 per-function `index.ts` deploys (indirect — only shared module changed).
- `supabase/migrations/<ts>_chat_messages_thought_signature.sql` (new, ships in PR 4-6).
- `supabase/functions/_shared/burs-ai.ts` (signature handling lands in PR 4-6, unused until PR 4-7/4-8 flips activate the chat functions on Vertex).
- `src/pages/AIChat.tsx` + relevant hooks: likely untouched — thought_signature is server-side-only unless Phase 1 open-question resolution proves otherwise.

**Acceptance**
Each function-flip PR: 24h clean telemetry before the next merges. PR 4-6 has a manual-QA gate (signature dry-run) rather than telemetry since no function flips. Streaming PRs (4-5, 4-7, 4-8): manual multi-turn chat smoke test after deploy.

**Deploy** 7 functions across 8 PRs (PR 4-6 deploys no function — just migration + shared module update picked up on PR 4-7's bundle).

---

### P(V5) — Phase 5: Image generation + text gate (1 PR)

**Problem**
Image generation is the last text-free surface. Nano Banana 2 (`gemini-3.1-flash-image-preview`) is preview — visual quality must be verified before production flip, not after.

**Fix**
1. `_shared/gemini-image-client.ts` — swap `GEMINI_IMAGE_MODEL` to `gemini-3.1-flash-image-preview`. Swap `GEMINI_IMAGE_API_URL` to Vertex endpoint. Replace `x-goog-api-key` with `Authorization: Bearer ${await getVertexAccessToken()}`.
2. `_shared/render-eligibility.ts` — swap `GEMINI_TEXT_MODEL` to `gemini-3-flash`. Same endpoint + auth swap.
3. `render_garment_image/index.ts` — bump `RENDER_PROMPT_VERSION` v2 → v3 (same mechanism as Wave 3-B — invalidates stale credit reservations so in-flight v2 requests don't short-circuit the new pipeline).
4. **Visual quality benchmark** — run Nano Banana 2 on 20 garments across the 6 category variants from Wave 3-B (ghost_mannequin / shoes / bag / flat_lay / jewelry / accessory_generic). Manual inspection: logo preservation, color fidelity, mannequin-rejection accuracy. Attach before/after screenshot comparison in PR body.

**Files**
- `supabase/functions/_shared/gemini-image-client.ts`
- `supabase/functions/_shared/render-eligibility.ts`
- `supabase/functions/render_garment_image/index.ts` (RENDER_PROMPT_VERSION bump)

**Acceptance**
- Visual quality benchmark matches or beats 2.5 Flash Image baseline on all 6 variants.
- 48h clean telemetry post-deploy (image gen has 1-2 day user-feedback lag vs text).

**Deploy** `render_garment_image`, `generate_garment_images`, `generate_flatlay`.

---

### P(V6) — Phase 6: Cleanup + canonical doc flip (1 PR)

**Problem**
With all callers on Vertex + 3.x, the OpenAI-compat adapter + `GEMINI_API_KEY` + three `GEMINI_*_URL_OVERRIDE` env vars are dead weight. Canonical docs still describe AI Studio state.

**Fix**
1. Remove the OpenAI↔Gemini adapter layer in `_shared/burs-ai.ts` — every caller is now on Vertex-native internally, so the compat shim is unused.
2. Remove `GEMINI_API_KEY` secret from Supabase prod (only after 7-day post-Phase-5 stability window — the key is the emergency rollback lever until then).
3. Collapse `GEMINI_URL_OVERRIDE` + `GEMINI_IMAGE_URL_OVERRIDE` + `GEMINI_TEXT_URL_OVERRIDE` into a single `VERTEX_URL_OVERRIDE` for smoke-test mocking.
4. Rename + rewrite smoke-test mock: `src/test/smoke/mocks/gemini.ts` → `src/test/smoke/mocks/vertex.ts` with Vertex REST response shapes.
5. Flip canonical docs:
   - Root `CLAUDE.md` Project Identity "AI" cell → "Gemini 3.x via Vertex AI (`aiplatform.googleapis.com`, region `europe-west4`, SA OAuth). Models: `gemini-3-flash` (complex), `gemini-3.1-flash-lite-preview` (trivial/standard), `gemini-3.1-flash-image-preview` / 'Nano Banana 2' (image generation)."
   - `supabase/functions/CLAUDE.md` § "AI Calls" — rewrite routing table with new model IDs. Update "Required env variables" list.
6. Findings Log housekeeping: close any Wave 10.5 findings attributable to Phases 2-5, schedule remainders into Wave 11 if needed.

**Files**
- `supabase/functions/_shared/burs-ai.ts`
- `supabase/functions/_shared/gemini-image-client.ts` (rename env-var handling)
- `supabase/functions/_shared/render-eligibility.ts` (rename env-var handling)
- `src/test/smoke/mocks/vertex.ts` (new — replaces `gemini.ts`)
- `src/test/smoke/mocks/mock-server.ts` (route registration updates)
- `src/test/smoke/mocks/start-mock-server.ts` (env-var overrides)
- `.github/workflows/ci.yml` (env-var injection → single `VERTEX_URL_OVERRIDE`)
- `CLAUDE.md` + `supabase/functions/CLAUDE.md` (canonical doc flip)

**Acceptance**
- All 22 AI functions continue working end-to-end against prod Vertex + CI mock.
- `GEMINI_API_KEY` no longer referenced anywhere in the repo (grep clean).
- Smoke-local suite passes against the new Vertex mock.

**Deploy** All 22 AI functions (shared-module radius per Deploy Map).

---

