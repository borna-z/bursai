import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ingestMemoryEvent,
  type IngestMemoryEventInput,
} from "../style-memory-ingest.ts";

// ────────────────────────────────────────────────────────────────────
// Mock supabase service-role client
//
// The helper only invokes `serviceClient.rpc(name, args)` and reads back
// `{ data, error }`. The mock returns whatever the test wires up via the
// per-test `setRpcResponse` setter and records every invocation so we can
// assert on argument shape.
// ────────────────────────────────────────────────────────────────────

interface MockSupabase {
  rpc: ReturnType<typeof vi.fn>;
  /** Configure the next RPC's resolved response. */
  setRpcResponse: (response: { data: unknown; error: unknown }) => void;
  /** Configure the next RPC to throw synchronously (transport failure). */
  setRpcThrow: (err: Error) => void;
}

function createMockSupabase(): MockSupabase {
  let nextResponse: { data: unknown; error: unknown } | null = {
    data: null,
    error: null,
  };
  let nextThrow: Error | null = null;

  const rpc = vi.fn(async (_name: string, _args: unknown) => {
    if (nextThrow) {
      const err = nextThrow;
      // Reset so subsequent calls go back to the response path.
      nextThrow = null;
      throw err;
    }
    return nextResponse;
  });

  return {
    rpc,
    setRpcResponse(response) {
      nextResponse = response;
    },
    setRpcThrow(err) {
      nextThrow = err;
    },
  };
}

// Suppress console output from the helper during tests; restore afterwards.
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

// ────────────────────────────────────────────────────────────────────
// Canonical / legacy normalization at the helper boundary
// ────────────────────────────────────────────────────────────────────

describe("ingestMemoryEvent — normalization", () => {
  it("passes a canonical event_type straight through to the RPC", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: {
        ok: true,
        signal_id: "11111111-1111-1111-1111-111111111111",
        event_type: "save_outfit",
        pair_delta: 1,
      },
      error: null,
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "save_outfit",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b", "g-c"],
    });

    expect(result.ok).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "ingest_memory_event",
      expect.objectContaining({
        p_user_id: "user-1",
        p_event_type: "save_outfit",
        p_outfit_id: "outfit-1",
        p_garment_ids: ["g-a", "g-b", "g-c"],
      }),
    );
  });

  it("normalizes a legacy 'save' event_type to 'save_outfit' before the RPC call", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: {
        ok: true,
        signal_id: "22222222-2222-2222-2222-222222222222",
        event_type: "save_outfit",
        pair_delta: 1,
      },
      error: null,
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "save", // legacy shorthand emitted by current useFeedbackSignals
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.eventType).toBe("save_outfit");
    }
    // Critical: the RPC must see the canonical name, not the legacy alias.
    const args = supabase.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.p_event_type).toBe("save_outfit");
  });

  it("normalizes legacy swap_choice to swap_garment", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: {
        ok: true,
        signal_id: "33333333-3333-3333-3333-333333333333",
        event_type: "swap_garment",
        pair_delta: 0,
      },
      error: null,
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "swap_choice",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b", "g-c"],
      removedGarmentIds: ["g-old"],
      addedGarmentIds: ["g-c"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.eventType).toBe("swap_garment");
    }
    const args = supabase.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.p_event_type).toBe("swap_garment");
    expect(args.p_removed_garment_ids).toEqual(["g-old"]);
    expect(args.p_added_garment_ids).toEqual(["g-c"]);
  });

  it("normalizes legacy 'rating' to 'rate_outfit' and forwards p_rating", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: {
        ok: true,
        signal_id: "44444444-4444-4444-4444-444444444444",
        event_type: "rate_outfit",
        pair_delta: 1,
      },
      error: null,
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "rating",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
      rating: 5,
    });

    expect(result.ok).toBe(true);
    const args = supabase.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.p_event_type).toBe("rate_outfit");
    expect(args.p_rating).toBe(5);
  });

  it("collapses lossy legacy 'dislike' to 'quick_reaction' (caller enriches metadata.value)", async () => {
    // Per Wave 8.5 P83 §LEGACY_TO_CANONICAL: dislike/like/thumbs_down all
    // collapse to quick_reaction. Direction information must be carried in
    // metadata.value at the call site — the helper just forwards the value.
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: {
        ok: true,
        signal_id: "55555555-5555-5555-5555-555555555555",
        event_type: "quick_reaction",
        pair_delta: -1,
      },
      error: null,
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "dislike",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
      value: "dislike",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.eventType).toBe("quick_reaction");
    }
    const args = supabase.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.p_event_type).toBe("quick_reaction");
    expect(args.p_value).toBe("dislike");
  });
});

