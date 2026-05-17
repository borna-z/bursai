// React Query cache key factory — Issue #2 (mobile-app audit, 2026-05-17).
//
// Background
// ----------
// Cache keys for user-scoped queries are spread across 30+ hook files. Each
// site hand-writes `['domain', user?.id, …]`, which has three problems:
//
//   1. **No single source of truth.** A future segmentation change (e.g.
//      adding a tenant-id segment, or moving from `user?.id` to a stable
//      session-derived id) has to touch every site.
//   2. **Easy to forget the user-id segment.** A new hook author can write
//      `['domain', filters]` and ship a cross-user cache collision.
//   3. **Drift between query and invalidate.** The query writes
//      `['garments', userId]` and the mutation invalidates `['garmnets']`
//      (typo) — both type-check because the keys are literal arrays.
//
// The factory below names every scoped key once and returns a `readonly`
// tuple. Call sites pass `user.id` (string-narrowed via the existing
// `enabled: !!user?.id` guard — when the user is signed out the query is
// disabled, so the queryFn never runs and the factory is never invoked).
//
// Anonymous / global queries (weather by city, signed-url by storage path,
// etc.) keep their literal keys — there's no user identity to leak.
//
// Bare-prefix invalidations such as `invalidateQueries({ queryKey:
// ['garments'] })` are intentional broadcast invalidations across every
// user-segmented variant. They stay as literal arrays — the documented
// React Query prefix-match semantics are the right tool there.

// A flexible userId param: string when called from a guarded site,
// `string | undefined` when called from a site that hasn't yet narrowed.
// All call sites in this repo gate the query with `enabled: !!user?.id`,
// so the queryFn doesn't run when the id is undefined — the key shape is
// still registered in the cache index but no data is stored against it.
type Uid = string | undefined;

export const CACHE_KEYS = {
  // Garments
  garments: (userId: Uid) => ['garments', userId] as const,
  garmentsWithFilters: <F>(userId: Uid, filters: F) =>
    ['garments', userId, filters] as const,
  garment: (userId: Uid, id: string | undefined) =>
    ['garment', userId, id] as const,
  garmentsByIds: (userId: Uid, cacheKey: string) =>
    ['garmentsByIds', userId, cacheKey] as const,
  garmentsCount: (userId: Uid) => ['garments-count', userId] as const,
  garmentsSmartCounts: (userId: Uid) =>
    ['garments-smart-counts', userId] as const,

  // Outfits
  outfits: (userId: Uid) => ['outfits', userId] as const,
  outfitsScoped: (userId: Uid, savedOnly: boolean) =>
    ['outfits', userId, savedOnly] as const,
  outfit: (userId: Uid, id: string | undefined) =>
    ['outfit', userId, id] as const,
  outfitFeedback: (userId: Uid, outfitId: string | undefined) =>
    ['outfit_feedback', userId, outfitId] as const,

  // Planned outfits
  plannedOutfits: (userId: Uid, startDate: string, endDate: string) =>
    ['planned_outfits', userId, startDate, endDate] as const,
  plannedOutfit: (userId: Uid, date: string) =>
    ['planned_outfit', userId, date] as const,

  // Insights / stats
  insightsDashboard: (userId: Uid) =>
    ['insights_dashboard', userId] as const,
  wardrobeStats: (userId: Uid) => ['wardrobeStats', userId] as const,
  wardrobeAging: (userId: Uid) => ['wardrobeAging', userId] as const,
  wardrobeAgingGarments: (userId: Uid, bucketId: string, idsKey: string) =>
    ['wardrobeAging.garments', userId, bucketId, idsKey] as const,
  wardrobeGaps: (userId: Uid) => ['wardrobe_gaps', userId] as const,

  // Subscription / billing
  subscription: (userId: Uid) => ['subscription', userId] as const,
  renderCredits: (userId: Uid) => ['render_credits', userId] as const,

  // Chat / style
  chatHistory: (userId: Uid) => ['chatHistory', userId] as const,
  styleDNA: (userId: Uid) => ['styleDNA', userId] as const,
  styleMemoryFacts: (userId: Uid) => ['styleMemoryFacts', userId] as const,
  styleChatGarmentTitles: (userId: Uid, lookupCacheKey: string) =>
    ['styleChatGarmentTitles', userId, lookupCacheKey] as const,

  // Notifications
  notifications: (userId: Uid, limit: number) =>
    ['notifications', userId, limit] as const,
  notificationsAll: (userId: Uid) => ['notifications', userId] as const,
  notificationPrefs: (userId: Uid) => ['notificationPrefs', userId] as const,

  // Calendar
  calendarConnection: (userId: Uid) =>
    ['calendar-connection', userId] as const,
  // NOTE: existing key shape is `['calendar-events', date, userId]` — date
  // precedes userId. Preserved as-is so prefix invalidations
  // (`['calendar-events']`) match unchanged.
  calendarEvents: (userId: Uid, date: string | null | undefined) =>
    ['calendar-events', date, userId] as const,

  // Travel
  travelCapsules: (userId: Uid) => ['travelCapsules', userId] as const,

  // Day / weather context
  daySummary: (
    userId: Uid,
    dayKey: string,
    locale: string,
    eventsHash: string,
    weatherHash: string,
  ) => ['daySummary', userId, dayKey, locale, eventsHash, weatherHash] as const,
  recentlyWornGarmentIds: (userId: Uid, cutoffDate: string) =>
    ['recentlyWornGarmentIds', userId, cutoffDate] as const,

  // Render jobs
  renderJob: (userId: Uid, garmentId: string | null | undefined) =>
    ['render_job', userId, garmentId] as const,

  // M17 / M37 helpers
  m17AccessoryRows: (userId: Uid, idsKey: string) =>
    ['m17AccessoryRows', userId, idsKey] as const,
  m37SwapCandidates: (
    userId: Uid,
    outfitId: string | null | undefined,
    slot: string | null | undefined,
    exclusionKey: string,
  ) => ['m37SwapCandidates', userId, outfitId, slot, exclusionKey] as const,

  // Shopping list
  shoppingList: (userId: Uid) => ['shoppingList', userId] as const,

  // Duplicate detection
  detectDuplicate: <I>(userId: Uid, input: I) =>
    ['detect-duplicate', userId, input] as const,

  // First-run coach (M27) — keys keep their string-suffix form.
  coachTourStep: (userId: Uid) => ['coachTour:step', userId] as const,
  coachTourStatus: (userId: Uid) => ['coachTour:status', userId] as const,
} as const;
