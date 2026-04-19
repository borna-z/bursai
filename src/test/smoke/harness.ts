import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_TEST ?? "";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";

export const shouldRunSmoke = Boolean(
  process.env.RUN_SMOKE === "1" && SUPABASE_URL && SERVICE_ROLE_KEY && ANON_KEY,
);

if (process.env.RUN_SMOKE === "1" && !shouldRunSmoke) {
  // Loud signal: user asked for smoke but env is incomplete.
  console.warn(
    "[smoke] RUN_SMOKE=1 but required env missing — need VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY_TEST, and SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY). Tests will skip.",
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
