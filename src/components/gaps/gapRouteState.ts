import type { GapNavigationState, GapScanSnapshot } from '@/components/gaps/gapTypes';

export function openGapSearchUrl(query: string) {
  window.open(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    '_blank',
    'noopener',
  );
}

const COLOR_MAP: Record<string, string> = {
  navy: '#1B2838', beige: '#F5F0DC', cream: '#FFFDD0', ecru: '#C2B280',
  olive: '#556B2F', burgundy: '#800020', charcoal: '#36454F', camel: '#C19A6B',
  taupe: '#483C32', ivory: '#FFFFF0', coral: '#FF7F50', sage: '#BCB88A',
  rust: '#B7410E', mustard: '#FFDB58', blush: '#DE5D83', slate: '#708090',
  sand: '#C2B280', mocha: '#4B3832', pewter: '#8B8680', champagne: '#F7E7CE',
};

export function cssColorFromName(name: string): string {
  if (!name) return 'transparent';
  const lower = name.toLowerCase().trim();
  return COLOR_MAP[lower] ?? name;
}

const GAP_AUTORUN_QUERY = 'autorun';
const GAP_SNAPSHOT_KEY_PREFIX = 'burs:gaps:last-scan:';

function isGapNavigationState(value: unknown): value is GapNavigationState {
  if (!value || typeof value !== 'object') return false;
  return 'autorun' in value || 'source' in value;
}

function buildGapSnapshotKey(userId: string | null | undefined) {
  return `${GAP_SNAPSHOT_KEY_PREFIX}${userId ?? 'anonymous'}`;
}

export function buildGapsPath(options?: { autorun?: boolean }) {
  if (!options?.autorun) return '/gaps';
  const params = new URLSearchParams({ [GAP_AUTORUN_QUERY]: '1' });
  return `/gaps?${params.toString()}`;
}

export function readGapNavigationIntent({
  search,
  state,
}: {
  search: string;
  state: unknown;
}): Required<GapNavigationState> {
  const params = new URLSearchParams(search);
  const locationState = isGapNavigationState(state) ? state : undefined;

  return {
    autorun: params.get(GAP_AUTORUN_QUERY) === '1' || locationState?.autorun === true,
    source: locationState?.source ?? 'unknown',
  };
}

// Note: sessionStorage is used intentionally here as a cross-navigation cache
// for gap scan results. The data is always duplicated in React state within
// the consuming page component. This is NOT React component state — it's a
// session-scoped persistence layer for navigation-resilient caching.
export function loadGapSnapshot(userId: string | null | undefined): GapScanSnapshot | null {
  if (typeof window === 'undefined' || !userId) return null;

  try {
    const raw = window.sessionStorage.getItem(buildGapSnapshotKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GapScanSnapshot;
    if (!parsed || !Array.isArray(parsed.results) || typeof parsed.analyzedAt !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveGapSnapshot(userId: string | null | undefined, snapshot: GapScanSnapshot) {
  if (typeof window === 'undefined' || !userId) return;

  try {
    window.sessionStorage.setItem(buildGapSnapshotKey(userId), JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures so scan results still render in-memory.
  }
}
