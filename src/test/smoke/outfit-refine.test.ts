import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunAiSmoke,
} from "./harness";

// Invokes `style_chat` (the endpoint that refine flows land on — P28 in the
// Launch Plan). We send a short "hi" message to hit the quick-conversational
// path: it's the cheapest code-path that still routes through callBursAI,
// proves the function is reachable under the local supabase functions serve,
// and returns a valid StyleChatResponseEnvelope-shaped SSE body. The mock
// server intercepts the single Gemini call the quick path makes.
//
// Why not a full refine payload? The refine path requires active_look with
// real garment IDs, pair-memory seeds, a wardrobe that scores high enough to
// produce complete candidate outfits, AND a classifier that returns
// intent=refine_outfit. That's several hundred lines of test setup for a
// smoke test whose job is to prove `style_chat` can be reached + returns a
// 2xx — not to validate refine correctness (which is P28's job).
describe.skipIf(!shouldRunAiSmoke)("smoke: style chat refine (style_chat)", () => {
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

  it("invokes style_chat and receives a 2xx response from the quick-conversational path", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    const { data, error } = await client.functions.invoke("style_chat", {
      body: {
        messages: [{ role: "user", content: "hi" }],
        locale: "en",
      },
    });

    // style_chat returns text/event-stream. supabase-js either parses the
    // SSE body as text, returns it as a ReadableStream, or (on older
    // versions) throws a parse error — the specific shape varies by
    // supabase-js minor version. What a smoke test gates on: no edge-
    // function-level error (no RateLimit, no 500). `error` here is set by
    // supabase-js when the function returns non-2xx.
    expect(error).toBeNull();
    // The returned data should be truthy in every version: either the
    // stream body, a string, or the parsed envelope. We don't assert on
    // its shape here because the P29 prompt will be the one to formalize
    // the refine response envelope.
    expect(data ?? "").toBeTruthy();
  });
});
