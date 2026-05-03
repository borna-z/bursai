import { describe, it, expect } from "vitest";
import {
  buildMemoryIdempotencyKey,
  isQuickReactionMissingValue,
  type RecordMemoryEventInput,
} from "../memoryEvents";

describe("buildMemoryIdempotencyKey", () => {
  it("includes user, signal, outfit, and 60-second bucket", () => {
    const input: RecordMemoryEventInput = {
      signal_type: "save_outfit",
      outfit_id: "11111111-1111-1111-1111-111111111111",
    };
    const key = buildMemoryIdempotencyKey("uA", input, 1700000000000);
    expect(key).toBe(
      "uA:save_outfit:11111111-1111-1111-1111-111111111111:28333333",
    );
  });

  it("uses sorted garment_ids when no outfit_id", () => {
    const input: RecordMemoryEventInput = {
      signal_type: "like_pair",
      garment_ids: ["c", "a", "b"],
    };
    const key = buildMemoryIdempotencyKey("uA", input, 1700000060000);
    expect(key).toBe("uA:like_pair:a,b,c:28333334");
  });

  it('emits "_" target marker when no outfit_id and no garment_ids', () => {
    const input: RecordMemoryEventInput = { signal_type: "quick_reaction" };
    const key = buildMemoryIdempotencyKey("uA", input, 1700000000000);
    expect(key).toBe("uA:quick_reaction:_:28333333");
  });

  it("different 60-second buckets produce different keys", () => {
    const input: RecordMemoryEventInput = { signal_type: "save_outfit" };
    expect(buildMemoryIdempotencyKey("u", input, 1700000000000)).not.toBe(
      buildMemoryIdempotencyKey("u", input, 1700000061000),
    );
  });

  it("same minute produces same key (double-tap dedup)", () => {
    // 1700000000123 / 60_000 = 28333333.335 → bucket 28333333
    // 1700000020123 is 20s later → still bucket 28333333
    // 1700000039999 is 39.876s later → still bucket 28333333
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
    // Audit fold-in: OutfitDetail.tsx sets `currentGarmentId: ''` after
    // swap completes — empty string must not poison the target slot.
    const input: RecordMemoryEventInput = {
      signal_type: "save_outfit",
      outfit_id: "",
      garment_ids: ["a"],
    };
    const key = buildMemoryIdempotencyKey("u", input, 1700000000000);
    expect(key).toBe("u:save_outfit:a:28333333");
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
