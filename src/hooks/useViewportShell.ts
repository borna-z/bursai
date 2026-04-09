import { useEffect } from 'react';
import { DISPLAY_MODE_MEDIA_QUERY, getDisplayMode } from '@/lib/pwa';

const HEIGHT_VAR = '--app-viewport-height';
const WIDTH_VAR = '--app-viewport-width';
const OFFSET_TOP_VAR = '--app-viewport-offset-top';

export function useViewportShell() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const displayModeMedia = window.matchMedia(DISPLAY_MODE_MEDIA_QUERY);

    const updateViewportVars = () => {
      const visualViewport = window.visualViewport;
      const height = visualViewport?.height ?? window.innerHeight;
      const width = visualViewport?.width ?? window.innerWidth;
      const offsetTop = visualViewport?.offsetTop ?? 0;
      const displayMode = getDisplayMode();

      root.style.setProperty(HEIGHT_VAR, `${height}px`);
      root.style.setProperty(WIDTH_VAR, `${width}px`);
      root.style.setProperty(OFFSET_TOP_VAR, `${Math.max(offsetTop, 0)}px`);
      root.setAttribute('data-display-mode', displayMode);
    };

    updateViewportVars();

    window.addEventListener('resize', updateViewportVars);
    if ('addEventListener' in displayModeMedia) {
      displayModeMedia.addEventListener('change', updateViewportVars);
    } else {
      displayModeMedia.addListener(updateViewportVars);
    }
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);

    return () => {
      window.removeEventListener('resize', updateViewportVars);
      if ('removeEventListener' in displayModeMedia) {
        displayModeMedia.removeEventListener('change', updateViewportVars);
      } else {
        displayModeMedia.removeListener(updateViewportVars);
      }
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
      root.style.removeProperty(HEIGHT_VAR);
      root.style.removeProperty(WIDTH_VAR);
      root.style.removeProperty(OFFSET_TOP_VAR);
      root.removeAttribute('data-display-mode');
    };
  }, []);
}
