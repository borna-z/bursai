// Pure helpers + module-scope state for `useOutfits`. Lives in a sibling
// file so the hook body stays focused on TanStack wiring.

import { supabase } from '../lib/supabase';
import { localISODate } from './../lib/outfitDisplay';

/**
 * Sentinel result from `useMarkOutfitWorn`. The mutation can decline to
 * write when the outfit is already marked worn today — callers should
 * gate `Alert.alert` and other side effects on `data.deduped` so a
 * dedupe round doesn't surface a "Marked worn" toast that didn't
 * correspond to a real write. Codex P2 round 10 on PR #738.
 */
export type MarkOutfitWornResult = { deduped: boolean };

export const OUTFIT_WITH_ITEMS_SELECT = `
  *,
  outfit_items (
    *,
    garment:garments (*)
  )
`;

// Module-level in-flight set keyed by outfitId. Synchronous double-mutate
// calls (e.g. HomeScreen exposes two CTAs wired to the same mutation —
// "Wear this" in the hero and "Wear today" in the mini-week strip — and
// React Query's `isPending` flag flips after the next render, so a tight
// double-tap can fire two `mutate(...)` calls before the disabled state
// renders) would otherwise double-bump every garment's wear_count and
// insert duplicate wear_logs. The synchronous prefix of mutationFn
// (set.has + set.add) runs to completion before the first `await` yields,
// so the second concurrent invocation always sees the entry and bails.
// The `try/finally delete()` guarantees the lock releases even on error.
// Codex P2 round 9 on PR #738.
export const inFlightWearOutfit = new Set<string>();

// The actual mark-worn write sequence — extracted from the hook so the
// in-flight gate above can wrap it cleanly. Returns void (the wrapper
// returns `{ deduped: true }` for the dedup path; the real path returns
// undefined which TS narrows fine — both are valid mutation results).
export async function runMarkOutfitWorn({
  outfitId,
  garmentIds,
  userId,
}: {
  outfitId: string;
  garmentIds: string[];
  userId: string;
}): Promise<MarkOutfitWornResult> {
  // Day-level idempotency. Two scenarios this catches that the synchronous
  // in-flight Set above does NOT:
  //   (a) The user taps the second Wear CTA AFTER the first mutation has
  //       resolved (so the in-flight entry is gone) but BEFORE the
  //       refetched outfit's `worn_at` has reached the cache and disabled
  //       the screen's `wornToday` gate. Codex P2 round 10 on PR #738.
  //   (b) The user opens the same outfit on a second device and taps
  //       Wear today there too — same-day double-write would still produce
  //       duplicate wear_logs + a doubled wear_count.
  // The check reads `outfits.worn_at` directly so it ALWAYS sees the
  // current server state, not a possibly-stale cached row.
  const { data: existingOutfit, error: readErr } = await supabase
    .from('outfits')
    .select('worn_at')
    .eq('id', outfitId)
    .eq('user_id', userId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existingOutfit?.worn_at) {
    const wornDate = new Date(existingOutfit.worn_at);
    if (!Number.isNaN(wornDate.getTime())) {
      if (localISODate(wornDate) === localISODate(new Date())) {
        return { deduped: true };
      }
    }
  }

  const nowIso = new Date().toISOString();

  // 1. Stamp the outfit.
  const { error: outfitError } = await supabase
    .from('outfits')
    .update({ worn_at: nowIso })
    .eq('id', outfitId)
    .eq('user_id', userId);
  if (outfitError) throw outfitError;

  // 2. Fallback path — caller didn't pass garmentIds. Single null-garment
  //    wear_log so we at least record the outfit-level wear.
  if (garmentIds.length === 0) {
    const { error: logError } = await supabase.from('wear_logs').insert({
      user_id: userId,
      outfit_id: outfitId,
      worn_at: nowIso,
    });
    if (logError) throw logError;
    return { deduped: false };
  }

  // 3a. Read current wear_count snapshot so the per-row +1 doesn't
  //     clobber concurrent writes from a different mutation. Last-write-
  //     wins under contention (matches web behavior).
  const { data: garmentStates, error: stateError } = await supabase
    .from('garments')
    .select('id, wear_count')
    .in('id', garmentIds)
    .eq('user_id', userId);
  if (stateError) throw stateError;

  const stateMap = new Map(
    (garmentStates ?? []).map((g) => [g.id, g.wear_count ?? 0]),
  );

  // 3b. Bump every garment in parallel.
  await Promise.all(
    garmentIds.map((garmentId) => {
      const next = (stateMap.get(garmentId) ?? 0) + 1;
      return supabase
        .from('garments')
        .update({ wear_count: next, last_worn_at: nowIso })
        .eq('id', garmentId)
        .eq('user_id', userId);
    }),
  );

  // 3c. Per-garment wear log — upsert against the
  //     `wear_logs_user_garment_worn_at_uidx` UNIQUE INDEX added in the
  //     post-launch theme-2 schema-hardening migration. Two distinct
  //     guards cover two distinct race shapes:
  //
  //       • `inFlightWearOutfit` (Set, keyed on outfit_id) handles the
  //         SAME-OUTFIT double-tap case — that's the canonical guard.
  //       • The UNIQUE INDEX handles the CROSS-OUTFIT collision where two
  //         different outfits share a garment and are marked worn within
  //         the same `nowIso` millisecond — neither outfit_id is in the
  //         in-flight Set, but the per-garment wear_log payload is
  //         identical, so without the index the second batch would 23505.
  //
  //     `ignoreDuplicates: true` (Prefer: resolution=ignore-duplicates)
  //     silently drops conflicting rows from the INSERT — wear_count
  //     bumps in 3b still land for the duplicate-collision case, which
  //     is correct: the user really did "wear" both outfits, the
  //     wear_log just records the underlying garment once per instant.
  const wearLogRows = garmentIds.map((garmentId) => ({
    user_id: userId,
    garment_id: garmentId,
    outfit_id: outfitId,
    worn_at: nowIso,
  }));
  const { error: logError } = await supabase
    .from('wear_logs')
    .upsert(wearLogRows, {
      onConflict: 'user_id,garment_id,worn_at',
      ignoreDuplicates: true,
    });
  if (logError) throw logError;

  return { deduped: false };
}

/**
 * Upsert one `outfit_feedback` row per (user_id, outfit_id), backed by the
 * `outfit_feedback_user_outfit_uidx` UNIQUE INDEX (post-launch theme-2
 * schema hardening). A single PostgREST upsert is atomic at the DB layer
 * — no SELECT-then-write race, no sibling cleanup. The historical workaround
 * (SELECT newest → UPDATE / INSERT → DELETE siblings) was retired with the
 * constraint; pre-existing duplicates were collapsed by the migration's
 * one-shot DELETE pass.
 *
 * Partial-payload semantics: PostgREST's single-object upsert builds the
 * ON CONFLICT DO UPDATE SET list from the JSON keys actually present in
 * the payload, so fields ABSENT from `patch` are preserved on the existing
 * row. `useRateOutfit` (sends `{ rating }`) and `useSaveOutfitNote`
 * (sends `{ commentary }`) therefore do NOT clobber each other. An
 * EXPLICIT `commentary: null` in `patch` IS sent and DOES set the column
 * to null — that's the deliberate "clear note" path.
 */
export async function upsertOutfitFeedbackRow(
  userId: string,
  outfitId: string,
  patch: { rating?: number; commentary?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('outfit_feedback')
    .upsert(
      { user_id: userId, outfit_id: outfitId, ...patch },
      { onConflict: 'user_id,outfit_id' },
    );
  if (error) throw error;
}
