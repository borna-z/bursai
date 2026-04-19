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

  it("creates a profile row with onboarding.completed=false for a new auth user", async () => {
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
    expect(profile?.display_name).toBeTruthy();
    const prefs = profile?.preferences as { onboarding?: { completed?: boolean } } | null;
    expect(prefs?.onboarding?.completed).toBe(false);
  });
});
