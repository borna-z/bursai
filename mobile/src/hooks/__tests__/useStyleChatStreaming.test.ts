// useStyleChatStreaming — verifies the SSE mechanics: incremental delta
// accumulation, envelope seeding, suggestion chip surfacing, terminal
// flush via onComplete.

import { renderHook } from '@testing-library/react-native';

jest.mock('../../lib/i18n', () => ({
  __esModule: true,
  getLocale: () => 'en',
  t: (k: string) => k,
}));

jest.mock('../../lib/sse', () => ({
  __esModule: true,
  fetchSSE: jest.fn(),
}));

const sse = require('../../lib/sse') as {
  fetchSSE: jest.Mock<Promise<void>, [string, unknown, { onData: (raw: string) => void; onDone: () => void; onError: (e: Error) => void }, AbortSignal | undefined]>;
};

beforeEach(() => {
  sse.fetchSSE.mockReset();
  // Drive a deterministic rAF — synchronous so accumulation lands.
  (global as unknown as { requestAnimationFrame: (cb: () => void) => number }).requestAnimationFrame =
    (cb: () => void) => {
      cb();
      return 0 as unknown as number;
    };
});

describe('useStyleChatStreaming', () => {
  it('accumulates streamed deltas + final flush', async () => {
    const { useStyleChatStreaming } = require('../useStyleChatStreaming');
    const { result } = renderHook(() => useStyleChatStreaming());

    sse.fetchSSE.mockImplementation(async (_fn, _body, cb) => {
      cb.onData(JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }));
      cb.onData(JSON.stringify({ choices: [{ delta: { content: 'lo' } }] }));
      cb.onData(JSON.stringify({ choices: [{ delta: { content: ' world' } }] }));
      cb.onDone();
    });

    const seeds: { content: string; stylistMeta: unknown }[] = [];
    const chunks: { content: string; stylistMeta: unknown }[] = [];
    let final: { finalContent: string; finalMeta: unknown } | null = null;

    const controller = new AbortController();
    await result.current.streamTurn({
      mode: 'style',
      messagesPayload: [{ role: 'user', content: 'hi' }],
      anchoredGarmentId: null,
      activeLookPayload: undefined,
      wardrobeGarmentIds: [],
      controller,
      callbacks: {
        onBubbleSeed: (n: { content: string; stylistMeta: unknown }) => seeds.push(n),
        onSuggestionChips: () => undefined,
        onChunkScheduled: (s: { content: string; stylistMeta: unknown }) => chunks.push(s),
        onComplete: (f: { finalContent: string; finalMeta: unknown }) => { final = f; },
        onError: () => undefined,
      },
    });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[chunks.length - 1]?.content).toBe('Hello world');
    expect(final).not.toBeNull();
    expect(final!.finalContent).toBe('Hello world');
  });

  it('surfaces suggestion chips via callback', async () => {
    const { useStyleChatStreaming } = require('../useStyleChatStreaming');
    const { result } = renderHook(() => useStyleChatStreaming());

    sse.fetchSSE.mockImplementation(async (_fn, _body, cb) => {
      cb.onData(JSON.stringify({ type: 'suggestions', chips: ['a', 'b'] }));
      cb.onDone();
    });

    const chips: string[][] = [];
    const controller = new AbortController();
    await result.current.streamTurn({
      mode: 'style',
      messagesPayload: [{ role: 'user', content: 'hi' }],
      anchoredGarmentId: null,
      activeLookPayload: undefined,
      wardrobeGarmentIds: [],
      controller,
      callbacks: {
        onBubbleSeed: () => undefined,
        onSuggestionChips: (c: string[]) => chips.push(c),
        onChunkScheduled: () => undefined,
        onComplete: () => undefined,
        onError: () => undefined,
      },
    });

    expect(chips).toEqual([['a', 'b']]);
  });
});
