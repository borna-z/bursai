import type { GapNavigationState, GapScanSnapshot } from '@/components/gaps/gapTypes';

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
