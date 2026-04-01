export type CanonicalStyleSignal =
  | 'minimal'
  | 'classic'
  | 'smart_casual'
  | 'street'
  | 'sporty'
  | 'romantic'
  | 'scandinavian'
  | 'edgy'
  | 'bohemian'
  | 'preppy'
  | 'relaxed';

export type CanonicalOccasionSignal =
  | 'casual'
  | 'work'
  | 'meeting'
  | 'date'
  | 'party'
  | 'formal'
  | 'travel'
  | 'workout'
  | 'school'
  | 'brunch'
  | 'dinner';

const STYLE_SIGNAL_ALIASES: Record<CanonicalStyleSignal, string[]> = {
  minimal: ['minimal', 'clean', 'tonal', 'monochrome'],
  classic: ['classic', 'timeless', 'refined'],
  smart_casual: ['smart casual', 'smart-casual', 'smart_casual', 'polished casual'],
  street: ['street', 'streetwear', 'urban'],
  sporty: ['sporty', 'athletic', 'performance'],
  romantic: ['romantic', 'soft', 'dreamy'],
  scandinavian: ['scandinavian', 'nordic'],
  edgy: ['edgy', 'rock', 'biker', 'grunge'],
  bohemian: ['bohemian', 'boho', 'artisanal'],
  preppy: ['preppy', 'ivy', 'collegiate'],
  relaxed: ['relaxed', 'laid back', 'laid-back', 'comfortable', 'easy'],
};

const OCCASION_SIGNAL_ALIASES: Record<CanonicalOccasionSignal, string[]> = {
  casual: ['casual', 'vardag', 'everyday', 'weekend', 'helg', 'smart casual', 'smart-casual', 'smart_casual'],
  work: ['work', 'jobb', 'office', 'kontor', 'professional', 'business', 'after work', 'afterwork', 'smart casual', 'smart-casual', 'smart_casual'],
  meeting: ['meeting', 'mote', 'möte', 'presentation', 'pitch', 'conference', 'konferens', 'interview', 'intervju', 'client'],
  date: ['date', 'dejt', 'romantic', 'anniversary'],
  party: ['party', 'fest', 'celebration', 'night out', 'mingel', 'after work', 'afterwork'],
  formal: ['formal', 'wedding', 'brollop', 'bröllop', 'gala', 'ceremony', 'ceremoni', 'black tie'],
  travel: ['travel', 'resa', 'flight', 'flygresa', 'airport'],
  workout: ['workout', 'training', 'traning', 'träning', 'gym', 'sport', 'running', 'lopning', 'löpning', 'yoga'],
  school: ['school', 'skola', 'university', 'universitet', 'campus'],
  brunch: ['brunch', 'fika', 'coffee'],
  dinner: ['dinner', 'middag'],
};

export function normalizeSignalText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectSignals<TSignal extends string>(
  aliasMap: Record<TSignal, string[]>,
  sources: Array<string | string[] | null | undefined>,
): Set<TSignal> {
  const normalizedInputs = sources
    .flatMap((source) => Array.isArray(source) ? source : [source])
    .map((source) => normalizeSignalText(source))
    .filter(Boolean);

  const signals = new Set<TSignal>();

  for (const input of normalizedInputs) {
    for (const [signal, aliases] of Object.entries(aliasMap) as Array<[TSignal, string[]]>) {
      if (aliases.some((alias) => input.includes(alias))) {
        signals.add(signal);
      }
    }
  }

  return signals;
}

export function collectStyleSignals(...sources: Array<string | string[] | null | undefined>): Set<CanonicalStyleSignal> {
  return collectSignals(STYLE_SIGNAL_ALIASES, sources);
}

export function collectOccasionSignals(
  source: string | string[] | null | undefined,
): Set<CanonicalOccasionSignal> {
  const signals = collectSignals(OCCASION_SIGNAL_ALIASES, [source]);
  const normalized = Array.isArray(source)
    ? source.map((entry) => normalizeSignalText(entry)).join(' ')
    : normalizeSignalText(source);

  if (!signals.size && normalized) {
    if (normalized.includes('work')) signals.add('work');
    if (normalized.includes('casual')) signals.add('casual');
  }

  return signals;
}

export function hasStyleSignal(
  signals: Iterable<CanonicalStyleSignal>,
  signal: CanonicalStyleSignal,
): boolean {
  return new Set(signals).has(signal);
}

export function hasOccasionSignal(
  signals: Iterable<CanonicalOccasionSignal>,
  signal: CanonicalOccasionSignal,
): boolean {
  return new Set(signals).has(signal);
}
