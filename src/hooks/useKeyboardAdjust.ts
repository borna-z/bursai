/**
 * useKeyboardAdjust — Adjusts UI for virtual keyboard on iOS WebViews.
 * Uses visualViewport API to detect keyboard height and applies
 * a CSS custom property for bottom-fixed elements to shift up.
 */
import { useEffect } from 'react';

export function useKeyboardAdjust() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const keyboardHeight = window.innerHeight - vv.height;
      const offset = keyboardHeight > 50 ? keyboardHeight : 0;
      document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.documentElement.style.removeProperty('--keyboard-offset');
    };
  }, []);
}
