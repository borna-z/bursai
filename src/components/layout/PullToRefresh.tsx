import { useState, useRef, useCallback, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 80;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const progress = useTransform(y, [0, THRESHOLD], [0, 1]);
  const rotate = useTransform(y, [0, THRESHOLD], [0, 360]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    // Only enable pull-to-refresh when scrolled to top
    const scrollEl = containerRef.current?.closest('main');
    if (scrollEl && scrollEl.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const delta = Math.max(0, e.touches[0].clientY - touchStartY.current);
    // Damped pull
    y.set(delta * 0.5);
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

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Indicator */}
      <motion.div
        style={{ height: y }}
        className="flex items-center justify-center overflow-hidden"
      >
        <motion.div style={{ opacity: progress, rotate }}>
          <RefreshCw className={`w-5 h-5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
        </motion.div>
      </motion.div>
      {children}
    </div>
  );
}
