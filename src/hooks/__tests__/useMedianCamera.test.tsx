import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMedianCamera } from '../useMedianCamera';
import type { RefObject } from 'react';

function makeInputRef() {
  const input = document.createElement('input');
  input.type = 'file';
  vi.spyOn(input, 'click');
  vi.spyOn(input, 'setAttribute');
  vi.spyOn(input, 'removeAttribute');
  const ref: RefObject<HTMLInputElement> = { current: input };
  return { input, ref };
}

describe('useMedianCamera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns takePhoto and pickFromGallery callbacks', () => {
    const { result } = renderHook(() => useMedianCamera());
    expect(typeof result.current.takePhoto).toBe('function');
    expect(typeof result.current.pickFromGallery).toBe('function');
  });

  it('takePhoto sets capture=environment, accept=image/* and clicks the input', () => {
    const { input, ref } = makeInputRef();
    const { result } = renderHook(() => useMedianCamera({ fileInputRef: ref }));
    result.current.takePhoto();
    expect(input.setAttribute).toHaveBeenCalledWith('capture', 'environment');
    expect(input.setAttribute).toHaveBeenCalledWith('accept', 'image/*');
    expect(input.click).toHaveBeenCalledTimes(1);
  });

  it('pickFromGallery removes capture and clicks the input', () => {
    const { input, ref } = makeInputRef();
    const { result } = renderHook(() => useMedianCamera({ fileInputRef: ref }));
    result.current.pickFromGallery();
    expect(input.removeAttribute).toHaveBeenCalledWith('capture');
    expect(input.setAttribute).toHaveBeenCalledWith('accept', 'image/*');
    expect(input.click).toHaveBeenCalledTimes(1);
  });

  it('takePhoto is a no-op when ref is missing or has no current', () => {
    const { result: noOptions } = renderHook(() => useMedianCamera());
    expect(() => noOptions.current.takePhoto()).not.toThrow();

    const ref: RefObject<HTMLInputElement | null> = { current: null };
    const { result } = renderHook(() => useMedianCamera({ fileInputRef: ref }));
    expect(() => result.current.takePhoto()).not.toThrow();
    expect(() => result.current.pickFromGallery()).not.toThrow();
  });
});
