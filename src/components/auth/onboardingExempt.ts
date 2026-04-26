/**
 * Routes the user can reach without having completed onboarding (Wave 7 P44).
 *
 * Pattern: exact match OR `${path}/...` prefix. So `/auth` covers `/auth`
 * itself + `/auth/callback`; `/share` covers `/share/abc-123`. Defensive
 * additions like `/admin`, `/privacy`, `/terms` aren't currently mounted as
 * routes — listing them here prevents a future deep-link from accidentally
 * trapping a non-completed user inside the onboarding redirect.
 *
 * Lives in its own module (separate from `ProtectedRoute.tsx`) so the
 * `react-refresh/only-export-components` lint rule keeps the component file
 * component-only.
 */
export const ONBOARDING_EXEMPT_PATHS = [
  '/onboarding',
  '/billing',
  '/auth',
  '/admin',
  '/privacy',
  '/terms',
  '/share',
  '/u',
] as const;

/**
 * True if `pathname` is an onboarding-exempt path or a sub-path of one.
 *
 * Implementation detail: the prefix check uses `${p}/` (with trailing slash)
 * so `/uniform` does NOT match `/u`, and `/authenticated` does NOT match
 * `/auth`. Exact matches are also accepted for the bare path.
 */
export function isOnboardingExempt(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
