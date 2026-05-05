# Wave 8.5 P82 — Style Memory Audit (Implementation Note)

This document is the deliverable for prompt P82 of Wave 8.5 (Style Memory Bridge). It maps every memory / feedback-signal touchpoint in the BURS codebase as of `f9e3a6d5` (Wave 8 PR #705 — `main` head). Subsequent prompts (P83–P92) cite this document directly.

Scope of the audit: backend (`supabase/functions/`), frontend (`src/`), and the privacy/export/delete surface. Out of scope: design system, billing, auth.

---

## Headline Findings

1. **The backend has zero writers to `feedback_signals` and zero writers to `wear_logs`.** Every row in either table today was inserted by a frontend caller via supabase-js direct INSERT (RLS-allowed, authenticated). The backend is read-only against the canonical memory surfaces.
2. **The frontend has exactly one writer to `feedback_signals` — `useFeedbackSignals` — and exactly one consumer of that hook: `OutfitDetail.tsx`.** Six other surfaces that perform identical user actions (save / mark-worn / etc.) write to domain tables but never emit a feedback signal.
3. **The two AI engines read divergent subsets of `feedback_signals`.** `burs_style_engine` reads 8 distinct `signal_type` values (`save`, `swap`, `reject`, `dislike`, `thumbs_down`, `quick_reaction`, `ignore`, latent `wear`); `style_chat` only reads 4 (`swap`, `reject`, `dislike`, `thumbs_down`). A user who saves an outfit sees that signal reflected in outfit-generation scoring but invisible in the chat's prompt context.
4. **No persistent style summary table exists.** Both engines re-derive style context per request from `profiles.preferences.styleProfile`, with extraction logic that diverges across functions (12 keys in `burs_style_engine`, 27 keys in `style_chat`).
5. **No memory-ingestion helper exists.** No `_shared/style-memory-signals.ts`, no `_shared/style-memory-ingest.ts`, no `memory_ingest` edge function, no `record_pair` SQL RPC. The closest existing helper is `recordPairOutcome` in `_shared/outfit-scoring.ts:537-592`, invoked through `burs_style_engine?mode=record_pair`.
6. **Privacy export covers 3 tables** (`profiles`, `garments`, `outfits`+`outfit_items`). 12 user-authored / memory-relevant tables are missing.
7. **`delete_user_account` already cascades 24 tables explicitly** (very comprehensive). Only the future `user_style_summaries` table needs to be added in P90; the existing cascade also auto-handles 4 memory-adjacent tables via FK (`swap_events`, `user_style_profiles`, `outfit_reactions`, `inspiration_saves`) — explicit deletes are recommended for parity but not required.
8. **No "Reset style memory" path exists.** No edge function, no UI control. P90 builds it from scratch.

---

## Existing Memory Helpers (inventory)

| Question | Answer |
|---|---|
| `_shared/style-memory-signals.ts` exists? | **No.** |
| `_shared/style-memory-ingest.ts` exists? | **No.** |
| `_shared/record-pair.ts` exists? | **No.** |
| `memory_ingest` edge function exists? | **No.** |
| `record_pair` SQL RPC in any migration? | **No** — `record_pair` is an HTTP-mode discriminator inside `burs_style_engine`, not an RPC. |
| `user_style_summaries` table? | **No** — built in P84. |
| Closest reusable helper | `recordPairOutcome(serviceClient, userId, garmentIds, positive)` at `supabase/functions/_shared/outfit-scoring.ts:537-592`. Iterates all (i,j) pairs, sorts each lexicographically, then SELECT-then-UPDATE-or-INSERT. **N×(N−1)/2 round-trips per call** — fine for outfit-sized arrays (3-5 garments → 3-10 pairs); likely worth rewriting as a single SQL RPC with `INSERT ... ON CONFLICT DO UPDATE` if Wave 8.5 reuses it heavily. |

---

## Section 1 — Where Feedback Signals Are CREATED

### 1a. Backend writers

**Zero.** Verified by grep `\.insert.*feedback_signals`, `\.from\(.feedback_signals.\)\.insert`, `\.upsert.*feedback_signals` across `supabase/functions/`. No matches.

The only backend reference to `feedback_signals` apart from reads is one DELETE in the `delete_user_account` cascade.

### 1b. Frontend writers

| File:line | event_type written | Flow it serves |
|---|---|---|
| `src/hooks/useFeedbackSignals.ts:40-49` (canonical writer hook) | whatever caller passes in `signal_type` | generic insert; fire-and-forget; no toast on failure |
| `src/pages/OutfitDetail.tsx:196-202` | `swap_choice` (legacy) | swap garment in saved outfit |
| `src/pages/OutfitDetail.tsx:216` | `save` / `unsave` (legacy) | toggle save on outfit detail |
| `src/pages/OutfitDetail.tsx:229` | `rating` (legacy) | rate outfit 1-5 |
| `src/pages/OutfitDetail.tsx:247` | `quick_reaction` (canonical) | thumbs reactions on detail page |
| `src/pages/OutfitDetail.tsx:260` | `wear_confirm` (legacy) | mark outfit as worn from detail page |

**Only `OutfitDetail.tsx` calls `useFeedbackSignals`.** Verified by grep `\.from\(['"]feedback_signals['"]` returning a single match in `useFeedbackSignals.ts:41`.

`useFeedbackSignals.SignalType` declares 10 names (`useFeedbackSignals.ts:9-19`): `save`, `unsave`, `ignore`, `wear_confirm`, `swap_choice`, `quick_reaction`, `rating`, `garment_edit`, `planned_follow_through`, `planned_skip`. **Only 6 of those 10 are emitted in production code** (`save`, `unsave`, `swap_choice`, `quick_reaction`, `rating`, `wear_confirm`, all from `OutfitDetail.tsx`). `ignore`, `garment_edit`, `planned_follow_through`, `planned_skip` are dead enum members whose user actions exist but emit no signal.

---

## Section 2 — Where Feedback Signals Are CONSUMED

### 2a. Backend readers

| File:line | Filter | Used for |
|---|---|---|
| `supabase/functions/burs_style_engine/index.ts:898-903` | `.eq('user_id').order('created_at',desc).limit(200)` — no signal_type filter at SELECT, filtering in JS at lines 965 / 980 / 995 / 1004 | builds `feedbackSignals: FeedbackSignal[]` array → outfit scoring. `'quick_reaction'`→tagged feedback (line 965); `'save'`→3.5/5 mild positive (line 980); `'swap'/'reject'/'dislike'/'thumbs_down'`→1/5 strong negative on the specific garment (line 995); `'ignore'`→2.5/5 mild negative on all outfit garments (line 1004). Decayed by `generatedAt`. |
| `supabase/functions/style_chat/wardrobe-context.ts:185-192` | `.eq('user_id').in('signal_type', ['swap','reject','dislike','thumbs_down']).order('created_at',desc).limit(8)` | builds the "RECENT REJECTIONS/SWAPS" prompt block. Iterates each signal and reads `metadata.slot`, `metadata.reason`, `metadata.swapped_garment_title`, `metadata.replacement_title`. |
| `supabase/functions/style_chat/index.ts:1203-1207` | reads `rejectionsCtx.raw` (already pre-filtered to 4 types) | counts `s.signal_type === 'reject'` (≥1) and `s.signal_type === 'wear'` (≥3) to decide whether to inject `tasteMemoryBlock`. **Note: `'wear'` count is always 0** — the upstream `getRejectionsContext` filters it out. Latent dead path. |
| `supabase/functions/style_chat/wardrobe-context.ts:212-263` | reads from `RawSignal[]` passed in (already filtered) | `buildTasteMemoryBlock()` derives 4 prompt insights (repeated slot swaps, repeatedly-unworn color, signature archetype, casual lean). |

**Coverage gap**: `burs_style_engine` reads 8 distinct `signal_type` values; `style_chat` reads only 4. The two functions weight the same user history differently. This is the central Wave 8.5 unification target.

### 2b. Frontend readers

**Zero.** No `src/` selectors / hooks / insights computations read `feedback_signals` rows back. The frontend treats `feedback_signals` as a write-only sink.

`useFeedbackSignals.ts:53-57` branches on `input.signal_type === 'wear_confirm'` / `=== 'swap_choice'` to choose a toast string — that's a branch on the input parameter, not a DB read.

**Implication**: any aggregate the user might want to see (e.g. "you saved 12 outfits this month") cannot be rendered by the frontend today without an edge-function detour. Wave 8.5 P88+P89 + the new `user_style_summaries` table is the logical surface for read-back.

---

## Section 3 — Where Pair Memory Is WRITTEN

### 3a. Backend writers

| File:line | Triggered by | Operation |
|---|---|---|
| `supabase/functions/burs_style_engine/index.ts:763-776` | request body `{mode:"record_pair", garment_ids, positive}` (early-return path before rate-limit/scale-guard checks) | calls `recordPairOutcome(svc, userId, garmentIds, positive)` once for the full set |
| `supabase/functions/_shared/outfit-scoring.ts:537-592` (`recordPairOutcome`) | called from above | for each (i,j) pair (sorted lexicographically): SELECT existing row → UPDATE `positive_count++`/`negative_count++` + `last_positive_at`/`last_negative_at`; INSERT new row if absent. **+1 per call** when `positive=true`, **−1 per call** when `positive=false`. |

**Backend writers: exactly 1 path.** Everything else (frontend save / swap / wear / rate) bypasses the backend. The backend never derives pair memory from outfit-level events.

### 3b. Frontend writers

**Zero.** Verified by grep `garment_pair_memory` in `src/` — only matches in `src/integrations/supabase/types.ts` (auto-generated row types) and `src/lib/__tests__/pairMemoryScoring.test.ts` (mirrored scoring logic, not a writer).

---

## Section 4 — Where Pair Memory Is READ

### 4a. Backend readers

| File:line | Filter | Used for |
|---|---|---|
| `supabase/functions/burs_style_engine/index.ts:892-896` | `.eq('user_id').limit(500)` | `buildPairMemoryMap` (`outfit-scoring.ts:485`) → `getPairMemoryScore(garmentIds, pairMemory)` returns `{boost, penalty}` per outfit candidate. Boost log-capped at 3, penalty linear-capped at 4, 90-day recency decay. Used inside `scoreCombo`. |
| `supabase/functions/style_chat/index.ts:1180-1184` (positive) | `.eq('user_id').order('positive_count',desc).limit(50)` | top 50 most-positive pairs |
| `supabase/functions/style_chat/index.ts:1185-1191` (negative) | `.eq('user_id').gt('negative_count',0).order('negative_count',desc).limit(20)` | top 20 negative pairs |
| `supabase/functions/style_chat/index.ts:1213-1244` | uses both queries above | builds `pairMemoryText` prompt block — top 5 with `positive>negative` rendered as "+ Title A + Title B"; top 4 with `negative≥2 AND negative>positive` as "✗ Title A + Title B". Injected as `LEARNED PAIRINGS` and `AVOID THESE COMBINATIONS` system blocks. |
| `supabase/functions/_shared/outfit-scoring.ts:485-535` (`buildPairMemoryMap`, `getPairMemoryScore`) | helper consumed by `burs_style_engine` above | pure scoring logic, no DB access |

### 4b. Frontend readers

**Zero.** Reads happen exclusively server-side. Frontend never inspects pair memory directly.

---

## Section 5 — Where User Profile / styleProfile Is READ

### 5a. Backend

| File:line | Read | # keys consumed | Used for |
|---|---|---|---|
| `supabase/functions/burs_style_engine/index.ts:862` | `.from('profiles').select('preferences, height_cm, weight_kg').single()` | 12 (gender, ageRange, styleWords, comfortVsStyle, adventurousness, favoriteColors, dislikedColors, paletteVibe, fit, layering, fabricFeel, primaryGoal) | `buildStyleContext(preferences)` (line 147-164) + `buildBodyProfile` (`outfit-scoring-body.ts:207-227`) |
| `supabase/functions/burs_style_engine/index.ts:149` | `const sp = preferences.styleProfile \|\| preferences;` | n/a | V3+V4 dual-path; preferences itself is fallback when styleProfile missing |
| `supabase/functions/style_chat/index.ts:1167` | `.select('display_name, preferences, home_city, height_cm, weight_kg').single()` | **27** (gender, ageRange, climate, weekdayLife, workFormality, weekendLife, styleWords, comfortVsStyle, adventurousness, trendFollowing, genderNeutral, fit, layering, topFit, bottomLength, favoriteColors, dislikedColors, paletteVibe, patternFeeling, shoppingMindset, sustainability, capsuleWardrobe, wardrobeFrustrations, styleIcons, hardestOccasions, fabricFeel, signaturePieces, primaryGoal, morningTime, freeNote) | inline `if (sp)` block at lines 1268-1311 producing prompt prose |
| `supabase/functions/shopping_chat/index.ts:194` | `const sp = preferences.styleProfile;` | 13 | shopping prompt prose |
| `supabase/functions/suggest_outfit_combinations/index.ts:106` | `const sp = preferences.styleProfile \|\| {};` | 7 (gender, ageRange, climate, styleWords, favoriteColors, fit, primaryGoal) | pipe-separated styleContext line in prompt |
| `supabase/functions/_shared/outfit-scoring.ts:603-605` (`getStylePrefs`) | helper extracting `prefs?.styleProfile \|\| prefs` | 6 (favoriteColors, dislikedColors, styleWords, paletteVibe, comfortVsStyle, fit) | `styleAlignmentScore` |
| `supabase/functions/_shared/outfit-scoring-body.ts:211` | `const sp = prefs.styleProfile \|\| prefs;` | 1 (fit) | `BodyProfile.fitPreference` |
| `supabase/functions/travel_capsule/index.ts:492-496` | `.select('preferences')` — loaded but **never read into styleProfile** | 0 | dead read or relic |

**Functions that DON'T read styleProfile but probably should** (Wave 8.5 candidates): `mood_outfit`, `clone_outfit_dna`, `suggest_accessories`, `wardrobe_aging`, `wardrobe_gap_analysis`, `style_twin`. Today they only see garments; expressed preferences never enter the prompt or scoring.

**No backend code reads `preferences.styleProfileV4`.** V4 users have V3 mirror keys written via `migrateV4ToV3Compat` (frontend, on save); the backend is V4-blind.

### 5b. Frontend

| Reader | File:line | Use |
|---|---|---|
| Onboarding write path (NOT a read) | `src/pages/Onboarding.tsx:294-336` | writes `preferences.styleProfile` after quiz via `migrateV4ToV3Compat` |
| `SettingsStyle` page | `src/pages/settings/SettingsStyle.tsx:116-117` (read) + `:230,351` (write) | reads `prefs.styleProfile`, edits, writes back via `updateProfile.mutateAsync({ preferences: { ...prefs, styleProfile: newSp }})` |
| Style chat archetype hint | `src/pages/AIChat.tsx:817` | `archetype: styleDNA?.archetype ?? null` — passes a CLIENT-DERIVED archetype (from `useStyleDNA`, not from preferences.styleProfile) into `style_chat` body |
| `useStyleDNA` (computes from `wear_logs`, NOT styleProfile) | `src/hooks/useStyleDNA.ts:33-198` | client-side derivation; does NOT touch preferences.styleProfile |
| StyleQuizV4 | `src/components/onboarding/StyleQuizV4.tsx:41` | imports types from `@/types/styleProfile`; produces `StyleProfileV4` value passed to `Onboarding.handleQuizComplete` |

**Important**: NO frontend AI invocation passes `styleProfile` directly in the request body. Every AI function reads it server-side from `profiles.preferences.styleProfile`. Implication: Wave 8.5 P88+P89 can switch the engines to read `user_style_summaries` server-side without touching any client code.

---

## Section 6 — Flows That DO NOT Update Memory Correctly

### 6a. Save outfit (8 surfaces, 7 broken)

| Surface | Handler file:line | Persists to | Emits feedback_signal? |
|---|---|---|---|
| OutfitDetail toggle | `src/pages/OutfitDetail.tsx:211-221` | `outfits.saved` UPDATE | ✅ `save`/`unsave` (legacy names) |
| OutfitGenerate after generate | `src/pages/OutfitGenerate.tsx:335-347` | `outfits.saved=true` UPDATE + `trackEvent('outfit_saved')` | ❌ |
| AIChat handleSaveFromChat | `src/pages/AIChat.tsx:1114-1161` | `outfits.insert({saved:true})` + outfit_items insert | ❌ |
| MoodOutfit auto-save on generate | `src/pages/MoodOutfit.tsx:172-183` | `outfits.insert({saved:true})` + analytics | ❌ |
| UnusedOutfits auto-creation | `src/pages/UnusedOutfits.tsx:97-108` | `outfits.insert({saved:true})` | ❌ |
| AISuggestions handleTryIt | `src/components/insights/AISuggestions.tsx:233-237` | `outfits.insert({saved:true})` | ❌ |
| TravelCapsule.addToCalendar | `src/components/travel/useTravelCapsule.ts:515-524` | `outfits.insert({saved:true})` (batch) | ❌ |
| useWeekGenerator | `src/hooks/useWeekGenerator.ts:138-150` | `outfits.insert({saved:true})` per day | ❌ |
| chat OutfitSuggestionCard local-save flag | `src/components/chat/OutfitSuggestionCard.tsx:79-87,143,348-349` | LOCAL state only — `setLocalSaved` and `onSave` callback up to AIChat | (depends on parent — AIChat is broken too) |

**P86 must wire `recordSignal({signal_type:'save_outfit'})` into 7 of these 8 surfaces.** OutfitDetail already does it (rename only).

### 6b. Mark as worn (5 surfaces, 4 broken)

| Surface | Handler file:line | Persists to | Emits feedback_signal? |
|---|---|---|---|
| OutfitDetail | `src/pages/OutfitDetail.tsx:254-278` | `outfits.worn_at` + counters + `wear_logs` (via `useMarkOutfitWorn`) | ✅ `wear_confirm` (legacy) |
| Plan calendar | `src/pages/Plan.tsx:149-174` | `wear_logs` + `useUpdatePlannedOutfitStatus({status:'worn'})` | ❌ |
| Home TodayOutfitCard swipe-right | `src/components/home/TodayOutfitCard.tsx:61-68` | `wear_logs` (via `useMarkOutfitWorn`) | ❌ |
| OutfitGenerate "Wear Today" | `src/pages/OutfitGenerate.tsx:421-438` | `wear_logs` (via `useMarkOutfitWorn`) | ❌ |
| GarmentDetail (single garment) | `src/pages/GarmentDetail.tsx:172-181` | `wear_logs` (via `useMarkGarmentWorn`) | ❌ |

Hooks that own these:
- `useMarkOutfitWorn` UPSERT batch — `src/hooks/useOutfits.ts:295-298`
- `useUndoMarkWorn` DELETE — `src/hooks/useOutfits.ts:326-329`
- `useMarkGarmentWorn` single INSERT — `src/hooks/useGarments.ts:427-433`

**P86 design choice**: instead of wiring `recordSignal` into 4 callers, P85's ingest path can consume `wear_logs` server-side as the wear-memory source-of-truth. Either approach works; the second is simpler if `wear_outfit` semantics map cleanly to a `wear_logs` row. Recommend the latter — `wear_logs` is already correctly persisted from every surface; treat each row as an implicit `wear_outfit` event during summary build.

### 6c. Skip planned outfit

**Flow does not exist as a UI action.** `useUpdatePlannedOutfitStatus` accepts `'skipped'` (`src/hooks/usePlannedOutfits.ts:13,132,182`) but no caller in `src/pages/Plan.tsx` or anywhere else fires it. P82 confirmed: status enum allows it; UI never triggers it. P86 needs to add the UI trigger AND the `skip_outfit` signal.

### 6d. Swap garment

| Surface | File:line | Persists | Signal? |
|---|---|---|---|
| OutfitDetail | `src/pages/OutfitDetail.tsx:193-209 → useSwapGarment.swapGarment → src/hooks/useSwapGarment.ts:221-228` | `outfit_items.garment_id` UPDATE | ✅ `swap_choice` (legacy) |
| AIChat OutfitSuggestionCard | `src/components/chat/OutfitSuggestionCard.tsx:137-140` | `setGarments(prev => prev.map(...))` — LOCAL STATE ONLY. NO database write, NO recordSignal. | **lost on reload** |

**Note on signal shape**: `swap_choice` from OutfitDetail does NOT include canonical `removed_garment_ids` / `added_garment_ids` arrays — it uses scalar `garment_id` (new) plus `metadata.replaced` (old). P83 should formalize the array format; P86 should switch the writer.

### 6e. Reject outfit

**Flow does not exist as an explicit user action.** Closest analogs are "Try Another" on TodayOutfitCard or chat re-prompt; neither writes a rejection signal. P86 needs UI + signal writer.

The backend `burs_style_engine:995` reads `signal_type='reject'` BUT the read path penalizes the **specific garment** in `sig.garment_id` — suggesting the historic semantic was garment-level rejection (akin to `never_suggest_garment`), not outfit-level. P83 should disambiguate: outfit-level → `reject_outfit`, garment-level → `never_suggest_garment` (or new `reject_garment`).

### 6f. Quick reaction

Only on OutfitDetail (`OutfitDetail.tsx:236-252` `handleFeedbackToggle` → `outfits.feedback` array UPDATE + `recordSignal({signal_type:'quick_reaction', value})`). Home, Plan, OutfitGenerate, AIChat all lack quick-reaction UI entirely. Note: removal of a previously-selected reaction does NOT emit a counter-signal.

### 6g. "Never suggest this"

**Does not exist anywhere.** No UI control, no signal, no equivalent. New work for Wave 8.5.

### 6h. Anchor / locked-slot decisions in chat

`src/pages/AIChat.tsx:511,535,886,1184,1312,1367` — `setAnchoredGarmentId`, `refineMode.toggleLock`. **Local state only — never persisted.** Sent inline to next AI call (`AIChat.tsx:818-836`) but never written to `feedback_signals`. A user that locks "always keep these jeans" loses the signal as soon as the chat session ends. Highest-leverage gap from a memory-quality perspective.

### 6i. style_chat-derived preferences

`style_chat` infers user preferences from chat ("I want minimal vibes", "I hate brown") via prompt context — **does NOT persist any inference.** Conversation context evaporates after the turn. P89 lifts this into structured signal writes.

### 6j. record_pair mode

`burs_style_engine:763-776` writes `garment_pair_memory` but does NOT write a `feedback_signals` row. Pair memory updates but the originating user action is invisible to `style_chat`'s `getRejectionsContext`. P85's `memory_ingest` should bundle both writes atomically.

### 6k. outfit_photo_feedback

`supabase/functions/outfit_photo_feedback/index.ts:141-156` INSERTs into a SEPARATE `outfit_feedback` table. The 3 numeric scores (`fit_score`, `color_match_score`, `overall_score`) never enter `feedback_signals` and never reach the engines. Two parallel feedback layers that never merge. P85 should either bridge or treat as an independent surface (recommend: keep separate but include in P90 export).

### 6l. process_job_queue / daily_reminders / calendar

- `process_job_queue` enriches garment AI metadata but does NOT update memory after acting.
- `daily_reminders:99-116` reads `planned_outfits` for today/tomorrow but does NOT detect "planned but not worn" → `burs_style_engine:904-912` later reads "missed" plans by time-comparison, but **nothing in the backend ever flips status to `'missed'`** — purely time-based, no signal row materialized.
- `calendar` syncs events but writes no taste signals.

### 6m. burs_style_engine wear_logs synthesis

`burs_style_engine:1024-1032` injects every `wear_log` row as a synthetic `rating:5, feedback:['loved_it']` signal **in-memory each call**. Two calls re-run the same projection. Not a bug, but P87's deterministic summary builder can shortcut by reading a pre-rolled aggregate.

### 6n. burs_style_engine signal cap

`burs_style_engine:898` reads `feedback_signals.limit(200)`. A heavy user (>200 events) silently loses oldest signals from scoring. No paging, no aggregation. P87's `user_style_summaries` builder needs to roll up before this cap bites.

---

## Section 7 — Signal Name Inconsistencies (drives P83 normalize map)

The backend READS exactly 8 distinct `signal_type` values: `quick_reaction`, `save`, `swap`, `reject`, `dislike`, `thumbs_down`, `ignore`, latent `wear`. The frontend WRITES exactly 6: `save`, `unsave`, `swap_choice`, `quick_reaction`, `rating`, `wear_confirm`. **None of the canonical Wave 8.5 names are emitted today.**

### 7a. Required normalize map for `normalizeStyleMemorySignal` (P83)

| Legacy / current | Where used | Canonical |
|---|---|---|
| `save` | written `useFeedbackSignals.ts:10` + `OutfitDetail:216`; read `burs_style_engine:980` | `save_outfit` |
| `unsave` | written `useFeedbackSignals.ts:11` + `OutfitDetail:216` | `unsave_outfit` |
| `wear_confirm` | written `useFeedbackSignals.ts:13` + `OutfitDetail:260` | `wear_outfit` |
| `swap_choice` | written `useFeedbackSignals.ts:14` + `OutfitDetail:197` | `swap_garment` |
| `rating` | written `useFeedbackSignals.ts:16` + `OutfitDetail:229` | `rate_outfit` |
| `quick_reaction` | written `useFeedbackSignals.ts:15` + `OutfitDetail:247` | `quick_reaction` (passthrough — already canonical) |
| `swap` | read-only `burs_style_engine:995` + `wardrobe-context.ts:190` | `swap_garment` |
| `reject` | read-only `burs_style_engine:995` + `wardrobe-context.ts:190` | **disambiguation needed** — outfit-level → `reject_outfit`; garment-level (current semantic, penalizes `sig.garment_id`) → `never_suggest_garment` |
| `dislike` | read-only `burs_style_engine:995` + `wardrobe-context.ts:190` | likely `quick_reaction` (with `value='dislike'`) |
| `thumbs_down` | read-only `burs_style_engine:995` + `wardrobe-context.ts:190` | `quick_reaction` (with `value='dislike'`) |
| `ignore` | read-only `burs_style_engine:1004`; in dead enum `useFeedbackSignals.ts:12` | `skip_outfit` |
| `wear` | latent dead read `style_chat:1206` (filtered out before reach) | `wear_outfit` |
| `planned_skip` | dead enum `useFeedbackSignals.ts:19` (never emitted) | `skip_outfit` |
| `planned_follow_through` | dead enum `useFeedbackSignals.ts:18` (never emitted) | `wear_outfit` |
| `garment_edit` | dead enum `useFeedbackSignals.ts:17` (never emitted) | (no canonical match — drop or map to new `edit_garment`) |
| `like` | (none found in code; mentioned in P82 spec) | `quick_reaction` (with `value='like'`) |
| `saved` | (none found in code; mentioned in P82 spec) | `save_outfit` (alias) |

### 7b. Test fixtures using legacy names

`src/hooks/__tests__/useFeedbackSignals.test.tsx:49,60,66,76,87` — references `'save'`, `'wear_confirm'`, `'ignore'`. Must be updated when P83 ships. `supabase/functions/style_chat/__tests__/` (TBD — search) likely contain similar.

### 7c. Cross-reader divergence (the central problem)

| Canonical name | Backend writer? | Backend reader? | Where |
|---|---|---|---|
| `swap_garment` | No | partial — reads `'swap'` | burs_style_engine:995, wardrobe-context.ts:190 |
| `wear_outfit` | No | latent dead — reads `'wear'` | style_chat:1206 (filtered out before reach) |
| `save_outfit` | No | partial — reads `'save'` | burs_style_engine:980 only |
| `skip_outfit` | No | partial — reads `'ignore'` | burs_style_engine:1004 only |
| `reject_outfit` | No | partial — reads `'reject'` (garment-level) | burs_style_engine:995, wardrobe-context.ts:190 |
| `rate_outfit` | No | No (reads `outfits.rating` column directly, not as a signal row) | burs_style_engine:870-876 |
| `quick_reaction` | No | yes — exact name | burs_style_engine:965 |
| `never_suggest_garment` | No | No | — |
| `like_pair` | No (pair_memory only via `record_pair` boolean) | No (boolean only) | — |
| `dislike_pair` | No (pair_memory only via `record_pair` boolean) | No (boolean only) | — |

**Six of ten canonical names are partially read under non-canonical aliases; four are not read at all. Zero are written by the backend today.**

---

## Section 8 — Privacy / Export Gaps (drives P90)

### 8a. Currently exported (3 tables)

`src/pages/settings/SettingsPrivacy.tsx:63-83` (`handleExportData`) — runs 3 SELECTs in parallel:

| # | Table | Source | Filter |
|---|---|---|---|
| 1 | `garments` | `SettingsPrivacy.tsx:68` | `user_id = userId` |
| 2 | `outfits` (with embedded `outfit_items`) | `SettingsPrivacy.tsx:69` | `user_id = userId` |
| 3 | `profiles` | `SettingsPrivacy.tsx:70` | `id = userId` |

Output JSON shape (line 72): `{ profile, garments, outfits, exportedAt }`. Filename: `burs-export-YYYY-MM-DD.json` (line 77).

### 8b. Tables to ADD in P90

| Priority | Table | Reason |
|---|---|---|
| **P0** | `user_style_summaries` (post-P84) | canonical persistent memory; spec acceptance |
| **P0** | `feedback_signals` | core memory surface; Wave 8.5 makes canonical |
| **P0** | `garment_pair_memory` | core pair-memory surface |
| **P0** | `wear_logs` | primary explicit memory signal — GDPR portability |
| **P1** | `chat_messages` | user-authored content — GDPR portability |
| **P1** | `outfit_feedback` | explicit thumb ratings (separate table, not in `feedback_signals`) |
| **P1** | `outfit_reactions` | implicit reaction signals (P83 canonical) |
| **P1** | `swap_events` | swap history is canonical memory signal |
| **P1** | `planned_outfits` | calendar planning history |
| **P2** | `user_style_profiles` | legacy memory peer table; never been exported |
| **P2** | `inspiration_saves` | save-worthy looks signal |
| **P3** | `travel_capsules` / `challenge_participations` | nice-to-have |

**Skip-correctly**: `subscriptions`/`user_subscriptions` (Stripe is system-of-record), `render_*` (system-internal billing), `ai_response_cache` (short TTL), `analytics_events` (telemetry), `ai_rate_limits` (counters), `push_subscriptions` (device tokens — debatable).

---

## Section 9 — Delete Cascade Status (drives P90)

### 9a. Currently cascaded explicitly (24 tables + auth.users)

`supabase/functions/delete_user_account/index.ts` cascades these in order:

| Order | Table | Line |
|---|---|---|
| 0 | `storage.garments` (object remove) | 91-93 |
| 1 | `chat_messages` | 107 |
| 2 | `calendar_events` | 111 |
| 3 | `calendar_connections` | 112 |
| 4 | `planned_outfits` | 116 |
| 5 | `wear_logs` | 120-123 |
| 6 | `outfit_items` | 139-142 |
| 7 | `outfits` | 152-155 |
| 8 | `garments` | 164-167 |
| 9 | `subscriptions` | 176 |
| 10 | `user_subscriptions` | 177 |
| 11 | `checkout_attempts` | 178 |
| 12 | `user_roles` | 179 |
| 13 | `render_credit_transactions` | 192 |
| 14 | `render_jobs` | 193 |
| 15 | `render_credits` | 194 |
| 16 | `feedback_signals` | 197 |
| 17 | `garment_pair_memory` | 198 |
| 18 | `analytics_events` | 199 |
| 19 | `ai_rate_limits` | 200 |
| 20 | `outfit_feedback` | 203 |
| 21 | `push_subscriptions` | 206 |
| 22 | `travel_capsules` | 209 |
| 23 | `ai_response_cache` | 228 (P13 schema add) |
| 24 | `profiles` | 233-236 |
| 25 | `auth.admin.deleteUser(userId)` | 245 (cascades remaining FK rows) |

### 9b. Tables to ADD in P90

| Priority | Table | Reason |
|---|---|---|
| **P0** | `user_style_summaries` (post-P84) | spec acceptance: "delete_user_account must include user_style_summaries cleanup" |
| **P1** | `swap_events` | already FK-cascades but explicit-delete pattern matches feedback_signals; auditable |
| **P1** | `user_style_profiles` | already FK-cascades; same parity reasoning |
| **P1** | `outfit_reactions` | memory-adjacent, P83 canonical signal |
| **P2** | `inspiration_saves` | memory-adjacent |
| **P2** | `challenge_participations` | low priority |

All P1/P2 already FK-CASCADE on `auth.admin.deleteUser` (verified in `00000000000000_initial_schema.sql:1762-1982`); explicit deletes are parity, not strict acceptance.

P84 migration must include `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE` so the auth-deletion path also wipes summaries even if the explicit delete is missed.

---

## Section 10 — Reset Style Memory

**Verdict: does NOT exist.**

Searched `reset.*memory`, `clear.*memory`, `forget.*preferences`, `reset_style_memory`, `reset_preferences`, `clear_preferences`, `reset_feedback`, `clear_feedback`, `reset_style*` (case-insensitive, full-repo). No matches in production code (only `docs/launch/wave-8.5-style-memory.md` itself + design mockups + `ThemeContext` "reset to defaults" — false positives).

`SettingsPrivacy.tsx` has 4 collapsible sections (`'about' | 'data' | 'consent' | 'rights'` at line 28); none expose memory reset. The "Your Rights" Collapsible at lines 214-232 has Export + Delete Account but no reset path.

**P90 must build** `supabase/functions/reset_style_memory/` from scratch. Required scaffolding (matches BURS edge-function template):
- CORS preflight
- `checkOverload("reset_style_memory")`
- Manual `getUser()` JWT verification
- `enforceRateLimit` — recommend tight tier `{maxPerHour: 5, maxPerMinute: 1}` like `delete_user_account`
- DB-backed idempotency via `request_idempotency` (P12 helper) — destructive op, double-tap guard
- Service-role client for the deletes
- Explicit `.delete().eq("user_id", userId)` for: `feedback_signals`, `garment_pair_memory`, `user_style_summaries`, `user_style_profiles`
- Return `{ ok: true, tables_cleared: [...] }`

**P90 must NOT delete** (per spec lines 399-403): `garments`, `outfits`, `account/profile`, `planned_outfits`, `wear_logs`. (Wear logs are user-confirmed history, not inferred memory.)

UI changes (`SettingsPrivacy.tsx`): add a SettingsRow inside the existing "Your Rights" Collapsible (lines 214-232), wrapped in an AlertDialog matching the Delete Account pattern (lines 252-283). New i18n keys (append-only to en.ts + sv.ts):
- `settings.gdpr.reset_memory` (row label)
- `settings.gdpr.reset_memory_title` / `_warning` / `_what_clears` / `_what_preserves` / `_confirm` (dialog copy)
- `settings.gdpr.reset_success` / `_error` (toast strings)

`handleResetMemory` async handler invokes `invokeEdgeFunction('reset_style_memory', {...})`; on success invalidates React Query keys: `['feedback-signals', userId]`, `['style-summary', userId]` (TBD what the future hook keys are).

---

## Section 11 — Per-Prompt Implementation Scope

This section is the punch list subsequent prompts cite directly.

### P83 — `_shared/style-memory-signals.ts`

Build the canonical union + normalize helper. Required map (from §7a):

```typescript
const LEGACY_TO_CANONICAL: Record<string, CanonicalStyleMemorySignal | null> = {
  // canonical passthrough
  save_outfit: 'save_outfit',
  unsave_outfit: 'unsave_outfit',
  rate_outfit: 'rate_outfit',
  wear_outfit: 'wear_outfit',
  skip_outfit: 'skip_outfit',
  reject_outfit: 'reject_outfit',
  swap_garment: 'swap_garment',
  quick_reaction: 'quick_reaction',
  never_suggest_garment: 'never_suggest_garment',
  like_pair: 'like_pair',
  dislike_pair: 'dislike_pair',
  // legacy → canonical
  save: 'save_outfit',
  saved: 'save_outfit',
  unsave: 'unsave_outfit',
  rating: 'rate_outfit',
  wear_confirm: 'wear_outfit',
  wear: 'wear_outfit',
  planned_follow_through: 'wear_outfit',
  swap_choice: 'swap_garment',
  swap: 'swap_garment',
  ignore: 'skip_outfit',
  planned_skip: 'skip_outfit',
  reject: 'reject_outfit',         // disambiguation: see §6e — current backend semantic is garment-level; P83 should map to never_suggest_garment if the read site is updated in P88 lockstep, otherwise reject_outfit
  dislike: 'quick_reaction',       // value='dislike' on metadata
  thumbs_down: 'quick_reaction',   // value='dislike' on metadata
  like: 'quick_reaction',          // value='like' on metadata
  garment_edit: null,              // dead enum — drop
};
```

Open question for P83: the `reject` legacy name is the most loaded — current backend semantic (`burs_style_engine:995`) penalizes the **specific garment** (`sig.garment_id`), so it's already garment-level rejection. P83 should map `reject → never_suggest_garment` AND P88 must update the read site to look for the new canonical name. Alternative: keep `reject → reject_outfit` and treat it as outfit-level throughout, with the read site updated to check `outfit_id` instead of `garment_id`. The latter is safer (preserves outfit-level capacity); the former is closer to current behavior. **Recommend the latter** — outfit-level + add a separate `never_suggest_garment` for the new explicit "Never suggest this" UI in P86.

### P84 — `user_style_summaries` migration

Spec at `docs/launch/wave-8.5-style-memory.md:124-184` is canonical. Ship as `<ts>_user_style_summaries.sql`. FK: `user_id REFERENCES auth.users(id) ON DELETE CASCADE` (so the auth-deletion path auto-wipes orphans even if the P90 explicit delete is missed). RLS: user reads own + service_role manages.

### P85 — `memory_ingest` / shared helper

**Recommended shape**: build `_shared/style-memory-ingest.ts` exporting `ingestMemoryEvent(serviceClient, input)` and `recordPairOutcome` (lifted from `_shared/outfit-scoring.ts:537-592`). The function `burs_style_engine?mode=record_pair` continues to work but now delegates to the shared helper.

**Open architectural choice**: should there also be a `memory_ingest` edge function for client direct calls (RPC-style), or do clients keep direct INSERTs into `feedback_signals` via RLS?

- Option A — new edge function `memory_ingest`: client calls `supabase.functions.invoke('memory_ingest', {...})` for all memory writes. Server normalizes signals, writes feedback_signals + pair_memory + refreshes summary atomically. Centralized, auditable, validated.
- Option B — client-side `useFeedbackSignals` (current) + Postgres trigger on `feedback_signals` AFTER INSERT that normalizes + writes pair_memory + refreshes summary. Simpler frontend, fewer round-trips, but couples backend behavior to a trigger that's harder to debug.
- Option C — hybrid: `useFeedbackSignals` extended to call `memory_ingest` instead of direct INSERT. Frontend stays simple; server stays the validation gate.

**Recommend Option C.** It keeps the single hook signature, gates all writes through a validated path, gives Wave 8.5 P89's chat-side preference inference a natural home, and avoids trigger spaghetti. P85 deploy: new edge function `memory_ingest` + shared helper + 22-AI-function fanout (per `_shared/scale-guard.ts` Deploy Map if the helper imports it).

### P86 — wire flows

Files to update (per §6 verdicts):

```
Save outfit (7 callers to wire — recordSignal('save_outfit') after persist):
  src/pages/OutfitGenerate.tsx:335-347         handleSaveOutfit
  src/pages/AIChat.tsx:1114-1161               handleSaveFromChat
  src/pages/MoodOutfit.tsx:172-183             auto-save block
  src/pages/UnusedOutfits.tsx:97-108           auto-save block
  src/components/insights/AISuggestions.tsx:233-237  handleTryIt
  src/components/travel/useTravelCapsule.ts:515-524  addToCalendar
  src/hooks/useWeekGenerator.ts:138-150        per-day inserts
  src/components/chat/OutfitSuggestionCard.tsx:79-87,143  parent-side commit
  + rename OutfitDetail.tsx:216 'save'/'unsave' → canonical

Mark as worn (decision in P85):
  Option α — extend the 4 broken callers below to recordSignal('wear_outfit'):
    src/pages/Plan.tsx:149-174                 handleMarkWorn
    src/components/home/TodayOutfitCard.tsx:61-68  handleWearThis
    src/pages/OutfitGenerate.tsx:421-438       handleWearToday
    src/pages/GarmentDetail.tsx:172-181        handleMarkWorn (single garment)
  Option β — P85's summary builder treats every wear_logs row as a synthetic wear_outfit event. Don't wire anything frontend-side; rename OutfitDetail's 'wear_confirm' → no-op deprecated.
  Recommend β — wear_logs is correctly persisted from every surface today; treating it as the source of truth avoids 4 redundant INSERTs.

Skip planned outfit (P86 must add UI trigger AND signal):
  src/pages/Plan.tsx — no current handler. Add a swipe-left or context-menu action that calls useUpdatePlannedOutfitStatus({status:'skipped'}) AND recordSignal('skip_outfit').

Swap garment (1 broken):
  src/components/chat/OutfitSuggestionCard.tsx:137-140  handleSwap — currently local-only. Wire to backend: persist via a new mutation (analogous to useSwapGarment but for chat-suggested outfits not yet saved) AND recordSignal('swap_garment') with removed/added arrays.
  + rename OutfitDetail.tsx:197 'swap_choice' → 'swap_garment' AND format metadata as removed_garment_ids[] + added_garment_ids[]

Reject outfit (does not exist):
  Add UI trigger (Plan / Home / OutfitGenerate / chat). Decide outfit-level vs garment-level naming per P83 disambiguation.

Quick reaction (5 missing surfaces):
  Decision: extend to Home/Plan/OutfitGenerate/AIChat? Or scope-cap to OutfitDetail (current)? Recommend scope-cap unless UX brief says otherwise.

Never suggest this (does not exist):
  New UI on GarmentDetail (long-press? settings overflow?) → recordSignal('never_suggest_garment', {garment_id}).

Anchor / locked-slot decisions (HIGH LEVERAGE — local-only today):
  src/pages/AIChat.tsx:511,535,886,1184,1312,1367 — when user commits an anchor or lock, recordSignal('like_pair', {garment_ids:[anchor, ...locked]}) so the preference survives chat session end.

Tests to update for renames:
  src/hooks/__tests__/useFeedbackSignals.test.tsx:49,60,66,76,87
  + any supabase/functions/style_chat/__tests__/ that reference legacy signal names
```

### P87 — deterministic summary builder

`_shared/style-summary-builder.ts`. Inputs:
- `profiles.preferences.styleProfile` / `styleProfileV4`
- `garments` + `outfits` + `outfit_items`
- `wear_logs` (treat each row as `wear_outfit` event per §6m / §P86β)
- `feedback_signals`
- `garment_pair_memory`
- `planned_outfits` (status='skipped' → `skip_outfit` synthetic event; status='worn' covered by wear_logs)
- `outfit_feedback` (independent rating layer — see §6k)

Confidence rules: explicit feedback > repeated behavior > single event > AI inference. Minimum N=3 occurrences before promoting to `preferred_*` / `avoided_*`.

Output `summary_text` ≤500 chars.

Note: lift the inline 27-key extraction in `style_chat:1268-1311` and the 12-key extraction in `burs_style_engine:147-164` into a single `extractStyleProfileSnapshot(prefs)` helper called from the builder. Wave 8.5 = the moment those two divergent extractions converge.

### P88 — `burs_style_engine` reads `user_style_summaries`

Today's reads in `burs_style_engine/index.ts`:
- `:862` profile (preferences)
- `:892` `garment_pair_memory` (limit 500)
- `:898` `feedback_signals` (limit 200 — see §6n)
- `:904` `planned_outfits` (status='planned' AND date<today — for "missed outfit" inference)
- `:870-876` `outfits.rating`
- `:1024-1032` `wear_logs` synthesis

Add: SELECT `user_style_summaries` WHERE `user_id = ?` LIMIT 1. Cache per-request. Use the summary in scoring (boost preferred colors/fits/archetypes; penalize avoided; boost favorite_pairings; penalize avoided_pairings; respect avoid_rules as hard skip).

Hard rules: outfit completeness (top+bottom+shoes OR dress+shoes; outerwear weather-driven). Low-confidence (<0.3) memories: log + ignore.

If P85 ships Option C, the existing `feedback_signals.limit(200)` read becomes redundant once the summary covers the same surface. Decision for P88: keep the legacy read as a fallback during the rollout window, OR commit to summary-only and accept the rollout risk.

### P89 — `style_chat` reads `user_style_summaries`

Today's reads in `style_chat/index.ts`:
- `:1167` profile (27 keys extracted at 1268-1311)
- `:1180-1184` pair_memory positive (top 50)
- `:1185-1191` pair_memory negative (top 20)
- `wardrobe-context.ts:185-192` feedback_signals (4 types, limit 8)

Add: SELECT `user_style_summaries`. Replace the 27-key extraction with `summary_json` fields + `summary_text` injected as a single block.

Plus: when the user states clear preferences in chat ("I hate skinny jeans", "never suggest this", "more like this", "too formal"), call `memory_ingest` (P85) to persist as a normalized signal. Preserve the existing rejections-context block (`buildTasteMemoryBlock`) until the summary covers the same insights.

### P90 — privacy / export / delete / reset

- Extend `SettingsPrivacy.tsx:67-72` export bundle: add the 12 P0/P1/P2 tables from §8b
- Extend `delete_user_account/index.ts` cascade: add explicit delete for `user_style_summaries` (P0); optional parity adds for swap_events / user_style_profiles / outfit_reactions / inspiration_saves (P1)
- Build `supabase/functions/reset_style_memory/` from scratch per §10
- Add UI control in `SettingsPrivacy.tsx` "Your Rights" Collapsible (lines 214-232) + i18n keys per §10

### P91 — tests

Per `docs/launch/wave-8.5-style-memory.md:421-465`. Ensure:
- `normalizeStyleMemorySignal` test covers all rows in §7a
- `memory_ingest` test covers cross-user 403, idempotency, swap garment removed/added arrays
- `user_style_summaries` test covers N=3 promotion threshold + single-event-no-overconfidence
- `burs_style_engine` test covers `avoid_rules` hard skip + outfit completeness preserved
- `style_chat` test covers preference-statement persistence
- Privacy export test covers all P0 tables included
- `delete_user_account` test covers `user_style_summaries` zero orphans

### P92 — close-out verification

13-bullet checklist + 7-section PR summary per spec lines 469-508. No code; verification only.

---

## Resolved architectural decisions (locked-in 2026-04-29 by user direction "enterprise-level quality")

These decisions are committed for Wave 8.5. P83-P92 execute against these specifications. Subsequent prompts cite this section by number.

### D1 — Reject disambiguation: BOTH names exist (outfit-level + garment-level)

- `reject_outfit` = outfit-level signal ("this combination doesn't work for me"). Penalizes the *combination* via `outfit_id`; individual garments stay viable for other contexts.
- `never_suggest_garment` = garment-level signal ("I never want to see this garment again"). Hard exclusion: garment dropped from all candidate pools.
- Legacy `reject` (currently penalizes `sig.garment_id` despite outfit-level user intent) → maps to `reject_outfit`. **`burs_style_engine:995` read site updates in P88 to use `outfit_id` for penalty calc** — fixing the latent bug where outfit-level rejections poisoned individual garments.

Affects: P83 (normalize map adds both names; legacy `reject` → `reject_outfit`), P86 (UI for both — outfit-level reject button + garment-level "Never suggest"), P88 (read-site fix).

### D2 — Mark-as-worn signal source: β (wear_logs as authoritative)

- `wear_logs` is already universally persisted from all 4 surfaces (OutfitDetail / Plan / Home TodayOutfitCard / OutfitGenerate / GarmentDetail). Single source of truth.
- P87 summary builder reads `wear_logs` directly; each row is treated as a synthetic `wear_outfit` event during summary derivation.
- P88+P89 read `wear_logs` for wear history (existing reads preserved).
- "Planned follow-through" semantic derived by joining `wear_logs` → `planned_outfits` (status='worn' AND date matches).
- **No new frontend `recordSignal('wear_outfit')` writes added.** The 4 broken callers in §6b stay as-is; the build-out of `feedback_signals` from `wear_logs` happens server-side in P87.

Affects: P86 (wear-related callers untouched), P87 (read wear_logs as event source), P89 (read wear_logs for chat context).

### D3 — `memory_ingest` shape: Option C — hybrid (client-hook → edge-function → Postgres RPC)

```
Frontend:  useFeedbackSignals.record({signal_type, ...metadata})
              ↓ supabase.functions.invoke('memory_ingest', {...})
Edge:      memory_ingest/index.ts
              - JWT auth via getUser()
              - normalizeStyleMemorySignal(signal_type) [P83]
              - request_idempotency dedup [P12]
              - enforceRateLimit (new tier: maxPerHour 200, maxPerMinute 30)
              ↓ supabase.rpc('ingest_memory_event', {...})
Postgres:  ingest_memory_event(p_user_id, p_event_type, ...) SECURITY DEFINER
              - INSERT feedback_signals
              - UPSERT garment_pair_memory (recompute weights from event_type)
              - REFRESH user_style_summaries (debounced via updated_at check; rebuild if >24h stale)
              - all in ONE transaction — partial failures impossible
```

- Why C over A (pure edge fn no RPC): atomicity. Without the RPC wrapping all three writes in one transaction, a transient failure between `feedback_signals` insert and `garment_pair_memory` update leaves memory inconsistent.
- Why C over B (Postgres trigger): observability + testability. Triggers on user tables are invisible to call-tree tracing, can't be rate-limited via scale-guard, and force every memory write through one shape.
- Why C over D2-style "frontend writes direct, server reads": atomicity + taxonomy enforcement. Direct frontend writes can't validate against canonical signal names; the edge function is the only safe place.

Affects: P85 (build the 3-layer architecture), P86 (rewrite useFeedbackSignals to call memory_ingest instead of direct INSERT), all subsequent prompts (assume the architecture).

### D4 — Quick reaction surface coverage: extend to all 4 surfaces (Home + Plan + OutfitGenerate + AIChat)

- Home `TodayOutfitCard` — primary daily touchpoint, must capture quick reaction
- Plan calendar (when viewing a planned outfit's detail) — captures pre-wear sentiment
- OutfitGenerate (post-generation, before save) — captures initial reaction
- AIChat `OutfitSuggestionCard` — chat-driven outfits need feedback loop (otherwise the AI never learns from chat-suggested outfits)

Cost: ~1-2h UI work per surface (add 4-emoji reaction control + wire to memory_ingest). Payoff: 5× signal density.

Affects: P86 (4 new UI placements + signal writes via memory_ingest).

### D5 — `burs_style_engine` summary read strategy: summary-only with lazy materialization on cache miss

- `burs_style_engine` and `style_chat` read `user_style_summaries` exclusively. The legacy `feedback_signals.limit(200)` read in `burs_style_engine:898` is REMOVED in P88.
- On cache miss (new user with no row, OR stale row >7d old): edge function builds summary on-the-fly via the deterministic builder (P87), persists it, returns. Future calls hit the persisted row directly.
- Self-healing on cache miss — no operator intervention, no 30-day dual-read window.
- Build cost amortized: first AI call after a long quiet period pays the build, every subsequent call is ~1ms summary read.

Affects: P87 (builder must be callable both as scheduled refresh AND as on-demand cache miss recovery), P88 (drop legacy reads, add summary-only read with lazy fallback), P89 (same pattern as P88).

### Enterprise polish baked into the wave

| Concern | Mechanism | Where it lands |
|---|---|---|
| Idempotency | `request_idempotency` table + idempotency_key in `memory_ingest` body | P85 |
| Rate limiting | New tier `memory_ingest: { maxPerHour: 200, maxPerMinute: 30 }` in `_shared/scale-guard.ts` | P85 |
| Schema evolution | `user_style_summaries.version integer NOT NULL DEFAULT 1` | P84 (already in spec) |
| Confidence scoring | Every summary field carries 0-1 confidence; minimum N=3 occurrences before promoting to `preferred_*`/`avoided_*` | P87 (already in spec) |
| Recency decay | 90-day half-life across all signal weights (matches existing pair_memory behavior at `outfit-scoring.ts:485-535`) | P87 |
| Atomicity | Triple-write (feedback_signals + garment_pair_memory + summary refresh) inside ONE Postgres RPC `ingest_memory_event` | P85 |
| Observability | Every `memory_ingest` invocation emits `analytics_events` row via `callBursAI` wrapping (existing BURS pattern) | P85 |
| Privacy | Every memory row in P90 GDPR export; reset wipes summary + signals + pair memory in one transaction | P90 |
| Cross-user write protection | Edge function derives userId from verified JWT; Postgres RPC re-checks with `auth.uid()` | P85 |
| Auth gate uniformity | `enforceSubscription` applied to `memory_ingest` per Wave 8 P54 pattern (memory writes are a paid feature surface) | P85 |