// ────────────────────────────────────────────────────────────────────
// Unknown / dead-enum handling
// ────────────────────────────────────────────────────────────────────

describe("ingestMemoryEvent — unknown signal handling", () => {
  it("returns {ok:false, error:'unknown_signal_type'} for a totally unknown event_type and does NOT call the RPC", async () => {
    const supabase = createMockSupabase();
    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "absolutely_not_a_signal_name",
      outfitId: "outfit-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("unknown_signal_type");
      expect(result.originalEventType).toBe("absolutely_not_a_signal_name");
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns {ok:false, error:'unknown_signal_type'} for the dead 'garment_edit' enum (P82 confirmed never emitted)", async () => {
    const supabase = createMockSupabase();
    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "garment_edit",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("unknown_signal_type");
      expect(result.originalEventType).toBe("garment_edit");
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects empty string event_type without calling the RPC", async () => {
    const supabase = createMockSupabase();
    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("unknown_signal_type");
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects case-mismatch event_type ('Save_Outfit') because normalization is case-sensitive", async () => {
    const supabase = createMockSupabase();
    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "Save_Outfit",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("unknown_signal_type");
    }
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────
// RPC error handling
// ────────────────────────────────────────────────────────────────────

describe("ingestMemoryEvent — RPC error handling", () => {
  it("returns {ok:false, error:'rpc_failed'} when the RPC returns an error envelope", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "save_outfit",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("rpc_failed");
      expect(result.message).toBe("permission denied");
    }
  });

  it("returns {ok:false, error:'rpc_failed'} when the RPC throws (transport failure)", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcThrow(new Error("connection reset"));

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "save_outfit",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("rpc_failed");
      expect(result.message).toBe("connection reset");
    }
  });

  it("returns {ok:false, error:'rpc_failed'} when the RPC returns ok:false in the body (malformed response)", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: { ok: false, signal_id: null },
      error: null,
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "save_outfit",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("rpc_failed");
    }
  });

  it("returns {ok:false, error:'rpc_failed'} when the RPC returns null body", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({ data: null, error: null });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "save_outfit",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("rpc_failed");
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// Successful return shape
// ────────────────────────────────────────────────────────────────────

describe("ingestMemoryEvent — successful return shape", () => {
  it("returns the structured result with signalId, eventType, and pairDelta", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: {
        ok: true,
        signal_id: "abcdef00-0000-0000-0000-000000000000",
        event_type: "save_outfit",
        pair_delta: 1,
      },
      error: null,
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "save_outfit",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.signalId).toBe("abcdef00-0000-0000-0000-000000000000");
      expect(result.eventType).toBe("save_outfit");
      expect(result.pairDelta).toBe(1);
    }
  });

  it("coerces missing pair_delta to 0 (defensive against RPC drift)", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: {
        ok: true,
        signal_id: "abcdef01-0000-0000-0000-000000000000",
        event_type: "wear_outfit",
        // pair_delta missing
      },
      error: null,
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "wear_outfit",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pairDelta).toBe(0);
    }
  });

  it("coerces missing signal_id to empty string (defensive against RPC drift)", async () => {
    const supabase = createMockSupabase();
    supabase.setRpcResponse({
      data: {
        ok: true,
        // signal_id missing
        event_type: "wear_outfit",
        pair_delta: 1,
      },
      error: null,
    });

    const result = await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "wear_outfit",
      outfitId: "outfit-1",
      garmentIds: ["g-a", "g-b"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.signalId).toBe("");
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// RPC argument shape — cross-validate every documented field threads
// through correctly per the migration's `ingest_memory_event` signature.
// ────────────────────────────────────────────────────────────────────

describe("ingestMemoryEvent — RPC argument shape", () => {
  function rpcArgsFromCall(supabase: MockSupabase): Record<string, unknown> {
    return supabase.rpc.mock.calls[0]![1] as Record<string, unknown>;
  }

  function rpcOk(supabase: MockSupabase, eventType: string): void {
    supabase.setRpcResponse({
      data: {
        ok: true,
        signal_id: "00000000-0000-0000-0000-000000000000",
        event_type: eventType,
        pair_delta: 0,
      },
      error: null,
    });
  }

  it("threads p_outfit_id, p_garment_ids, p_removed_garment_ids, p_added_garment_ids", async () => {
    const supabase = createMockSupabase();
    rpcOk(supabase, "swap_garment");

    await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "swap_garment",
      outfitId: "outfit-1",
      garmentIds: ["a", "b", "c"],
      removedGarmentIds: ["x"],
      addedGarmentIds: ["c"],
    });

    const args = rpcArgsFromCall(supabase);
    expect(args.p_user_id).toBe("user-1");
    expect(args.p_outfit_id).toBe("outfit-1");
    expect(args.p_garment_ids).toEqual(["a", "b", "c"]);
    expect(args.p_removed_garment_ids).toEqual(["x"]);
    expect(args.p_added_garment_ids).toEqual(["c"]);
  });

  it("defaults missing arrays to [] and missing scalars to null", async () => {
    const supabase = createMockSupabase();
    rpcOk(supabase, "save_outfit");

    await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "save_outfit",
      // No garment_ids, no removed/added, no rating, no metadata.
    });

    const args = rpcArgsFromCall(supabase);
    expect(args.p_garment_ids).toEqual([]);
    expect(args.p_removed_garment_ids).toEqual([]);
    expect(args.p_added_garment_ids).toEqual([]);
    expect(args.p_rating).toBeNull();
    expect(args.p_feedback_text).toBeNull();
    expect(args.p_value).toBeNull();
    expect(args.p_source).toBeNull();
    expect(args.p_outfit_id).toBeNull();
    expect(args.p_metadata).toEqual({});
  });

  it("threads p_rating, p_feedback_text, p_value, p_metadata, p_source", async () => {
    const supabase = createMockSupabase();
    rpcOk(supabase, "rate_outfit");

    await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "rate_outfit",
      outfitId: "outfit-1",
      garmentIds: ["a", "b"],
      rating: 4,
      feedbackText: "Great drape, slightly stiff at the collar",
      value: "positive",
      metadata: { tags: ["work", "summer"] },
      source: "OutfitDetail",
    });

    const args = rpcArgsFromCall(supabase);
    expect(args.p_rating).toBe(4);
    expect(args.p_feedback_text).toBe("Great drape, slightly stiff at the collar");
    expect(args.p_value).toBe("positive");
    expect(args.p_metadata).toEqual({ tags: ["work", "summer"] });
    expect(args.p_source).toBe("OutfitDetail");
  });

  it("calls the RPC with the canonical event_type even when the input is legacy", async () => {
    const supabase = createMockSupabase();
    rpcOk(supabase, "wear_outfit");

    const input: IngestMemoryEventInput = {
      userId: "user-1",
      eventType: "wear_confirm", // legacy
      outfitId: "outfit-1",
      garmentIds: ["a", "b"],
    };

    await ingestMemoryEvent(supabase, input);

    const args = rpcArgsFromCall(supabase);
    expect(args.p_event_type).toBe("wear_outfit");
  });

  it("uses 'ingest_memory_event' as the RPC name (not legacy)", async () => {
    const supabase = createMockSupabase();
    rpcOk(supabase, "save_outfit");

    await ingestMemoryEvent(supabase, {
      userId: "user-1",
      eventType: "save_outfit",
      outfitId: "outfit-1",
      garmentIds: ["a", "b"],
    });

    expect(supabase.rpc.mock.calls[0]![0]).toBe("ingest_memory_event");
  });
});
