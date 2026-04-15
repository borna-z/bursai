import { useEffect } from 'react';

const HEIGHT_VAR = '--app-viewport-height';
const OFFSET_TOP_VAR = '--app-viewport-offset-top';
const SAFE_BOTTOM_VAR = '--app-safe-area-bottom';
const KEYBOARD_OPEN_CLASS = 'keyboard-open';

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
 * Probes env(safe-area-inset-bottom) once. Critical on iOS 17.4+ Safari with
 * `interactive-widget=resizes-content`: when the keyboard opens, the dynamic
 * env() value balloons to include the keyboard inset (Apple's "automatic"
 * input-above-keyboard behavior). Any element using raw env() then doubles
 * its padding while the keyboard is open. We capture the device's true
 * home-indicator inset on mount and on real geometry changes only.
 */
function readSafeAreaBottom(): number {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'bottom:0',
    'left:0',
    'width:0',
    'height:0',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
    'visibility:hidden',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
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

/**
 * Fallback bottom inset for iPhones with a home indicator, ONLY used when
 * the env() probe returns 0 on a known device. Same screen-dimension matching
 * as the top-inset fallback. Notched/Dynamic-Island iPhones use a 34px home
 * indicator inset; older devices have no home indicator.
 */
function detectIosHomeIndicatorFallback(): number {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 0;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) && !('MSStream' in window);
  if (!isIos) return 0;
  const w = window.screen.width;
  const h = window.screen.height;
  const maxDim = Math.max(w, h);
  const minDim = Math.min(w, h);

  // Any iPhone with a notch or Dynamic Island has the 34px home indicator.
  const hasHomeIndicator =
    (minDim === 393 && maxDim === 852) ||
    (minDim === 430 && maxDim === 932) ||
    (minDim === 390 && maxDim === 844) ||
    (minDim === 360 && maxDim === 780) ||
    (minDim === 428 && maxDim === 926) ||
    (minDim === 375 && maxDim === 812) ||
    (minDim === 414 && maxDim === 896);

  return hasHomeIndicator ? 34 : 0;
}

export function useViewportShell() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Probe both safe-area insets once per session. They only change on
    // real geometry events (resize, orientationchange) — the visual viewport
    // resize fired by the mobile keyboard MUST NOT trigger a re-probe,
    // otherwise iOS 17.4+ reports the keyboard inset and balloons everything.
    let cachedSafeTopBase = Math.max(readSafeAreaTop(), detectIosNotchFallback());
    let cachedSafeBottomBase = Math.max(readSafeAreaBottom(), detectIosHomeIndicatorFallback());

    const refreshSafeBases = () => {
      cachedSafeTopBase = Math.max(readSafeAreaTop(), detectIosNotchFallback());
      cachedSafeBottomBase = Math.max(readSafeAreaBottom(), detectIosHomeIndicatorFallback());
      updateViewportVars();
    };

    const updateViewportVars = () => {
      const visualViewport = window.visualViewport;
      const height = visualViewport?.height ?? window.innerHeight;
      const innerHeight = window.innerHeight || height;

      // Only write the STABLE safe-area bases to the CSS vars.
      // DO NOT mix in visualViewport.offsetTop or live env() reads —
      // those values spike when the mobile keyboard opens and force any
      // consumer (BottomNav padding, app-bottom-clearance, dock height)
      // to balloon for the duration of the keyboard session.
      root.style.setProperty(HEIGHT_VAR, `${height}px`);
      root.style.setProperty(OFFSET_TOP_VAR, `${cachedSafeTopBase}px`);
      root.style.setProperty(SAFE_BOTTOM_VAR, `${cachedSafeBottomBase}px`);

      // Tag the document while the keyboard is open so anything that wants
      // to react (auto-hide nav, shrink padding, etc.) can do so via CSS.
      // Threshold of 100px filters out chrome-bar collapse from real keyboards.
      const keyboardOpen = innerHeight - height > 100;
      if (keyboardOpen) {
        root.classList.add(KEYBOARD_OPEN_CLASS);
      } else {
        root.classList.remove(KEYBOARD_OPEN_CLASS);
      }
    };

    updateViewportVars();

    // Resize / orientation may change the underlying safe area (e.g. rotation,
    // PWA install, window resize on desktop), so re-probe here.
    window.addEventListener('resize', refreshSafeBases);
    window.addEventListener('orientationchange', refreshSafeBases);
    // Visual viewport scroll/resize only shift the transient viewport height —
    // cheap path, no DOM probe.
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);

    return () => {
      window.removeEventListener('resize', refreshSafeBases);
      window.removeEventListener('orientationchange', refreshSafeBases);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
      root.style.removeProperty(HEIGHT_VAR);
      root.style.removeProperty(OFFSET_TOP_VAR);
      root.style.removeProperty(SAFE_BOTTOM_VAR);
      root.classList.remove(KEYBOARD_OPEN_CLASS);
    };
  }, []);
}
