import { describe, it, expect } from "vitest";
import {
  buildMemoryIdempotencyKey,
  isQuickReactionMissingValue,
  type RecordMemoryEventInput,
} from "../memoryEvents";

describe("buildMemoryIdempotencyKey", () => {
  it("includes user, signal, outfit, empty discriminator, and 60-second bucket", () => {
    const input: RecordMemoryEventInput = {
      signal_type: "save_outfit",
      outfit_id: "11111111-1111-1111-1111-111111111111",
    };
    const key = buildMemoryIdempotencyKey("uA", input, 1700000000000);
    expect(key).toBe(
      "uA:save_outfit:11111111-1111-1111-1111-111111111111::28333333",
    );
  });

  it("uses sorted garment_ids when no outfit_id", () => {
    const input: RecordMemoryEventInput = {
      signal_type: "like_pair",
      garment_ids: ["c", "a", "b"],
    };
    const key = buildMemoryIdempotencyKey("uA", input, 1700000060000);
    expect(key).toBe("uA:like_pair:a,b,c::28333334");
  });

  it("uses single garment_id when no outfit_id and no garment_ids", () => {
    const input: RecordMemoryEventInput = {
      signal_type: "never_suggest_garment",
      garment_id: "g-42",
    };
    const key = buildMemoryIdempotencyKey("uA", input, 1700000000000);
    expect(key).toBe("uA:never_suggest_garment:g-42::28333333");
  });

  it('emits "_" target marker when no outfit/garment fields are set', () => {
    const input: RecordMemoryEventInput = { signal_type: "quick_reaction" };
    const key = buildMemoryIdempotencyKey("uA", input, 1700000000000);
    expect(key).toBe("uA:quick_reaction:_::28333333");
  });

  it("different 60-second buckets produce different keys", () => {
    const input: RecordMemoryEventInput = { signal_type: "save_outfit" };
    expect(buildMemoryIdempotencyKey("u", input, 1700000000000)).not.toBe(
      buildMemoryIdempotencyKey("u", input, 1700000061000),
    );
  });

  it("same minute, identical payload produces same key (double-tap dedup)", () => {
    const input: RecordMemoryEventInput = {
      signal_type: "save_outfit",
      outfit_id: "oA",
    };
    expect(buildMemoryIdempotencyKey("u", input, 1700000000123)).toBe(
      buildMemoryIdempotencyKey("u", input, 1700000020123),
    );
    expect(buildMemoryIdempotencyKey("u", input, 1700000000123)).toBe(
      buildMemoryIdempotencyKey("u", input, 1700000039999),
    );
  });

  it("treats empty-string outfit_id as missing", () => {
    const input: RecordMemoryEventInput = {
      signal_type: "save_outfit",
      outfit_id: "",
      garment_ids: ["a"],
    };
    const key = buildMemoryIdempotencyKey("u", input, 1700000000000);
    expect(key).toBe("u:save_outfit:a::28333333");
  });

  // Payload-discriminator cases — guard against the P1 collapse where
  // distinct semantic events on the same outfit/garment within one minute
  // would otherwise collide and the second write would be replay-deduped.

  it("different quick_reaction values on same outfit produce different keys", () => {
    const baseAt = 1700000000000;
    const like: RecordMemoryEventInput = {
      signal_type: "quick_reaction",
      outfit_id: "oA",
      value: "like",
    };
    const love: RecordMemoryEventInput = {
      signal_type: "quick_reaction",
      outfit_id: "oA",
      value: "love",
    };
    expect(buildMemoryIdempotencyKey("u", like, baseAt)).not.toBe(
      buildMemoryIdempotencyKey("u", love, baseAt),
    );
  });

  it("different ratings on same outfit produce different keys", () => {
    const baseAt = 1700000000000;
    const r2: RecordMemoryEventInput = {
      signal_type: "rate_outfit",
      outfit_id: "oA",
      rating: 2,
    };
    const r5: RecordMemoryEventInput = {
      signal_type: "rate_outfit",
      outfit_id: "oA",
      rating: 5,
    };
    expect(buildMemoryIdempotencyKey("u", r2, baseAt)).not.toBe(
      buildMemoryIdempotencyKey("u", r5, baseAt),
    );
  });

  it("different swap garment sets on same outfit produce different keys", () => {
    const baseAt = 1700000000000;
    const swapA: RecordMemoryEventInput = {
      signal_type: "swap_garment",
      outfit_id: "oA",
      added_garment_ids: ["g1"],
      removed_garment_ids: ["g2"],
    };
    const swapB: RecordMemoryEventInput = {
      signal_type: "swap_garment",
      outfit_id: "oA",
      added_garment_ids: ["g3"],
      removed_garment_ids: ["g4"],
    };
    expect(buildMemoryIdempotencyKey("u", swapA, baseAt)).not.toBe(
      buildMemoryIdempotencyKey("u", swapB, baseAt),
    );
  });

  it("different feedback_text on same outfit produces different keys", () => {
    const baseAt = 1700000000000;
    const fb1: RecordMemoryEventInput = {
      signal_type: "reject_outfit",
      outfit_id: "oA",
      feedback_text: "too formal for the weather",
    };
    const fb2: RecordMemoryEventInput = {
      signal_type: "reject_outfit",
      outfit_id: "oA",
      feedback_text: "colors clash",
    };
    expect(buildMemoryIdempotencyKey("u", fb1, baseAt)).not.toBe(
      buildMemoryIdempotencyKey("u", fb2, baseAt),
    );
  });

  it("different metadata on same outfit produces different keys", () => {
    const baseAt = 1700000000000;
    const m1: RecordMemoryEventInput = {
      signal_type: "save_outfit",
      outfit_id: "oA",
      metadata: { source: "home" },
    };
    const m2: RecordMemoryEventInput = {
      signal_type: "save_outfit",
      outfit_id: "oA",
      metadata: { source: "outfit_detail" },
    };
    expect(buildMemoryIdempotencyKey("u", m1, baseAt)).not.toBe(
      buildMemoryIdempotencyKey("u", m2, baseAt),
    );
  });

  it("metadata key order does not affect the key", () => {
    const baseAt = 1700000000000;
    const a: RecordMemoryEventInput = {
      signal_type: "save_outfit",
      outfit_id: "oA",
      metadata: { a: 1, b: 2, nested: { y: 9, x: 8 } },
    };
    const b: RecordMemoryEventInput = {
      signal_type: "save_outfit",
      outfit_id: "oA",
      metadata: { nested: { x: 8, y: 9 }, b: 2, a: 1 },
    };
    expect(buildMemoryIdempotencyKey("u", a, baseAt)).toBe(
      buildMemoryIdempotencyKey("u", b, baseAt),
    );
  });

  it("added_garment_ids order does not affect the key", () => {
    const baseAt = 1700000000000;
    const a: RecordMemoryEventInput = {
      signal_type: "swap_garment",
      outfit_id: "oA",
      added_garment_ids: ["g1", "g2", "g3"],
      removed_garment_ids: ["g7", "g8"],
    };
    const b: RecordMemoryEventInput = {
      signal_type: "swap_garment",
      outfit_id: "oA",
      added_garment_ids: ["g3", "g1", "g2"],
      removed_garment_ids: ["g8", "g7"],
    };
    expect(buildMemoryIdempotencyKey("u", a, baseAt)).toBe(
      buildMemoryIdempotencyKey("u", b, baseAt),
    );
  });

  it("identical full payload twice within a minute still dedups", () => {
    const baseAt = 1700000000000;
    const input: RecordMemoryEventInput = {
      signal_type: "rate_outfit",
      outfit_id: "oA",
      rating: 4,
      value: "love",
      metadata: { source: "outfit_detail" },
    };
    expect(buildMemoryIdempotencyKey("u", input, baseAt)).toBe(
      buildMemoryIdempotencyKey("u", input, baseAt + 30_000),
    );
  });
});

describe("isQuickReactionMissingValue", () => {
  it("flags quick_reaction with no value", () => {
    expect(
      isQuickReactionMissingValue({ signal_type: "quick_reaction" }),
    ).toBe(true);
  });

  it("flags quick_reaction with empty-string value", () => {
    expect(
      isQuickReactionMissingValue({
        signal_type: "quick_reaction",
        value: "",
      }),
    ).toBe(true);
  });

  it("does not flag quick_reaction with valid value", () => {
    expect(
      isQuickReactionMissingValue({
        signal_type: "quick_reaction",
        value: "like",
      }),
    ).toBe(false);
  });

  it("does not flag non-reaction signals", () => {
    expect(
      isQuickReactionMissingValue({ signal_type: "save_outfit" }),
    ).toBe(false);
    expect(
      isQuickReactionMissingValue({ signal_type: "wear_outfit" }),
    ).toBe(false);
  });
});
