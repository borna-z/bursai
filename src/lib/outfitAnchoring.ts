export function normalizePreferredGarmentIds(ids: Iterable<string | null | undefined>): string[] {
  const uniqueIds = new Set<string>();

  for (const value of ids) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    uniqueIds.add(trimmed);
  }

  return Array.from(uniqueIds);
}

export function hasPreferredGarmentMatch(
  garmentIds: Iterable<string | null | undefined>,
  preferredGarmentIds: Iterable<string | null | undefined>,
): boolean {
  const preferredIds = new Set(normalizePreferredGarmentIds(preferredGarmentIds));
  if (preferredIds.size === 0) return true;

  for (const garmentId of garmentIds) {
    if (typeof garmentId !== 'string') continue;
    if (preferredIds.has(garmentId.trim())) return true;
  }

  return false;
}
