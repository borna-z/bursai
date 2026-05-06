import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRecordMemoryEvent } from "../useFeedbackSignals";

const invokeMock = vi.hoisted(() => vi.fn());
// We import the REAL getHttpStatus from edgeFunctionClient — it correctly
// extracts status from supabase-js FunctionsHttpError shape (`context.status`)
// vs string-shaped errors. Without this, the hook can't distinguish the two
// and 4xx detection regresses to message-regex only.
vi.mock("@/lib/edgeFunctionClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/edgeFunctionClient")>(
    "@/lib/edgeFunctionClient",
  );
  return {
    ...actual,
    invokeEdgeFunction: invokeMock,
  };
});

// Wave 8.5 PR B (P86) — useRecordMemoryEvent calls useAuthOrNull (the
// non-throwing variant) so it can be safely mounted inside isolated
// component tests that lack an AuthProvider. For unit tests we mock the
// helper directly.
const useAuthOrNullMock = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({
  useAuthOrNull: useAuthOrNullMock,
}));

const enqueueMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/memoryEventQueue", () => ({
  enqueueMemoryEvent: enqueueMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  invokeMock.mockReset();
  enqueueMock.mockReset();
  enqueueMock.mockResolvedValue(undefined);
  useAuthOrNullMock.mockReset();
  useAuthOrNullMock.mockReturnValue({ user: { id: "uA" } });
});

describe("useRecordMemoryEvent", () => {
  it("invokes memory_ingest with body shape + idempotency-key payload", async () => {
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        signal_id: "sig1",
        event_type: "save_outfit",
        pair_delta: 0,
      },
      error: null,
    });
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({ signal_type: "save_outfit", outfit_id: "oA" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeMock).toHaveBeenCalledWith(
      "memory_ingest",
      expect.objectContaining({
        body: expect.objectContaining({
          signal_type: "save_outfit",
          outfit_id: "oA",
          // Empty discriminator segment is intentional — `save_outfit` with
          // only outfit_id has no payload-differentiating fields, so
          // `buildPayloadDiscriminator` returns "" and the key has the
          // shape `user:signal:target::bucket`. Codex P1 fix on PR #726
          // (commit 45b39878) added the discriminator slot; this test was
          // missed in that update and surfaced when the launch-branch sync
          // (PR #741) ran the test against the post-fix code path.
          idempotency_key: expect.stringMatching(/^uA:save_outfit:oA::\d+$/),
        }),
        retries: 3,
        timeout: 8000,
      }),
    );
  });

  it("no-ops when user is not authenticated", () => {
    useAuthOrNullMock.mockReturnValue({ user: null });
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({ signal_type: "save_outfit" });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("no-ops when no AuthProvider is in scope (useAuthOrNull returns null)", () => {
    useAuthOrNullMock.mockReturnValue(null);
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({ signal_type: "save_outfit" });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("DROPS quick_reaction without value (PR A audit P0-1)", async () => {
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({ signal_type: "quick_reaction" });
    // give the mutation queue a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(invokeMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("invokes for quick_reaction WITH value", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, signal_id: "s", event_type: "quick_reaction", pair_delta: 0 },
      error: null,
    });
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({
      signal_type: "quick_reaction",
      outfit_id: "oA",
      value: "love",
    });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
  });

  it("enqueues to offline queue on 5xx / transport error", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: new Error("500 internal"),
    });
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({ signal_type: "save_outfit", outfit_id: "oA" });
    await waitFor(() => expect(enqueueMock).toHaveBeenCalledTimes(1));
    expect(enqueueMock).toHaveBeenCalledWith(
      "uA",
      expect.objectContaining({ signal_type: "save_outfit", outfit_id: "oA" }),
    );
  });

  it("does NOT enqueue on 4xx-class errors (string-fallback path)", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: new Error("400 invalid signal_type"),
    });
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({ signal_type: "save_outfit", outfit_id: "oA" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  // Audit R5-F1 + R5-F8: canonical supabase-js FunctionsHttpError shape
  // carries the status on `error.context.status`, not in `error.message`.
  // The original implementation regex-matched err.message only, so 402
  // subscription_required (the production-typical 4xx) silently enqueued
  // forever. These tests lock in the new `getHttpStatus()`-first detection.
  it("does NOT enqueue on 402 with FunctionsHttpError shape (context.status)", async () => {
    const httpError = Object.assign(
      new Error("Edge Function returned a non-2xx status code"),
      { context: { status: 402 } },
    );
    invokeMock.mockResolvedValue({ data: null, error: httpError });
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({ signal_type: "save_outfit", outfit_id: "oA" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("DOES enqueue on 500 with FunctionsHttpError shape (context.status)", async () => {
    const httpError = Object.assign(
      new Error("Edge Function returned a non-2xx status code"),
      { context: { status: 500 } },
    );
    invokeMock.mockResolvedValue({ data: null, error: httpError });
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({ signal_type: "save_outfit", outfit_id: "oA" });
    await waitFor(() => expect(enqueueMock).toHaveBeenCalledTimes(1));
  });

  it("does NOT enqueue on 429 (rate-limit — retry futile)", async () => {
    const httpError = Object.assign(
      new Error("Edge Function returned a non-2xx status code"),
      { context: { status: 429 } },
    );
    invokeMock.mockResolvedValue({ data: null, error: httpError });
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({ signal_type: "save_outfit", outfit_id: "oA" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("record callback identity is stable across re-renders (audit P86 P0-1)", () => {
    invokeMock.mockResolvedValue({ data: null, error: null });
    const { result, rerender } = renderHook(() => useRecordMemoryEvent(), {
      wrapper,
    });
    const recordA = result.current.record;
    rerender();
    const recordB = result.current.record;
    rerender();
    const recordC = result.current.record;
    expect(recordA).toBe(recordB);
    expect(recordB).toBe(recordC);
  });

  it("passes complex metadata (numbers, arrays) without coercion", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, signal_id: "s", event_type: "save_outfit", pair_delta: 0 },
      error: null,
    });
    const { result } = renderHook(() => useRecordMemoryEvent(), { wrapper });
    result.current.record({
      signal_type: "save_outfit",
      outfit_id: "oA",
      metadata: {
        garment_count: 3,
        slots: ["top", "bottom", "shoes"],
        nested: { context: "test" },
      },
    });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const [, opts] = invokeMock.mock.calls[0];
    const body = (opts as { body: { metadata: Record<string, unknown> } }).body;
    expect(body.metadata.garment_count).toBe(3);
    expect(body.metadata.slots).toEqual(["top", "bottom", "shoes"]);
    expect(body.metadata.nested).toEqual({ context: "test" });
  });
});
