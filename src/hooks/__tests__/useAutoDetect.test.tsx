import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoDetect } from '@/hooks/useAutoDetect';

/**
 * useAutoDetect is a frame-differencing hook that samples a video element via
 * a canvas 2d context. jsdom does not implement canvas, so we install a
 * minimal stub on HTMLCanvasElement.prototype and control timing with fake
 * timers. The goal here is to exercise the *public surface* (progress,
 * framingHint, lockConfidence, optimalCropRatio, onStable callback) rather
 * than the internal sobel math.
 */

type FakeCtx = {
  drawImage: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
};

let imageDataBytes: Uint8ClampedArray;

function makeUniformImageData(value: number) {
  const len = 64 * 64 * 4;
  const bytes = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i += 4) {
    bytes[i] = value;
    bytes[i + 1] = value;
    bytes[i + 2] = value;
    bytes[i + 3] = 255;
  }
  return bytes;
}

function installCanvasStub() {
  imageDataBytes = makeUniformImageData(200);
  const fakeCtx: FakeCtx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: imageDataBytes })),
  };
  (HTMLCanvasElement.prototype as unknown as { getContext: () => FakeCtx }).getContext = vi.fn(() => fakeCtx);
}

function makeVideoEl(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return {
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480,
    ...overrides,
  } as unknown as HTMLVideoElement;
}

describe('useAutoDetect', () => {
  beforeEach(() => {
    installCanvasStub();
    // Vitest fake timers understand requestAnimationFrame natively when the
    // 'requestAnimationFrame' toggle is enabled. Advancing time drives both
    // setTimeout and rAF consistently.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns default initial state', () => {
    const onStable = vi.fn();
    const { result } = renderHook(() =>
      useAutoDetect({ enabled: false, videoEl: null, busy: false, onStable }),
    );

    expect(result.current.progress).toBe(0);
    expect(result.current.framingHint).toBeNull();
    expect(result.current.lockConfidence).toBe(0);
    expect(result.current.optimalCropRatio).toBe(0.8); // initial lockConfidence = 0, below 0.55
    expect(onStable).not.toHaveBeenCalled();
  });

  it('stays idle when disabled even with a valid video element', () => {
    const onStable = vi.fn();
    const video = makeVideoEl();
    const { result } = renderHook(() =>
      useAutoDetect({ enabled: false, videoEl: video, busy: false, onStable }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBe(0);
    expect(result.current.framingHint).toBeNull();
    expect(result.current.lockConfidence).toBe(0);
    expect(onStable).not.toHaveBeenCalled();
  });

  it('stays idle when busy is true', () => {
    const onStable = vi.fn();
    const video = makeVideoEl();
    const { result } = renderHook(() =>
      useAutoDetect({ enabled: true, videoEl: video, busy: true, onStable }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBe(0);
    expect(onStable).not.toHaveBeenCalled();
  });

  it('skips sampling when video element is not ready', () => {
    const onStable = vi.fn();
    const notReady = makeVideoEl({ readyState: 0, videoWidth: 0, videoHeight: 0 } as Partial<HTMLVideoElement>);
    const { result } = renderHook(() =>
      useAutoDetect({ enabled: true, videoEl: notReady, busy: false, onStable }),
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // No stable lock should have fired; progress should stay at 0.
    expect(result.current.progress).toBe(0);
    expect(onStable).not.toHaveBeenCalled();
  });

  it('fires onStable after sustained stability on uniform frames', async () => {
    const onStable = vi.fn();
    const video = makeVideoEl();

    renderHook(() => useAutoDetect({ enabled: true, videoEl: video, busy: false, onStable }));

    // advance enough for: first sample (prevData set), subsequent equal samples
    // Hook samples at SAMPLE_INTERVAL=100ms and needs STABLE_DURATION=250ms of equality.
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    // Uniform grey frames should be detected as stable; onStable should fire at least once.
    expect(onStable).toHaveBeenCalled();
  });

  it('resets state when enabled transitions from true to false', async () => {
    const onStable = vi.fn();
    const video = makeVideoEl();

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAutoDetect({ enabled, videoEl: video, busy: false, onStable }),
      { initialProps: { enabled: true } },
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    rerender({ enabled: false });

    expect(result.current.progress).toBe(0);
    expect(result.current.framingHint).toBeNull();
    expect(result.current.lockConfidence).toBe(0);
  });

  it('cleans up on unmount without throwing', async () => {
    const onStable = vi.fn();
    const video = makeVideoEl();

    const { unmount } = renderHook(() =>
      useAutoDetect({ enabled: true, videoEl: video, busy: false, onStable }),
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(() => unmount()).not.toThrow();
  });
});
