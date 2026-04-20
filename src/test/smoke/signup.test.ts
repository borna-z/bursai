import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  shouldRunSmoke,
} from "./harness";

describe.skipIf(!shouldRunSmoke)("smoke: signup", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("creates a profile row for a new auth user via the on_auth_user_created trigger", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    // handle_new_user trigger runs on auth.users insert; give it a moment.
    await new Promise((r) => setTimeout(r, 500));

    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, display_name, preferences")
      .eq("id", user.id)
      .single();

    expect(error).toBeNull();
    expect(profile).not.toBeNull();
    expect(profile?.id).toBe(user.id);
    // NOTE: display_name and onboarding completion state are intentionally not
    // asserted. handle_new_user() reads display_name from
    // raw_user_meta_data.full_name; createTestUser() doesn't pass user_metadata,
    // so display_name is NULL on a trigger-created profile — that is correct
    // behaviour, not a bug. preferences.onboarding.completed was never set by
    // the trigger either — per Wave 7 P42, the real onboarding state lives in
    // dedicated profiles columns (onboarding_step, onboarding_completed_at),
    // not inside preferences jsonb. The original assertions were testing
    // fiction — they passed CI only because the prod smoke step silently
    // skipped (see 2026-04-20 Findings Log entry in CLAUDE.md).
  });
});
