/**
 * Wave 8.5 PR B (P86) — legacy test file rewired for the
 * `useFeedbackSignals` alias.
 *
 * The old direct-INSERT path is gone; this hook is now an alias for
 * `useRecordMemoryEvent` (see `useRecordMemoryEvent.test.tsx` for the full
 * behavioural surface). Keep this file as a regression net so file-by-file
 * migration of consumers (most of P86 wave 1) doesn't accidentally break
 * the legacy import path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useFeedbackSignals,
  useRecordMemoryEvent,
} from "../useFeedbackSignals";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/edgeFunctionClient", () => ({
  invokeEdgeFunction: invokeMock,
}));

const useAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/lib/memoryEventQueue", () => ({
  enqueueMemoryEvent: vi.fn(),
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
  invokeMock.mockResolvedValue({
    data: {
      ok: true,
      signal_id: "s",
      event_type: "save_outfit",
      pair_delta: 0,
    },
    error: null,
  });
  useAuthMock.mockReturnValue({ user: { id: "u1" } });
});

describe("useFeedbackSignals (alias for useRecordMemoryEvent)", () => {
  it("is the same export as useRecordMemoryEvent (alias contract)", () => {
    expect(useFeedbackSignals).toBe(useRecordMemoryEvent);
  });

  it("invokes memory_ingest on canonical signal name", async () => {
    const { result } = renderHook(() => useFeedbackSignals(), { wrapper });
    result.current.record({ signal_type: "save_outfit", outfit_id: "oA" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeMock).toHaveBeenCalledWith(
      "memory_ingest",
      expect.any(Object),
    );
  });

  it("invokes memory_ingest on legacy signal name (server normalizes)", async () => {
    const { result } = renderHook(() => useFeedbackSignals(), { wrapper });
    result.current.record({ signal_type: "save", outfit_id: "oA" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    const [, opts] = invokeMock.mock.calls[0];
    expect((opts as { body: { signal_type: string } }).body.signal_type).toBe(
      "save",
    );
  });
});
