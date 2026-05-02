import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  enqueueMemoryEvent,
  drainMemoryEventQueue,
  peekQueueLength,
  clearQueue,
  MAX_QUEUE_SIZE,
} from "../memoryEventQueue";
import type { RecordMemoryEventInput } from "../memoryEvents";

const sampleInput: RecordMemoryEventInput = {
  signal_type: "save_outfit",
  outfit_id: "11111111-1111-1111-1111-111111111111",
};

beforeEach(async () => {
  await clearQueue();
});

afterEach(async () => {
  await clearQueue();
});

describe("memoryEventQueue (localStorage backend)", () => {
  it("enqueue + peek returns inserted entries", async () => {
    await enqueueMemoryEvent("uA", sampleInput);
    expect(await peekQueueLength()).toBe(1);
  });

  it("drain calls drainer fn for each enqueued entry and clears queue on success", async () => {
    await enqueueMemoryEvent("uA", sampleInput);
    await enqueueMemoryEvent("uA", {
      ...sampleInput,
      signal_type: "wear_outfit",
    });
    const drained: Array<{ userId: string; input: RecordMemoryEventInput }> = [];
    await drainMemoryEventQueue("uA", async (userId, input) => {
      drained.push({ userId, input });
    });
    expect(drained).toHaveLength(2);
    expect(drained[0].input.signal_type).toBe("save_outfit");
    expect(drained[1].input.signal_type).toBe("wear_outfit");
    expect(await peekQueueLength()).toBe(0);
  });

  it("drain skips entries belonging to other users", async () => {
    await enqueueMemoryEvent("uA", sampleInput);
    await enqueueMemoryEvent("uB", sampleInput);
    const drained: Array<{ userId: string }> = [];
    await drainMemoryEventQueue("uA", async (userId) => {
      drained.push({ userId });
    });
    expect(drained).toHaveLength(1);
    expect(await peekQueueLength()).toBe(1); // uB entry remains
  });

  it("drain leaves entry queued if drainer throws", async () => {
    await enqueueMemoryEvent("uA", sampleInput);
    await drainMemoryEventQueue("uA", async () => {
      throw new Error("network down");
    });
    expect(await peekQueueLength()).toBe(1);
  });

  it("drain partial-failure: keeps failing entries, drops successful ones", async () => {
    await enqueueMemoryEvent("uA", { ...sampleInput, source: "first" });
    await enqueueMemoryEvent("uA", { ...sampleInput, source: "second" });
    await enqueueMemoryEvent("uA", { ...sampleInput, source: "third" });
    let callCount = 0;
    await drainMemoryEventQueue("uA", async () => {
      callCount++;
      if (callCount === 2) throw new Error("middle failed");
    });
    expect(callCount).toBe(3);
    expect(await peekQueueLength()).toBe(1);
  });

  it("caps queue at MAX_QUEUE_SIZE and drops oldest on overflow", async () => {
    for (let i = 0; i < MAX_QUEUE_SIZE + 5; i++) {
      await enqueueMemoryEvent("uA", { ...sampleInput, source: `e${i}` });
    }
    expect(await peekQueueLength()).toBe(MAX_QUEUE_SIZE);
    const remaining: string[] = [];
    await drainMemoryEventQueue("uA", async (_userId, input) => {
      remaining.push(input.source ?? "");
    });
    expect(remaining[0]).toBe("e5"); // oldest 5 evicted
    expect(remaining[remaining.length - 1]).toBe(`e${MAX_QUEUE_SIZE + 4}`);
  });

  it("survives corrupted localStorage state", async () => {
    localStorage.setItem("burs_memory_event_queue_v1", "not-json");
    expect(await peekQueueLength()).toBe(0);
    await enqueueMemoryEvent("uA", sampleInput);
    expect(await peekQueueLength()).toBe(1);
  });
});
