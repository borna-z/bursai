import { useEffect } from 'react';

const HEIGHT_VAR = '--app-viewport-height';
const OFFSET_TOP_VAR = '--app-viewport-offset-top';

export function useViewportShell() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    const updateViewportVars = () => {
      const visualViewport = window.visualViewport;
      const height = visualViewport?.height ?? window.innerHeight;
      const offsetTop = visualViewport?.offsetTop ?? 0;

      root.style.setProperty(HEIGHT_VAR, `${height}px`);
      root.style.setProperty(OFFSET_TOP_VAR, `${Math.max(offsetTop, 0)}px`);
    };

    updateViewportVars();

    window.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);

    return () => {
      window.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
      root.style.removeProperty(HEIGHT_VAR);
      root.style.removeProperty(OFFSET_TOP_VAR);
    };
  }, []);
}
