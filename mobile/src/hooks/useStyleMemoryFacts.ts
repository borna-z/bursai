// useStyleMemoryFacts — query the "what burs remembers about you" panel
// rendered by the M14 8-mode chat memory surface.
//
// Two sources are merged into a single chip-friendly list:
//
//   1. `user_style_summaries.summary_json` — the rolling daily-built blob
//      that captures the user's current preferences. We surface three
//      documented top-level paths (each optional, defaults to `[]`):
//        - `style_keywords: string[]`   → reject_outfit-style chips
//        - `palette: string[]`          → reject_outfit-style chips
//        - `disliked_garments: { id, title }[]` → never_suggest chips
//
//   2. `feedback_signals` rows of type `never_suggest_garment` — the
//      live, user-confirmed "never suggest this piece" surface. We
//      hydrate the matching garment titles in a single follow-up
//      `garments.in('id', [...])` lookup so the chip says the title
//      and not just an opaque id.
//
// The two sources are deduped by garmentId (newest feedback_signals
// entry wins over a summary_json mention) and the combined result is
// capped at 12 entries so a noisy summary blob can't blow out the
// memory panel.
//
// The JSON column is fluid (the daily builder evolves) — every accessor
// is defensive: an unexpected shape downgrades to "no chips from this
// source", never throws.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface StyleMemoryFact {
  /** Stable key for FlatList — never collides across rows. */
  id: string;
  /** User-facing chip text. */
  label: string;
  signalKind: 'never_suggest_garment' | 'reject_outfit';
  /** Present when `signalKind === 'never_suggest_garment'`. */
  garmentId?: string;
  source: 'summary_json' | 'feedback_signals';
}

interface SummaryRow {
  summary_json: unknown;
  summary_text: string | null;
  confidence: number | null;
  version: number | null;
}

interface FeedbackSignalRow {
  id: string;
  signal_type: string;
  garment_id: string | null;
  feedback_text: string | null;
  created_at: string;
}

const MAX_FACTS = 12;
const FEEDBACK_LIMIT = 8;

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

interface DislikedGarment {
  id: string;
  title: string;
}

function coerceDislikedGarments(value: unknown): DislikedGarment[] {
  if (!Array.isArray(value)) return [];
  const out: DislikedGarment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const id = obj.id;
    const title = obj.title;
    if (typeof id !== 'string' || typeof title !== 'string') continue;
    if (id.length === 0 || title.length === 0) continue;
    out.push({ id, title });
  }
  return out;
}

function factsFromSummary(summary: SummaryRow | null): StyleMemoryFact[] {
  if (!summary || !summary.summary_json || typeof summary.summary_json !== 'object') {
    return [];
  }
  const json = summary.summary_json as Record<string, unknown>;

  const keywords = coerceStringArray(json.style_keywords);
  const palette = coerceStringArray(json.palette);
  const disliked = coerceDislikedGarments(json.disliked_garments);

  const out: StyleMemoryFact[] = [];
  let idx = 0;

  for (const kw of keywords) {
    out.push({
      id: `summary:reject_outfit:${idx}-${kw}`,
      label: kw,
      signalKind: 'reject_outfit',
      source: 'summary_json',
    });
    idx += 1;
  }
  for (const color of palette) {
    out.push({
      id: `summary:reject_outfit:${idx}-${color}`,
      label: color,
      signalKind: 'reject_outfit',
      source: 'summary_json',
    });
    idx += 1;
  }
  for (const g of disliked) {
    out.push({
      id: `summary:never_suggest_garment:${idx}-${g.id}`,
      label: g.title,
      signalKind: 'never_suggest_garment',
      garmentId: g.id,
      source: 'summary_json',
    });
    idx += 1;
  }

  return out;
}

export function useStyleMemoryFacts(): {
  facts: StyleMemoryFact[];
  isLoading: boolean;
  error: Error | null;
} {
  const { user } = useAuth();

  const query = useQuery<StyleMemoryFact[], Error>({
    queryKey: ['styleMemoryFacts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      // 1. Daily-built style summary blob. `.maybeSingle()` because the
      //    row may not exist yet (new users / pre-summary-build window).
      const { data: summaryData, error: summaryError } = await supabase
        .from('user_style_summaries')
        .select('summary_json, summary_text, confidence, version')
        .eq('user_id', user.id)
        .maybeSingle<SummaryRow>();
      if (summaryError) throw summaryError;

      // 2. Live "never suggest" feedback signals — newest first so the
      //    dedup pass below keeps the user's most recent declaration.
      const { data: signalsData, error: signalsError } = await supabase
        .from('feedback_signals')
        .select('id, signal_type, garment_id, feedback_text, created_at')
        .eq('user_id', user.id)
        .eq('signal_type', 'never_suggest_garment')
        .order('created_at', { ascending: false })
        .limit(FEEDBACK_LIMIT);
      if (signalsError) throw signalsError;
      const signals = (signalsData ?? []) as FeedbackSignalRow[];

      // 3. Title lookup for every signal-row garment in a single
      //    `IN (...)` round-trip. Skip rows whose garment can't be
      //    looked up (deleted / RLS-shielded).
      const garmentIds = Array.from(
        new Set(signals.map((s) => s.garment_id).filter((id): id is string => !!id)),
      );
      const titlesById = new Map<string, string>();
      if (garmentIds.length > 0) {
        const { data: garmentRows, error: garmentError } = await supabase
          .from('garments')
          .select('id, title')
          .in('id', garmentIds)
          .eq('user_id', user.id);
        if (garmentError) throw garmentError;
        for (const row of garmentRows ?? []) {
          if (row.id && row.title) titlesById.set(row.id, row.title);
        }
      }

      const signalFacts: StyleMemoryFact[] = [];
      for (const row of signals) {
        if (!row.garment_id) continue;
        const title = titlesById.get(row.garment_id);
        if (!title) continue;
        signalFacts.push({
          id: row.id,
          label: title,
          signalKind: 'never_suggest_garment',
          garmentId: row.garment_id,
          source: 'feedback_signals',
        });
      }

      // Dedup by garmentId — feedback_signals entries (newer truth) win
      // over the summary_json mention. We push signal facts first so the
      // Set tracks them, then add summary entries only when their
      // garmentId hasn't already been seen. Summary entries without a
      // garmentId (keywords / palette colors) always pass through.
      const seenGarmentIds = new Set<string>();
      const merged: StyleMemoryFact[] = [];
      for (const f of signalFacts) {
        if (f.garmentId) seenGarmentIds.add(f.garmentId);
        merged.push(f);
      }
      for (const f of factsFromSummary(summaryData ?? null)) {
        if (f.garmentId && seenGarmentIds.has(f.garmentId)) continue;
        if (f.garmentId) seenGarmentIds.add(f.garmentId);
        merged.push(f);
      }

      return merged.slice(0, MAX_FACTS);
    },
  });

  return {
    facts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
}
