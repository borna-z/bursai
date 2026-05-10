# N11 — AI quality fixes (audit follow-up)

| Field | Value |
|---|---|
| Goal | Patch the three real findings from the 2026-05-10 mobile + edge function audit. Cosmetic but visible in code review. |
| Status | TODO |
| Branch | `mobile-n11-ai-quality` |
| PR count | 1 |
| Depends on | — |
| Complexity | XS |

## Background

A full audit of `mobile/src/` and `supabase/functions/` flagged three quality items. The audit's other "P0/P1" claims were verified false positives (mobile already handles edge function edge cases defensively; misleadingly-named `supabase` variables turned out to be service-role clients). Findings log entry: `docs/launch/findings-log.md` 2026-05-10.

## Files touched

### Modified
- `mobile/src/theme/tokens.ts` — add `scrim` / `scrimStrong` color tokens (or one named slot per existing precedent in tokens).
- `mobile/src/components/CoachOverlay.tsx:50` — replace `'rgba(0,0,0,0.62)'` with `t.scrimStrong`.
- `mobile/src/components/ChatHistorySheet.tsx:284` — replace `'rgba(0,0,0,0.35)'` with `t.scrim`.
- `mobile/src/screens/MonthCalendarScreen.tsx:1-10` — delete the obsolete "Mock-data only" header comment; data is real via `usePlannedOutfitsForRange`.
- `supabase/functions/_shared/burs-ai.ts` — collapse `isEnrichmentReady()` / `filterEnrichedGarments()` to accept only `'completed'`. The DB already converged on the canonical spelling: every current writer (`mobile/src/hooks/useAnalyzeGarment.ts:324`, `src/lib/garmentIntelligence.ts:423`, `src/pages/GarmentDetail.tsx:214`, `supabase/functions/process_job_queue/index.ts:282`) emits `'completed'`, and migration `20260424004047_backfill_enrichment_status.sql` already backfilled the legacy `'complete'` rows. So the predicate cleanup is dead-code removal — no new migration required.
- `supabase/functions/_shared/__tests__/burs-ai.test.ts` — drop the legacy-spelling test cases that exercised the redundant branch.

## Acceptance gates

- TypeScript: 0 errors (`cd mobile && npx tsc --noEmit`)
- Lint: 0 warnings (`cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0`)
- expo-doctor: passes
- `deno check supabase/functions/_shared/burs-ai.ts`
- Vitest: `npx vitest run supabase/functions/_shared/__tests__/burs-ai.test.ts` passes
- Code-reviewer: approved
- Codex review loop: ≥1 positive signal per standing memory rule

## Deploy

After merge:
- Redeploy every function importing `_shared/burs-ai.ts` (the predicate semantics changed). The list of dependent functions: every AI function in `supabase/functions/` is a candidate — any function reading `enrichment_status`. Practical impact is limited to functions that read the field via `isEnrichmentReady` / `filterEnrichedGarments` / `waitForEnrichment` — grep `_shared` consumers and redeploy those (deploy one at a time per `supabase/functions/CLAUDE.md`).

## PR template

Title: `fix(mobile+backend): N11 — AI quality fixes (audit follow-up)`

Body sections: Summary (3 bullets), Files touched, Test plan (manual: open onboarding coach for scrim, open ChatHistorySheet, open MonthCalendar — visual parity).
