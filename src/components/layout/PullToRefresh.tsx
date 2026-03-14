import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { DrapeLogo } from '@/components/ui/DrapeLogo';
import { hapticLight } from '@/lib/haptics';
import { isMedianApp } from '@/lib/median';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 80;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [useNative, setUseNative] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hapticTriggered = useRef(false);
  const y = useMotionValue(0);
  const progress = useTransform(y, [0, THRESHOLD], [0, 1]);
  const rotate = useTransform(y, [0, THRESHOLD], [0, 360]);

  useEffect(() => {
    if (isMedianApp() && (window as any).median?.webview?.pullToRefresh) {
      setUseNative(true);
      (window as any).__burs_ptr_callback = async () => {
        await onRefresh();
      };
    }
  }, [onRefresh]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const scrollEl = containerRef.current?.closest('main');
    if (scrollEl && scrollEl.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const delta = Math.max(0, e.touches[0].clientY - touchStartY.current);
    const dampedDelta = delta * 0.5;
    y.set(dampedDelta);
    if (dampedDelta >= THRESHOLD && !hapticTriggered.current) {
      hapticTriggered.current = true;
      hapticLight();
    } else if (dampedDelta < THRESHOLD) {
      hapticTriggered.current = false;
    }
  }, [refreshing, y]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (y.get() >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      animate(y, THRESHOLD * 0.6, { type: 'spring', stiffness: 300, damping: 30 });
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
      }
    } else {
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }, [y, refreshing, onRefresh]);

  // If native Median pull-to-refresh, just render children
  if (useNative) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <motion.div
        style={{ height: y }}
        className="flex items-center justify-center overflow-hidden"
      >
        <motion.div style={{ opacity: progress, rotate }}>
          <DrapeLogo variant="icon" size="sm" tinted={false} />
        </motion.div>
      </motion.div>
      {children}
    </div>
  );
}
