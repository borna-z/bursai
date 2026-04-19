import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

describe.skipIf(!shouldRunSmoke)("smoke: plan week", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      // Defensive: auth.users deletion likely cascades to planned_outfits via FK,
      // but deleting explicitly first keeps cleanup robust if the cascade ever changes.
      await admin.from("planned_outfits").delete().eq("user_id", createdUserId);
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("inserts 7 planned_outfits via the authed anon client and queries them back by date range", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    // Exercise the real user path: authed anon-key client, subject to RLS.
    // Admin is reserved for setup/teardown only (user create + row/user delete).
    const client = await getAuthedClient(user.email, user.password);

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const toISODate = (d: Date) => d.toISOString().slice(0, 10);

    const rows = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      return {
        user_id: user.id,
        date: toISODate(d),
        status: "planned",
      };
    });

    const { error: insertError } = await client.from("planned_outfits").insert(rows);
    expect(insertError).toBeNull();

    const endDate = new Date(start);
    endDate.setUTCDate(endDate.getUTCDate() + 6);

    const { data, error: queryError } = await client
      .from("planned_outfits")
      .select("date, status, user_id")
      .eq("user_id", user.id)
      .gte("date", toISODate(start))
      .lte("date", toISODate(endDate))
      .order("date", { ascending: true });

    expect(queryError).toBeNull();
    expect(data).toHaveLength(7);
    expect(data?.[0].date).toBe(toISODate(start));
    expect(data?.[6].date).toBe(toISODate(endDate));
    data?.forEach((row) => {
      expect(row.user_id).toBe(user.id);
      expect(row.status).toBe("planned");
    });
  });
});
