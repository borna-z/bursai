/**
 * URL-parameter validators used before issuing Supabase queries.
 *
 * Purpose: reject malformed input at the React route layer so the request
 * never reaches Postgres. Protects against:
 *   - 22P02 "invalid input syntax for type uuid" error leaks in RLS logs
 *   - enumeration / fuzzing against username columns with oddly-shaped inputs
 *
 * Keep this module dependency-free — it's imported from page components and
 * we don't want to pull in runtime validation libraries for two regex checks.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if the input matches the canonical 8-4-4-4-12 UUID shape
 * (case-insensitive). Does NOT validate version or variant bits — Postgres
 * does that server-side if we ever care.
 */
export function isUuid(value: string | undefined | null): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

// Usernames are user-picked handles for public profile URLs. Allow letters,
// digits, underscores; length 3-32. Matches the server-side constraint used
// when `public_profiles.username` was introduced.
const USERNAME_REGEX = /^[a-z0-9_]{3,32}$/i;

export function isValidUsername(value: string | undefined | null): value is string {
  return typeof value === 'string' && USERNAME_REGEX.test(value);
}
