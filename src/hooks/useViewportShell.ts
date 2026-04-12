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
 * Detects iPhone devices with a notch or Dynamic Island.
 * Used as a fallback when env(safe-area-inset-top) returns 0.
 */
function detectIosNotchFallback(): number {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 0;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) && !('MSStream' in window);
  if (!isIos) return 0;
  const screenHeight = window.screen.height;
  const screenWidth = window.screen.width;
  // iPhone X and newer have notch/island — screen height >= 812 in portrait
  const maxDim = Math.max(screenHeight, screenWidth);
  if (maxDim >= 926) return 59; // iPhone 14/15/16 Pro Max / Plus (Dynamic Island)
  if (maxDim >= 852) return 59; // iPhone 14/15/16 Pro (Dynamic Island)
  if (maxDim >= 844) return 47; // iPhone 12/13/14 (notch)
  if (maxDim >= 812) return 44; // iPhone X/XS/11 Pro (notch)
  return 0;
}

export function useViewportShell() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    const updateViewportVars = () => {
      const visualViewport = window.visualViewport;
      const height = visualViewport?.height ?? window.innerHeight;
      const envSafeTop = readSafeAreaTop();
      const iosFallback = detectIosNotchFallback();
      const offsetTop = Math.max(envSafeTop, iosFallback);

      root.style.setProperty(HEIGHT_VAR, `${height}px`);
      root.style.setProperty(OFFSET_TOP_VAR, `${offsetTop}px`);
    };

    updateViewportVars();

    window.addEventListener('resize', updateViewportVars);
    window.addEventListener('orientationchange', updateViewportVars);
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);

    return () => {
      window.removeEventListener('resize', updateViewportVars);
      window.removeEventListener('orientationchange', updateViewportVars);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
      root.style.removeProperty(HEIGHT_VAR);
      root.style.removeProperty(OFFSET_TOP_VAR);
    };
  }, []);
}
