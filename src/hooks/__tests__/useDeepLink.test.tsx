import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { navigateMock, locationMock, isMedianAppMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  locationMock: { pathname: '/' },
  isMedianAppMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => locationMock,
}));
vi.mock('@/lib/median', () => ({
  isMedianApp: isMedianAppMock,
}));

import { useDeepLink } from '../useDeepLink';

describe('useDeepLink', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    isMedianAppMock.mockReset();
    locationMock.pathname = '/';
  });

  it('does nothing when not running inside Median', () => {
    isMedianAppMock.mockReturnValue(false);
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useDeepLink());
    expect(addSpy).not.toHaveBeenCalledWith('median-deeplink', expect.any(Function));
    addSpy.mockRestore();
  });

  it('subscribes to median-deeplink when in Median app', () => {
    isMedianAppMock.mockReturnValue(true);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { unmount } = renderHook(() => useDeepLink());
    expect(addSpy).toHaveBeenCalledWith('median-deeplink', expect.any(Function));
    unmount();
    addSpy.mockRestore();
  });

  it('navigates when receiving a recognized deep link URL', () => {
    isMedianAppMock.mockReturnValue(true);
    renderHook(() => useDeepLink());
    const event = new CustomEvent('median-deeplink', {
      detail: { url: 'https://app.burs.me/u/borna' },
    });
    window.dispatchEvent(event);
    expect(navigateMock).toHaveBeenCalledWith('/u/borna', { replace: true });
  });

  it('ignores invalid URLs gracefully', () => {
    isMedianAppMock.mockReturnValue(true);
    renderHook(() => useDeepLink());
    const event = new CustomEvent('median-deeplink', { detail: { url: 'not a url' } });
    window.dispatchEvent(event);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('navigates to /outfit/:id route', () => {
    isMedianAppMock.mockReturnValue(true);
    renderHook(() => useDeepLink());
    window.dispatchEvent(
      new CustomEvent('median-deeplink', { detail: { url: 'https://app.burs.me/outfit/abc-123' } }),
    );
    expect(navigateMock).toHaveBeenCalledWith('/outfit/abc-123', { replace: true });
  });
});
