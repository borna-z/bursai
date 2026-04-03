import { useEffect } from 'react';

function getViewportMetrics() {
  const viewport = window.visualViewport;
  const height = viewport?.height ?? window.innerHeight;
  const offsetTop = viewport?.offsetTop ?? 0;

  return {
    height: Math.round(height),
    offsetTop: Math.max(0, Math.round(offsetTop)),
  };
}

export function useViewportShell() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const update = () => {
      const { height, offsetTop } = getViewportMetrics();
      root.style.setProperty('--app-viewport-height', `${height}px`);
      root.style.setProperty('--app-viewport-offset-top', `${offsetTop}px`);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-viewport-offset-top');
    };
  }, []);
}
