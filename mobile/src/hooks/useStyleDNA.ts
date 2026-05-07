// useStyleDNA — surfaces a friendly, UI-shaped Style DNA card from the
// persistent `user_style_summaries` row (built by the M10 deterministic
// builder via `memory_ingest`), with a runtime fallback that classifies
// `profiles.preferences.style_profile_v4_jsonb` when no summary row
// exists yet OR the row's confidence is below the surface threshold.
//
// Why two paths:
//   - The summary row is the canonical signal once a user has enough
//     wear / save / feedback events for the deterministic builder to
//     accumulate evidence (PROMOTION_FLOOR = 3 events per feature in
//     `_shared/style-summary-builder.ts`). Pre-launch users will hit
//     this path within their first session of real engagement.
//   - The fallback covers fresh signups and quiz-only users where the
//     row exists (placeholder UPSERT from `ingest_memory_event`) but
//     confidence is ~0 because no events have landed yet. Reading the
//     V4 quiz answers gives the screen something honest to render
//     immediately after onboarding rather than "Versatile" forever.
//
// Schema-coupled: the query reads `summary_json`, `summary_text`,
// `confidence`, `updated_at` from `user_style_summaries`. The
// `summary_json` shape is owned by `_shared/style-summary-builder.ts`
// (see StyleSummaryJson) — we re-derive the keys we need defensively
// and never throw on a malformed row.
//
// Web parity note: web's `src/hooks/useStyleDNA.ts` recomputes the DNA
// in-browser from raw wear_logs + garments. Mobile reads the
// pre-built summary row (server-side determinism) AND adds the V4
// runtime fallback so quiz-only users get a non-empty card.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { parseStyleProfileV4, type StyleProfileV4 } from '../lib/styleProfileV4';

/**
 * Friendly UI shape — this is what ProfileScreen / SettingsStyleScreen consume.
 * Field semantics:
 *   - `archetype`: human title-case label, single value (the strongest one).
 *   - `formality`: bucket label derived from a 0-100 score. See FORMALITY_BUCKETS.
 *   - `vibes`: up to 5 tags — archetypes + palette/pattern hints. Stable order.
 *   - `signatureColors`: up to 5 color tokens (lowercased), strongest first.
 *   - `confidence`: 0-1, mirrors the row's confidence column. Useful for the
 *     UI to show "Building your DNA…" copy below a threshold.
 *   - `source`: which path produced the result — lets the screen pick a
 *     subtitle ("Based on your wears" vs "Based on your quiz").
 *   - `updatedAt`: ISO timestamp from the row, or null for the fallback path.
 */
export interface StyleDNA {
  archetype: string;
  formality: string;
  vibes: readonly string[];
  signatureColors: readonly string[];
  confidence: number;
  source: 'summary' | 'fallback';
  updatedAt: string | null;
}

/** Below this overall confidence we prefer the V4 quiz fallback over a
 * summary row that's still warming up — the deterministic builder writes
 * a placeholder row on the first event ingest so a row's PRESENCE doesn't
 * imply it has signal yet. Mirrors style-summary-builder.ts's
 * LIMITED_SIGNAL_THRESHOLD so we agree on what "limited" means. */
const SURFACE_CONFIDENCE_THRESHOLD = 0.2;

/** 0-100 formality score → bucket label. Bucket boundaries match the
 * `formalityWordFor` helper in `_shared/style-summary-builder.ts` so the
 * label the UI shows matches what the AI prompts say. */
const FORMALITY_BUCKETS: readonly { min: number; label: string }[] = [
  { min: 70, label: 'Formal' },
  { min: 55, label: 'Smart casual' },
  { min: 35, label: 'Casual' },
  { min: 0, label: 'Relaxed' },
];

/**
 * Display order for the formality chip strip on Profile + SettingsStyle.
 * Mirrors the bucket vocabulary above (least → most formal) so the
 * active chip is always one of the four real buckets the parser
 * produces. Exported as the single source of truth so future drift
 * across screens can't recur (Codex P1 on M29 review).
 */
