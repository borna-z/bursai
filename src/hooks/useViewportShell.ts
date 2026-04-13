import { useEffect } from 'react';

const HEIGHT_VAR = '--app-viewport-height';
const OFFSET_TOP_VAR = '--app-viewport-offset-top';

/**
 * Probes the real env(safe-area-inset-top) value by reading a hidden element's
 * computed padding-top. Needed because some webviews (Median iOS) report 0
 * from CSS env() even when the device has a notch/Dynamic Island.
 */
function readSafeAreaTop(): number {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:0',
    'height:0',
    'padding-top:env(safe-area-inset-top,0px)',
    'visibility:hidden',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  document.body.removeChild(probe);
  return value;
}

/**
 * Fallback inset for iPhones with a notch or Dynamic Island, ONLY used when
 * env(safe-area-inset-top) returns 0 (some Median iOS webviews).
 *
 * Explicit screen-dimension matching — not threshold ranges — so notch-only
 * devices aren't mistakenly treated as Dynamic Island devices.
 */
function detectIosNotchFallback(): number {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 0;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) && !('MSStream' in window);
  if (!isIos) return 0;
  const w = window.screen.width;
  const h = window.screen.height;
  const maxDim = Math.max(w, h);
  const minDim = Math.min(w, h);

  // Dynamic Island devices (59px top inset)
  // iPhone 14/15/16 Pro: 393×852  |  Pro Max / Plus: 430×932
  if ((minDim === 393 && maxDim === 852) || (minDim === 430 && maxDim === 932)) {
    return 59;
  }

  // Notch devices (47px top inset)
  // iPhone 12/13/14 mini: 360×780  |  12/13/14: 390×844  |  12/13/14 Pro Max: 428×926
  if (
    (minDim === 390 && maxDim === 844) ||
    (minDim === 360 && maxDim === 780) ||
    (minDim === 428 && maxDim === 926)
  ) {
    return 47;
  }

  // Older notch (44px top inset)
  // iPhone X/XS/11 Pro: 375×812  |  XR/11/XS Max/11 Pro Max: 414×896
  if ((minDim === 375 && maxDim === 812) || (minDim === 414 && maxDim === 896)) {
    return 44;
  }

  return 0;
}

export function useViewportShell() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Probe the safe area once per session — it only changes on resize /
    // orientation events, not on every scroll tick. Keeps the hot path cheap.
    let cachedSafeTopBase = Math.max(readSafeAreaTop(), detectIosNotchFallback());

    const refreshSafeTopBase = () => {
      cachedSafeTopBase = Math.max(readSafeAreaTop(), detectIosNotchFallback());
      updateViewportVars();
    };

    const updateViewportVars = () => {
      const visualViewport = window.visualViewport;
      const height = visualViewport?.height ?? window.innerHeight;
      const rawOffset = Math.max(visualViewport?.offsetTop ?? 0, 0);
      // Ignore sub-3px visualViewport offsets — iOS emits tiny noise values
      // during keyboard open/close that cause visible layout jitter.
      const viewportOffset = rawOffset >= 3 ? rawOffset : 0;
      const offsetTop = Math.max(cachedSafeTopBase, viewportOffset);

      root.style.setProperty(HEIGHT_VAR, `${height}px`);
      root.style.setProperty(OFFSET_TOP_VAR, `${offsetTop}px`);
    };

    updateViewportVars();

    // Resize / orientation may change the underlying safe area (e.g. rotation,
    // PWA install, window resize on desktop), so re-probe here.
    window.addEventListener('resize', refreshSafeTopBase);
    window.addEventListener('orientationchange', refreshSafeTopBase);
    // Visual viewport scroll/resize only shift the transient viewport offset —
    // cheap path, no DOM probe.
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);

    return () => {
      window.removeEventListener('resize', refreshSafeTopBase);
      window.removeEventListener('orientationchange', refreshSafeTopBase);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
      root.style.removeProperty(HEIGHT_VAR);
      root.style.removeProperty(OFFSET_TOP_VAR);
    };
  }, []);
}
