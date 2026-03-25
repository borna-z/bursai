export const PREMIUM_BULK_ADD_SELECTION_LIMIT = 50;

export function getBulkAddSelectionLimit(remainingGarments: number): number {
  return Math.max(0, Math.min(PREMIUM_BULK_ADD_SELECTION_LIMIT, remainingGarments));
}
