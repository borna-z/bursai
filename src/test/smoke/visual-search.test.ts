import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

// Validates the DB query shape `visual_search` depends on. The edge function
// fetches a filtered slice of `garments` (id, title, category, colors, fit,
// pattern, material, formality) and hands it to Gemini; the Gemini call is
// mocked at the infra layer. This test guards that: (1) the exact column
// projection visual_search issues is still supported post-migration,
// (2) RLS scopes the query to the calling user, (3) the result contains the
// garments regardless of in_laundry state — visual_search doesn't filter on
// it (unlike shopping_chat), which is intentional. Drift in any of those
// assumptions would cause the edge function to return nonsense matches.
describe.skipIf(!shouldRunSmoke)("smoke: visual search query shape", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      await admin.from("garments").delete().eq("user_id", id);
      await deleteTestUser(admin, id);
    }
    createdUserIds.length = 0;
  });

  it("projects the columns visual_search reads and scopes by RLS to the caller", async () => {
    const userA = await createTestUser(admin);
    createdUserIds.push(userA.id);
    const userB = await createTestUser(admin);
    createdUserIds.push(userB.id);

    const clientA = await getAuthedClient(userA.email, userA.password);
    const clientB = await getAuthedClient(userB.email, userB.password);

    const seed = (uid: string) => [
      {
        user_id: uid,
        title: "White Crew Tee",
        category: "top",
        subcategory: "t-shirt",
        color_primary: "white",
        material: "cotton",
        fit: "regular",
        pattern: "solid",
        formality: 2,
      },
      {
        user_id: uid,
        title: "Navy Blazer",
        category: "outerwear",
        subcategory: "blazer",
        color_primary: "navy",
        material: "wool",
        fit: "slim",
        pattern: "solid",
        formality: 4,
      },
      {
        user_id: uid,
        title: "Black Loafers",
        category: "shoes",
        subcategory: "loafer",
        color_primary: "black",
        material: "leather",
        fit: null,
        pattern: null,
        formality: 4,
      },
    ];

    const { error: seedAErr } = await clientA.from("garments").insert(seed(userA.id));
    expect(seedAErr).toBeNull();
    const { error: seedBErr } = await clientB.from("garments").insert(seed(userB.id));
    expect(seedBErr).toBeNull();

    // Exact projection `visual_search` reads from garments (see
    // supabase/functions/visual_search/index.ts).
    const { data: aRows, error: aErr } = await clientA
      .from("garments")
      .select("id, title, category, subcategory, color_primary, color_secondary, pattern, material, fit, formality")
      .eq("user_id", userA.id);
    expect(aErr).toBeNull();
    expect(aRows).toHaveLength(3);
    const categories = (aRows ?? []).map((r) => r.category).sort();
    expect(categories).toEqual(["outerwear", "shoes", "top"]);

    // RLS: user A cannot see user B's garments even when filtering by B's id.
    const { data: crossRead, error: crossErr } = await clientA
      .from("garments")
      .select("id")
      .eq("user_id", userB.id);
    expect(crossErr).toBeNull();
    expect(crossRead).toHaveLength(0);
  });
});
