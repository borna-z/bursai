# Week 0 Baseline

Captured before Week 1 fixes begin. All subsequent weeks compare against these numbers.

## Toolchain

| Check | Result |
|---|---|
| `npx tsc --noEmit --skipLibCheck` | 0 errors |
| `npx eslint src/ --ext .ts,.tsx` | 0 warnings |
| `npm run build` | not run in Week 0 (TSC + ESLint clean) |

## LOC inventory

`npx tsx scripts/check-loc.ts --warn-only` reports:

- **224 findings** (files over target)
- **133 hard-max violations** (files over hard max)

## God files (original plan of 6, actual state)

| File | LOC | Spec | Over by |
|---|---|---|---|
| `supabase/functions/style_chat/index.ts` | 1893 | edge entry max 220 | +1673 |
| `supabase/functions/_shared/outfit-scoring.ts` | 1671 | edge shared max 300 | +1371 |
| `supabase/functions/burs_style_engine/index.ts` | 1595 | edge entry max 220 | +1375 |
| `src/pages/AIChat.tsx` | 1479 | page max 300 | +1179 |
| `src/pages/AddGarment.tsx` | 168 | page max 300 | OK (no split needed) |
| `src/pages/Wardrobe.tsx` | 236 | page max 300 | OK (no split needed) |

`AddGarment.tsx` and `Wardrobe.tsx` are already within spec — they do not need
splitting. The Week 4 plan is revised to focus on `AIChat.tsx` + localStorage
migration instead.

## Additional god files surfaced by full LOC scan

Edge functions (entry hard max 220):
- `travel_capsule/index.ts` — 1196
- `render_garment_image/index.ts` — 1182
- `import_garments_from_links/index.ts` — 528
- `calendar/index.ts` — 484
- `analyze_garment/index.ts` — 481
- `mood_outfit/index.ts` — 373
- `wardrobe_gap_analysis/index.ts` — 343
- `stripe_webhook/index.ts` — 322
- `process_job_queue/index.ts` — 300
- `detect_duplicate_garment/index.ts` — 287
- `shopping_chat/index.ts` — 255

Shared modules (hard max 300):
- `_shared/outfit-combination.ts` — 1096
- `_shared/insights-dashboard.ts` — 950
- `_shared/burs-ai.ts` — 789
- `_shared/scale-guard.ts` — 581
- `_shared/style-chat-normalizer.ts` — 554
- `_shared/outfit-scoring-body.ts` — 521
- `_shared/outfit-scoring-color.ts` — 421
- `_shared/render-credits.ts` — 364
- `_shared/outfit-rules.ts` — 331
- `_shared/gemini-image-client.ts` — 301
- `style_chat/prompt-builder.ts` — 547

Frontend pages (max 300):
- `src/pages/LiveScan.tsx` — 831
- `src/pages/GarmentDetail.tsx` — 668
- `src/pages/OutfitDetail.tsx` — 641
- `src/pages/Plan.tsx` — 627
- `src/pages/settings/SettingsStyle.tsx` — 587
- `src/pages/OutfitGenerate.tsx` — 557
- `src/pages/EditGarment.tsx` — 516
- `src/pages/MoodOutfit.tsx` — 415
- `src/pages/marketing/PrivacyPolicy.tsx` — 409
- `src/pages/Auth.tsx` — 391

Frontend hooks (max 160):
- `src/hooks/useInsightsDashboard.ts` — 954
- `src/hooks/useAddGarment.ts` — 639
- `src/hooks/useOutfitGenerator.ts` — 464
- `src/hooks/useGarments.ts` — 463

Frontend components (max 180):
- `src/components/insights/useInsightsDashboardAdapter.ts` — 828
- `src/components/travel/useTravelCapsule.ts` — 637
- `src/components/onboarding/StyleQuizV3.tsx` — 601
- `src/components/wardrobe/BatchUploadProgress.tsx` — 583
- `src/components/onboarding/QuickStyleQuiz.tsx` — 515
- `src/components/onboarding/StyleQuizStep.tsx` — 441
- `src/components/add-garment/FormStep.tsx` — 431
- `src/components/wardrobe/GarmentGrid.tsx` — 425
- `src/components/onboarding/OnboardingEmptyState.tsx` — 415
- `src/components/chat/OutfitSuggestionCard.tsx` — 409
- `src/components/wardrobe/WardrobeOutfitsTab.tsx` — 391

Lib utilities (max 180):
- `src/lib/styleChatNormalizer.ts` — 554
- `src/lib/garmentIntelligence.ts` — 397

Test files (max 320):
- `src/hooks/__tests__/useOutfitGenerator.test.tsx` — 1316
- `src/lib/__tests__/engineEvalHarness.test.ts` — 995
- `src/hooks/__tests__/useLiveScan.test.tsx` — 551
- `src/lib/__tests__/garmentIntelligence.test.ts` — 420

## Known exempt files (no LOC cap)

- `src/i18n/locales/*.ts` (append-only per CLAUDE.md)
- `src/integrations/supabase/types.ts` (auto-generated)
- `supabase/migrations/*.sql` (migration files)
- `public/*`

## Notes

- The original 6-file god list understated the scope.
- True refactor-to-spec is ~40 god files, not 6.
- Week 3-6 plan absorbs the additional splits; Week 7-8 picks up the remaining frontend violators.
- LOC check is `--warn-only` during Weeks 1-7 (doesn't block commits).
- Flip to `--strict` on the pre-commit hook in Week 8 once all hard-max files are split.
