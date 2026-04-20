import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunAiSmoke,
} from "./harness";

// Invokes `shopping_chat`. The function is a streaming chat endpoint that
// hits streamBursAI — the mock Gemini server returns an SSE stream that
// matches OpenAI's `chat.completion.chunk` shape. shopping_chat pipes the
// upstream body through, so the client receives SSE chunks. Smoke test
// assertion: the invoke returns without error, response is non-empty.
// Correctness of the streaming protocol itself is tested in prompt-builder
// level unit tests (out of scope for a smoke).
describe.skipIf(!shouldRunAiSmoke)("smoke: shopping chat (shopping_chat)", () => {
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

  it("invokes shopping_chat with a short casual message and receives a 2xx streaming response", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    const { data, error } = await client.functions.invoke("shopping_chat", {
      body: {
        // CHAT_SHORT_RE ("hi|hey|thanks|ok|...") triggers the
        // conversational fast path in shopping_chat. That routes through
        // streamBursAI with complexity:"trivial", max_tokens:120 — one
        // quick Gemini call intercepted by the mock.
        messages: [{ role: "user", content: "hi" }],
        locale: "en",
      },
    });

    expect(error).toBeNull();
    // Shopping chat returns text/event-stream. supabase-js surfaces this
    // as a Blob / stream / parsed string depending on version. In every
    // version, a successful call yields truthy `data`.
    expect(data ?? "").toBeTruthy();
  });
});
