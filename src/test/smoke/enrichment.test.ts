import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunAiSmoke,
} from "./harness";

// Invokes `analyze_garment` in `mode: 'enrich'` and asserts the edge function
// returns a structured enrichment payload. Gemini is intercepted by the
// local mock server (see `src/test/smoke/mocks/gemini.ts`); without the mock
// and the GEMINI_URL_OVERRIDE env var, this suite skips gracefully — smoke-
// prod MUST skip here because invoking analyze_garment in prod would hit
// real Gemini (cost + flakiness + potential rate-limit exhaustion).
describe.skipIf(!shouldRunAiSmoke)("smoke: enrichment (analyze_garment)", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  let createdUserId: string | null = null;

  afterEach(async () => {
    if (createdUserId) {
      await admin.from("garments").delete().eq("user_id", createdUserId);
      await deleteTestUser(admin, createdUserId);
      createdUserId = null;
    }
  });

  it("invokes analyze_garment in enrich mode and receives a structured enrichment payload", async () => {
    const user = await createTestUser(admin);
    createdUserId = user.id;

    const client = await getAuthedClient(user.email, user.password);

    // Minimal data URL — analyze_garment accepts `base64Image` as a data URL
    // directly, skipping storage read. 1x1 PNG is enough; the mock Gemini
    // route doesn't inspect the image bytes.
    const tinyPngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const { data, error } = await client.functions.invoke("analyze_garment", {
      body: {
        base64Image: tinyPngDataUrl,
        mode: "enrich",
        locale: "en",
      },
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    // analyze_garment enrich mode returns `{ enrichment, ai_provider }`.
    // The enrichment payload is parsed from the Gemini mock response —
    // see `src/test/smoke/mocks/gemini.ts` for the canonical shape.
    const payload = data as { enrichment?: Record<string, unknown>; ai_provider?: string };
    expect(payload.ai_provider).toBe("burs_ai");
    expect(payload.enrichment).toBeTruthy();
    expect(payload.enrichment?.style_archetype).toBe("minimalist");
    expect(payload.enrichment?.versatility_score).toBe(8);
  });
});
