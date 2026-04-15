import { RefObject, useEffect, useState } from 'react';

interface ChatViewportDebugProps {
  dockRef: RefObject<HTMLDivElement | null>;
}

interface Snapshot {
  innerHeight: number;
  innerWidth: number;
  vvHeight: number | null;
  vvWidth: number | null;
  vvOffsetTop: number | null;
  vvOffsetLeft: number | null;
  vvScale: number | null;
  appViewportHeight: string;
  safeAreaTop: string;
  safeAreaBottom: string;
  dockTop: number | null;
  dockBottom: number | null;
  dockHeight: number | null;
  ts: number;
}

function read(dockEl: HTMLDivElement | null): Snapshot {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const rect = dockEl?.getBoundingClientRect() ?? null;
  return {
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    vvHeight: vv?.height ?? null,
    vvWidth: vv?.width ?? null,
    vvOffsetTop: vv?.offsetTop ?? null,
    vvOffsetLeft: vv?.offsetLeft ?? null,
    vvScale: vv?.scale ?? null,
    appViewportHeight: styles.getPropertyValue('--app-viewport-height').trim() || '(unset)',
    safeAreaTop: styles.getPropertyValue('--safe-area-top').trim() || '(unset)',
    safeAreaBottom: styles.getPropertyValue('--safe-area-bottom').trim() || '(unset)',
    dockTop: rect ? Math.round(rect.top) : null,
    dockBottom: rect ? Math.round(rect.bottom) : null,
    dockHeight: rect ? Math.round(rect.height) : null,
    ts: Date.now(),
  };
}

export function ChatViewportDebug({ dockRef }: ChatViewportDebugProps) {
  const [snap, setSnap] = useState<Snapshot>(() => read(null));

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSnap(read(dockRef.current)));
    };
    update();
    const vv = window.visualViewport;
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('scroll', update, { passive: true });
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    const interval = window.setInterval(update, 500);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('scroll', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.clearInterval(interval);
    };
  }, [dockRef]);

  const keyboardOverlap =
    snap.vvHeight !== null && snap.vvOffsetTop !== null
      ? Math.max(0, snap.innerHeight - snap.vvHeight - snap.vvOffsetTop)
      : null;

  const dockGapToVisibleBottom =
    snap.vvHeight !== null && snap.vvOffsetTop !== null && snap.dockBottom !== null
      ? snap.vvOffsetTop + snap.vvHeight - snap.dockBottom
      : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 2147483647,
        padding: '8px 10px',
        background: 'rgba(0,0,0,0.82)',
        color: '#0f0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.35,
        borderRadius: 8,
        pointerEvents: 'none',
        maxWidth: 'min(78vw, 360px)',
        whiteSpace: 'pre',
      }}
    >
      {`window.inner   ${snap.innerWidth} x ${snap.innerHeight}
visualViewport ${snap.vvWidth ?? '?'} x ${snap.vvHeight ?? '?'}
vv.offsetTop   ${snap.vvOffsetTop ?? '?'}
vv.offsetLeft  ${snap.vvOffsetLeft ?? '?'}
vv.scale       ${snap.vvScale ?? '?'}
--app-vh       ${snap.appViewportHeight}
--safe-top     ${snap.safeAreaTop}
--safe-bottom  ${snap.safeAreaBottom}
dock.top       ${snap.dockTop ?? '?'}
dock.bottom    ${snap.dockBottom ?? '?'}
dock.height    ${snap.dockHeight ?? '?'}
keyboardOverlap ${keyboardOverlap ?? '?'}
dock→vvBottom   ${dockGapToVisibleBottom ?? '?'}`}
    </div>
  );
}
