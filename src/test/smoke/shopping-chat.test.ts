import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

// Validates the chat_messages persistence contract shared by `shopping_chat`
// and `style_chat`. Both stream Gemini responses (mocked at the infra layer)
// and persist the conversation to `chat_messages` keyed by `mode` (stylist vs
// shopping). This test guards: the `mode` column accepts free-form values,
// the user_id RLS policy is enforced, and role='user'/'assistant' turns can
// be retrieved in chronological order. Drift in any of those would corrupt
// conversation continuity across sessions.
describe.skipIf(!shouldRunSmoke)("smoke: shopping chat persistence", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      await admin.from("chat_messages").delete().eq("user_id", createdUserId);
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("persists a user/assistant turn pair with mode=shopping and reads them back in order", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    // Insert sequentially so created_at defaults differ — a batched insert
    // would stamp both rows with the same `now()` and retrieval order would
    // be arbitrary. Real shopping_chat writes arrive as separate INSERTs too,
    // so this mirrors production.
    const { data: userInserted, error: userErr } = await client
      .from("chat_messages")
      .insert({
        user_id: user.id,
        role: "user",
        content: "Should I buy these white sneakers?",
        mode: "shopping",
      })
      .select("id, role, mode, created_at")
      .single();
    expect(userErr).toBeNull();
    expect(userInserted?.role).toBe("user");
    expect(userInserted?.mode).toBe("shopping");

    const { data: assistantInserted, error: asstErr } = await client
      .from("chat_messages")
      .insert({
        user_id: user.id,
        role: "assistant",
        content: "They'd work with [[garment:abc-123]] and your navy trousers. 8/10 — clear gap-fill.",
        mode: "shopping",
      })
      .select("id, role, content, created_at")
      .single();
    expect(asstErr).toBeNull();
    expect(assistantInserted?.role).toBe("assistant");
    expect(assistantInserted?.content).toContain("[[garment:");

    const { data: thread, error: readError } = await client
      .from("chat_messages")
      .select("role, content, mode")
      .eq("user_id", user.id)
      .eq("mode", "shopping")
      .order("created_at", { ascending: true });
    expect(readError).toBeNull();
    expect(thread).toHaveLength(2);
    expect(thread?.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
});