export const FORMALITY_BUCKETS_DISPLAY = [
  'Relaxed',
  'Casual',
  'Smart casual',
  'Formal',
] as const;
export type StyleDNAFormality = (typeof FORMALITY_BUCKETS_DISPLAY)[number];

function formalityLabelFor(score: number): string {
  for (const bucket of FORMALITY_BUCKETS) {
    if (score >= bucket.min) return bucket.label;
  }
  return 'Casual';
}

function titleCase(value: string): string {
  if (!value) return value;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Defensive parser for `summary_json`. Anything malformed downgrades to
 * `null` rather than throwing, so a corrupted row renders as the
 * fallback path instead of crashing the screen.
 */
interface SummaryRowFields {
  archetype: string | null;
  formalityScore: number | null;
  vibes: readonly string[];
  signatureColors: readonly string[];
}

function parseSummaryJson(raw: unknown): SummaryRowFields {
  const empty: SummaryRowFields = {
    archetype: null,
    formalityScore: null,
    vibes: [],
    signatureColors: [],
  };
  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as Record<string, unknown>;

  // style_archetypes: ConfidenceArray = [{value, confidence}, …]
  let archetype: string | null = null;
  const vibesSet = new Set<string>();
  const archetypes = obj['style_archetypes'];
  if (Array.isArray(archetypes)) {
    for (const entry of archetypes) {
      if (!entry || typeof entry !== 'object') continue;
      const value = (entry as { value?: unknown }).value;
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (archetype === null) archetype = titleCase(trimmed);
      vibesSet.add(titleCase(trimmed));
      if (vibesSet.size >= 5) break;
    }
  }

  // formality_center: 0-100 number.
  const formalityRaw = obj['formality_center'];
  const formalityScore =
    typeof formalityRaw === 'number' && Number.isFinite(formalityRaw)
      ? Math.max(0, Math.min(100, formalityRaw))
      : null;

  // preferred_colors: ConfidenceArray = [{value, confidence}, …]
  const signatureColors: string[] = [];
  const seenColor = new Set<string>();
  const preferredColors = obj['preferred_colors'];
  if (Array.isArray(preferredColors)) {
    for (const entry of preferredColors) {
      if (!entry || typeof entry !== 'object') continue;
      const value = (entry as { value?: unknown }).value;
      if (typeof value !== 'string') continue;
      const trimmed = value.trim().toLowerCase();
      if (!trimmed || seenColor.has(trimmed)) continue;
      seenColor.add(trimmed);
      signatureColors.push(trimmed);
      if (signatureColors.length >= 5) break;
    }
  }

  return {
    archetype,
    formalityScore,
    vibes: Array.from(vibesSet),
    signatureColors,
  };
}

/**
 * Runtime classifier — derives a UI-shaped DNA from a parsed V4 quiz
 * answer set. Used as the fallback path when no summary row exists OR
 * the row's confidence hasn't crossed SURFACE_CONFIDENCE_THRESHOLD.
 *
 * The classifier is intentionally simple: archetype = first picked
 * archetype, formality = mean of (floor + ceiling), vibes = picked
 * archetypes + palette vibe + pattern comfort hint, colors = picked
 * favorites. No event aggregation — that's what the summary row is for.
 */
function classifyFromV4(profile: StyleProfileV4): StyleDNA {
  const archetype =
    profile.archetypes.length > 0 ? titleCase(profile.archetypes[0]) : 'Versatile';

  const formalityScore = Math.round((profile.formalityFloor + profile.formalityCeiling) / 2);
  const formality = formalityLabelFor(formalityScore);

  const vibesSet = new Set<string>();
  for (const a of profile.archetypes.slice(0, 3)) vibesSet.add(titleCase(a));
  if (profile.paletteVibe && profile.paletteVibe !== 'mixed') {
    vibesSet.add(titleCase(profile.paletteVibe));
  }
  if (profile.patternComfort === 'love') vibesSet.add('Pattern bold');
  else if (profile.patternComfort === 'solids_only') vibesSet.add('Solids only');

  const signatureColors = profile.favoriteColors.slice(0, 5).map((c) => c.toLowerCase());

  return {
    archetype,
    formality,
    vibes: Array.from(vibesSet).slice(0, 5),
    signatureColors,
    confidence: 0,
    source: 'fallback',
    updatedAt: null,
  };
}

/**
 * Compose a UI DNA from a parsed summary row. Returns null when the row
 * has no usable archetype — caller falls back to V4 in that case.
 */
function buildFromSummary(
  fields: SummaryRowFields,
  confidence: number,
  updatedAt: string | null,
): StyleDNA | null {
  if (!fields.archetype) return null;
  const formality = formalityLabelFor(fields.formalityScore ?? 50);
  return {
    archetype: fields.archetype,
    formality,
    vibes: fields.vibes,
    signatureColors: fields.signatureColors,
    confidence,
    source: 'summary',
    updatedAt,
  };
}

/**
 * Empty-state DNA — used when neither a usable summary row nor a V4
 * quiz answer set is available (e.g. a pre-onboarding session). The
 * UI can detect this via `source === 'fallback'` && `archetype === 'Versatile'`
 * if it wants to show an "Take the quiz" CTA, but the shape stays
 * non-null so screens don't have to special-case undefined.
 */
function emptyDNA(): StyleDNA {
  return {
    archetype: 'Versatile',
    formality: 'Smart casual',
    vibes: [],
    signatureColors: [],
    confidence: 0,
    source: 'fallback',
    updatedAt: null,
  };
}

export function useStyleDNA() {
  const { user, profile } = useAuth();

  return useQuery<StyleDNA>({
    queryKey: ['styleDNA', user?.id],
    queryFn: async (): Promise<StyleDNA> => {
      if (!user) return emptyDNA();

      // 1. Read the summary row. RLS lets the user select their own.
      const { data, error } = await supabase
        .from('user_style_summaries')
        .select('summary_json, summary_text, confidence, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      // Treat "no row" and transient errors the same: fall through to V4.
      // We don't want a network blip during refresh to wipe a useful card.
      if (!error && data) {
        const confidenceRaw = (data as { confidence?: unknown }).confidence;
        const confidence =
          typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
            ? Math.max(0, Math.min(1, confidenceRaw))
            : 0;
        const updatedAt =
          typeof (data as { updated_at?: unknown }).updated_at === 'string'
            ? ((data as { updated_at: string }).updated_at)
            : null;

        if (confidence >= SURFACE_CONFIDENCE_THRESHOLD) {
          const fields = parseSummaryJson((data as { summary_json?: unknown }).summary_json);
          const built = buildFromSummary(fields, confidence, updatedAt);
          if (built) return built;
        }
      }

      // 2. Fallback — runtime classifier on style_profile_v4_jsonb.
      // The AuthContext-loaded `profile.preferences` is already in memory,
      // so no extra round-trip. We look at both `style_profile_v4_jsonb`
      // (canonical V4 location, written by the M25 quiz) and a top-level
      // `style_profile_v4` (older drafts) as a defensive read.
      const prefs =
        profile?.preferences && typeof profile.preferences === 'object'
          ? (profile.preferences as Record<string, unknown>)
          : null;
      const v4Raw =
        (prefs?.['style_profile_v4_jsonb'] as unknown) ??
        (prefs?.['style_profile_v4'] as unknown) ??
        null;
      if (v4Raw) {
        const parsed = parseStyleProfileV4(v4Raw);
        // Only surface the V4-derived DNA when the user actually picked
        // archetypes — otherwise we'd render "Versatile" with no colors
        // and no vibes which looks broken. The empty-state path does the
        // same thing more honestly.
        if (parsed.archetypes.length > 0 || parsed.favoriteColors.length > 0) {
          return classifyFromV4(parsed);
        }
      }

      return emptyDNA();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
