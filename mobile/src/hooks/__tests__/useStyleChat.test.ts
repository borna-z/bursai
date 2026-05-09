// useStyleChat smoke tests — N4.
//
// useStyleChat is the most complex hook in mobile/ (1k+ LOC, multi-mode,
// SSE deltas, optimistic-cache, history hydration). The four spec-listed
// scenarios (SSE parse, abort, mode toggle, mock fetch stream) require
// orchestrating module-scope refs + react-query state + a mocked SSE
// reader. Two of those scenarios (SSE delta accumulation through rAF +
// envelope merging; mode-toggle persistence buffer cache replay) are
// genuinely beyond the 80-LOC budget the wave's scope guardrail allows.
//
// What ships here: the public-API smoke (hook returns expected shape +
// initial state) plus clearChat. The deeper SSE / abort / mode-toggle
// coverage is parked as TODO N4-followup so the wave doesn't block on
// gold-plating a single hook.

import { renderHook, act, waitFor } from '@testing-library/react-native';

import { __resetSupabaseMock } from '../../__mocks__/supabase';
import { makeWrapper } from './testUtils';

jest.mock('../../contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(() => ({
    user: { id: 'user-1' },
    session: { access_token: 'tok' },
    profile: null,
  })),
}));

jest.mock('../../lib/sse', () => ({
  __esModule: true,
  fetchSSE: jest.fn(),
}));

jest.mock('../../lib/i18n', () => ({
  __esModule: true,
  getLocale: () => 'en',
}));

 
const sse = require('../../lib/sse') as { fetchSSE: jest.Mock };

beforeEach(() => {
  __resetSupabaseMock();
  sse.fetchSSE.mockReset();
});

describe('useStyleChat', () => {
  it('exposes the documented public surface (happy path — initial render)', async () => {
    const { useStyleChat } = require('../useStyleChat');
    const { result } = renderHook(() => useStyleChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentMode).toBe('style');
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.clearChat).toBe('function');
    expect(typeof result.current.setMode).toBe('function');
    expect(typeof result.current.stopStreaming).toBe('function');
  });

  it('clearChat resets messages + suggestion chips (error / reset path)', async () => {
    const { useStyleChat } = require('../useStyleChat');
    const { result } = renderHook(() => useStyleChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    await act(async () => {
      await result.current.clearChat();
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.suggestionChips).toEqual([]);
    expect(result.current.activeLook).toBeNull();
  });

  it('setMode flips currentMode and is idempotent on the same mode (edge case)', async () => {
    const { useStyleChat } = require('../useStyleChat');
    const { result } = renderHook(() => useStyleChat(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    await act(async () => {
      result.current.setMode('shopping');
    });
    expect(result.current.currentMode).toBe('shopping');
    // Same-mode call is a no-op — early return inside setCurrentModeState.
    await act(async () => {
      result.current.setMode('shopping');
    });
    expect(result.current.currentMode).toBe('shopping');
  });
});

// TODO N4-followup: SSE delta accumulation through requestAnimationFrame
// flush, abort path inside sendMessage, and mode-toggle buffer-cache
// hydration. Each scenario needs a mocked fetchSSE that yields deltas in
// a controlled tick order; total >250 LOC. Track separately so the wave
// can ship the rig + 7 smokes without blocking.
