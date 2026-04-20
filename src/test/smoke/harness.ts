import { createClient, SupabaseClient } from "@supabase/supabase-js";

// SMOKE_TARGET selects which Supabase the suite runs against:
//   - "prod"  (default)  Credentials come from VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY_TEST
//                        + SUPABASE_ANON_KEY secrets. Used by the post-merge `smoke` CI job.
//   - "local"            CI boots a fresh Supabase stack via `supabase start`. The step
//                        exports SUPABASE_URL + anon/service keys from `supabase status`
//                        to the environment so the harness reads them through the same
//                        env-var names. No hardcoded keys — whatever the CLI version
//                        generates at boot time is authoritative.
// This variable is also the signal that downstream plumbing (e.g. the mock HTTP server
// from src/test/smoke/mocks/) should be booted. P0d-ii does not yet boot it; P0d-iii
// will, when the first Gemini/Stripe-dependent test needs it.
export type SmokeTarget = "local" | "prod";
export const SMOKE_TARGET: SmokeTarget =
  process.env.SMOKE_TARGET === "local" ? "local" : "prod";

// P0d-iii: SUPABASE_URL takes precedence over VITE_SUPABASE_URL so a local
// smoke run (shell sets SUPABASE_URL=http://127.0.0.1:54321) is NOT silently
// overridden by `.env.local`'s VITE_SUPABASE_URL=https://<prod>.supabase.co
// that vitest auto-loads. Same precedence for ANON_KEY. Prod smoke only has
// VITE_* available, so the fallback chain is still correct for that target.
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_TEST ?? "";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";

export const shouldRunSmoke = Boolean(
  process.env.RUN_SMOKE === "1" && SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY,
);

// P0d-iii: AI edge function tests can only run when a local mock Gemini is
// reachable from the edge-runtime container. The mock is started via
// `src/test/smoke/mocks/start-mock-server.ts`; CI exports
// GEMINI_URL_OVERRIDE into the functions runtime via `--env-file`, and
// re-exports it into the test process as a sentinel the 7 AI tests check.
// In smoke-prod we intentionally skip these: the prod stack would hit real
// Gemini and burn cost + flakiness.
export const shouldRunAiSmoke = Boolean(
  shouldRunSmoke && process.env.GEMINI_URL_OVERRIDE,
);

if (process.env.RUN_SMOKE === "1" && !shouldRunSmoke) {
  // Loud signal: user asked for smoke but env is incomplete.
  console.warn(
    `[smoke] RUN_SMOKE=1 but required env missing (SMOKE_TARGET=${SMOKE_TARGET}) — need VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY_TEST, and SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY). Tests will skip.`,
  );
}
if (shouldRunSmoke && SMOKE_TARGET === "local" && !shouldRunAiSmoke) {
  // Loud signal: local target should have the mock up — missing it means CI
  // forgot to wire start-mock-server.ts and the AI tests will silently skip.
  console.warn(
    "[smoke] SMOKE_TARGET=local but GEMINI_URL_OVERRIDE is unset — the 7 AI smoke tests will skip. Ensure the mock server was started and its URL exported to both `supabase functions serve --env-file` and the vitest process.",
  );
}

export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createTestUser(
  admin: SupabaseClient,
): Promise<TestUser> {
  const email = `test_${crypto.randomUUID()}@smoketest.burs.invalid`;
  const password = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  if (!data.user) throw new Error("createUser returned no user");
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

export async function getAuthedClient(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1h — older than a realistic CI run
const TEST_EMAIL_SUFFIX = "@smoketest.burs.invalid";

/**
 * Purge orphaned test users left behind by crashed/cancelled runs.
 * Scans auth.users for `test_*@smoketest.burs.invalid` accounts older than 1h,
 * then for each: sweeps DB rows and storage objects that aren't guaranteed to
 * cascade from auth.users delete, finally deletes the auth user.
 *
 * Called from globalSetup so it runs once per smoke suite. Skips users
 * created within the last hour to avoid racing parallel CI runs.
 *
 * Two-phase list: collect every stale ID across all pages first, THEN process.
 * Deleting while paginating shifts subsequent rows backward and causes page
 * advances to skip users — the separate-phases structure avoids that.
 */
export async function purgeStaleTestUsers(admin: SupabaseClient): Promise<void> {
  const cutoff = Date.now() - STALE_THRESHOLD_MS;
  const staleIds: string[] = [];
  const perPage = 200;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const u of users) {
      if (!u.email?.endsWith(TEST_EMAIL_SUFFIX)) continue;
      const created = u.created_at ? Date.parse(u.created_at) : 0;
      if (created < cutoff) staleIds.push(u.id);
    }

    if (users.length < perPage) break;
  }

  for (const id of staleIds) {
    await purgeUserArtifacts(admin, id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
}

/**
 * Best-effort cleanup of everything a smoke test might have left behind for a
 * given user, other than auth.users itself. Failures are logged (so the signal
 * isn't silent) but don't abort the purge — next run retries whatever stuck.
 *
 * Artifacts handled here correspond to what the three shipped tests create:
 *   - garments storage objects under `<userId>/` in the `garments` bucket
 *   - `garments` table rows
 *   - `planned_outfits` table rows
 *
 * Tables that cascade from auth.users via foreign key (profiles,
 * user_subscriptions, etc.) are not swept — auth.users delete handles them.
 * When P0d-iii adds tests for outfits/wear_logs/etc., extend this list.
 */
async function purgeUserArtifacts(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const warn = (step: string, error: { message: string } | null) => {
    if (error) console.warn(`[smoke purge] ${step} for ${userId}: ${error.message}`);
  };

  const { data: files, error: listError } = await admin.storage
    .from("garments")
    .list(userId, { limit: 1000 });
  warn("list garments storage", listError);
  if (files && files.length > 0) {
    const paths = files.map((f) => `${userId}/${f.name}`);
    const { error: removeError } = await admin.storage
      .from("garments")
      .remove(paths);
    warn("remove garments storage", removeError);
  }

  const { error: garmentsErr } = await admin
    .from("garments")
    .delete()
    .eq("user_id", userId);
  warn("delete garments rows", garmentsErr);

  const { error: plannedErr } = await admin
    .from("planned_outfits")
    .delete()
    .eq("user_id", userId);
  warn("delete planned_outfits rows", plannedErr);
}
