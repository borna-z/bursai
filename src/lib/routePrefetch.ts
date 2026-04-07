/**
 * Route chunk prefetching utilities.
 * Call prefetchRoute on hover/focus of nav links to warm the chunk cache.
 */

const prefetched = new Set<string>();

const routeImports: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Index'),
  '/wardrobe': () => import('@/pages/Wardrobe'),
  '/plan': () => import('@/pages/Plan'),
  '/ai': () => import('@/pages/StyleMe'),
  '/insights': () => import('@/pages/Insights'),
};

/**
 * Prefetch the JS chunk for a route path.
 * Safe to call multiple times — will only load once per session.
 */
export function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;
  const loader = routeImports[path];
  if (loader) {
    prefetched.add(path);
    // Use requestIdleCallback when available for non-blocking prefetch
    const schedule = typeof requestIdleCallback === 'function' ? requestIdleCallback : setTimeout;
    schedule(() => {
      loader().catch(() => {
        // Silent fail — chunk will load normally on navigation
        prefetched.delete(path);
      });
    });
  }
}
