import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminClient,
  createTestUser,
  deleteTestUser,
  getAuthedClient,
  shouldRunSmoke,
} from "./harness";

describe.skipIf(!shouldRunSmoke)("smoke: garment add + RLS", () => {
  let admin: SupabaseClient;
  beforeAll(() => {
    admin = createAdminClient();
  });
  const createdUserIds: string[] = [];
  const uploadedPaths: string[] = [];

  afterEach(async () => {
    if (uploadedPaths.length > 0) {
      await admin.storage.from("garments").remove(uploadedPaths);
      uploadedPaths.length = 0;
    }
    for (const id of createdUserIds) {
      await admin.from("garments").delete().eq("user_id", id);
      await deleteTestUser(admin, id);
    }
    createdUserIds.length = 0;
  });

  it("owner can upload + insert + read their own garment; a different authed user cannot read it (RLS)", async () => {
    const userA = await createTestUser(admin);
    createdUserIds.push(userA.id);
    const userB = await createTestUser(admin);
    createdUserIds.push(userB.id);

    const imagePath = `${userA.id}/smoke.png`;
    uploadedPaths.push(imagePath);

    // Minimal valid PNG byte sequence (1x1 transparent pixel).
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const clientA = await getAuthedClient(userA.email, userA.password);

    const { error: uploadError } = await clientA.storage
      .from("garments")
      .upload(imagePath, pngBytes, {
        contentType: "image/png",
        upsert: true,
      });
    expect(uploadError).toBeNull();

    const { data: inserted, error: insertError } = await clientA
      .from("garments")
      .insert({
        user_id: userA.id,
        title: "Smoke Test Garment",
        category: "tops",
        color_primary: "black",
        image_path: imagePath,
      })
      .select("id, user_id")
      .single();
    expect(insertError).toBeNull();
    expect(inserted).not.toBeNull();
    expect(inserted?.user_id).toBe(userA.id);
    const garmentId = inserted!.id;

    // Owner reads own garment: should succeed.
    const { data: ownRead, error: ownReadError } = await clientA
      .from("garments")
      .select("id, user_id")
      .eq("id", garmentId)
      .maybeSingle();
    expect(ownReadError).toBeNull();
    expect(ownRead?.id).toBe(garmentId);

    // Another authed user tries to read A's garment: RLS should return no row.
    const clientB = await getAuthedClient(userB.email, userB.password);
    const { data: otherRead, error: otherReadError } = await clientB
      .from("garments")
      .select("id")
      .eq("id", garmentId)
      .maybeSingle();
    expect(otherReadError).toBeNull();
    expect(otherRead).toBeNull();
  });
});
