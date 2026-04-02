export interface StylePreferenceOverrides {
  favoriteColors?: string[];
  dislikedColors?: string[];
}

function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeColorList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const color = normalizeColor(value);
    if (!color || seen.has(color)) continue;
    seen.add(color);
    normalized.push(color);
  }
  return normalized;
}

function mergeColorLists(params: {
  basePreferred: string[];
  baseAvoided: string[];
  overridePreferred: string[];
  overrideAvoided: string[];
}): { favoriteColors: string[]; dislikedColors: string[] } {
  const basePreferredSet = new Set(params.basePreferred);
  const baseAvoidedSet = new Set(params.baseAvoided);
  const overrideAvoidedSet = new Set(params.overrideAvoided);
  const overridePreferredSet = new Set(params.overridePreferred);

  const favoriteColors = [
    ...params.basePreferred,
    ...params.overridePreferred.filter((color) => !baseAvoidedSet.has(color) && !overrideAvoidedSet.has(color)),
  ];
  const dislikedColors = [
    ...params.baseAvoided,
    ...params.overrideAvoided.filter((color) => !basePreferredSet.has(color) && !overridePreferredSet.has(color)),
  ];

  return {
    favoriteColors: normalizeColorList(favoriteColors),
    dislikedColors: normalizeColorList(dislikedColors),
  };
}

export function mergeStylePreferenceOverrides(
  basePreferences: Record<string, any> | null,
  overrides: StylePreferenceOverrides | null | undefined,
): Record<string, any> | null {
  const overridePreferred = normalizeColorList(overrides?.favoriteColors);
  const overrideAvoided = normalizeColorList(overrides?.dislikedColors);
  if (!basePreferences && overridePreferred.length === 0 && overrideAvoided.length === 0) {
    return null;
  }

  const base = basePreferences ? structuredClone(basePreferences) : {};
  const hasStyleProfile = Boolean(base && typeof base === 'object' && 'styleProfile' in base && base.styleProfile && typeof base.styleProfile === 'object');
  const currentProfile = hasStyleProfile
    ? { ...base.styleProfile }
    : { ...(base || {}) };

  const mergedColors = mergeColorLists({
    basePreferred: normalizeColorList(currentProfile.favoriteColors),
    baseAvoided: normalizeColorList(currentProfile.dislikedColors),
    overridePreferred,
    overrideAvoided,
  });

  const nextProfile = {
    ...currentProfile,
    favoriteColors: mergedColors.favoriteColors,
    dislikedColors: mergedColors.dislikedColors,
  };

  if (hasStyleProfile) {
    return {
      ...base,
      styleProfile: nextProfile,
    };
  }

  if (base && Object.keys(base).length > 0) {
    return {
      ...base,
      ...nextProfile,
    };
  }

  return { styleProfile: nextProfile };
}
