import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { EASE_CURVE } from '@/lib/motion';

interface CoachMarkProps {
  step: number;
  currentStep: number;
  isCoachActive: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
  position: 'top' | 'bottom';
  children: ReactNode;
}

const TOTAL_STEPS = 4;

export function CoachMark({
  step,
  currentStep,
  isCoachActive,
  title,
  body,
  ctaLabel,
  onCta,
  position,
  children,
}: CoachMarkProps) {
  const location = useLocation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const prefersReduced = useReducedMotion();
  const isVisible = step === currentStep && isCoachActive;

  const updateRect = useCallback(() => {
    const node = wrapperRef.current;

    if (!node || !node.isConnected) {
      setRect(null);
      return;
    }

    const nextRect = node.getBoundingClientRect();
    if (nextRect.width <= 0 || nextRect.height <= 0) {
      setRect(null);
      return;
    }

    setRect(nextRect);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      setRect(null);
      return;
    }

    const node = wrapperRef.current;
    if (!node) return;

    const frame = window.requestAnimationFrame(updateRect);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateRect())
      : null;

    resizeObserver?.observe(node);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      setRect(null);
    };
  }, [isVisible, location.pathname, updateRect]);

  return (
    <>
      <div
        ref={wrapperRef}
        data-coach-active={isVisible ? 'true' : 'false'}
        style={
          isVisible
            ? {
                position: 'relative',
                zIndex: 9999,
                borderRadius: 12,
                boxShadow:
                  '0 0 0 4px white, 0 0 0 9999px rgba(0,0,0,0.4)',
              }
            : undefined
        }
      >
        {children}
      </div>
      {isVisible && rect && createPortal(<Callout rect={rect} position={position} step={step} title={title} body={body} ctaLabel={ctaLabel} onCta={onCta} prefersReduced={!!prefersReduced} />, document.body)}
    </>
  );
}

interface CalloutProps {
  rect: DOMRect;
  position: 'top' | 'bottom';
  step: number;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
  prefersReduced: boolean;
}

function Callout({ rect, position, step, title, body, ctaLabel, onCta, prefersReduced }: CalloutProps) {
  const calloutWidth = Math.min(280, window.innerWidth * 0.9);
  const gap = 12;

  // Center callout horizontally relative to target, clamped to viewport
  const rawLeft = rect.left + rect.width / 2 - calloutWidth / 2;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - calloutWidth - 8));

  // Arrow horizontal position relative to callout
  const arrowLeft = Math.max(16, Math.min(rect.left + rect.width / 2 - left, calloutWidth - 16));

  let top: number;
  if (position === 'bottom') {
    top = rect.bottom + gap;
  } else {
    // Will be set after we know callout height — use estimate
    top = rect.top - gap - 180;
  }

  return (
    <>
      {/* Backdrop — blocks taps outside */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'auto',
        }}
      />
      <motion.div
        initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.2, ease: EASE_CURVE }}
        style={{
          position: 'fixed',
          zIndex: 9999,
          left,
          top: position === 'bottom' ? rect.bottom + gap : undefined,
          bottom: position === 'top' ? window.innerHeight - rect.top + gap : undefined,
          width: calloutWidth,
        }}
        className="bg-[#1C1917] rounded-2xl p-4"
      >
        {/* Arrow */}
        <div
          style={{
            position: 'absolute',
            left: arrowLeft,
            transform: 'translateX(-50%)',
            ...(position === 'bottom'
              ? {
                  top: -8,
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderBottom: '8px solid #1C1917',
                }
              : {
                  bottom: -8,
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '8px solid #1C1917',
                }),
          }}
        />

        <p
          className="text-[10px] tracking-wide mb-2"
          style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', sans-serif" }}
        >
          Step {step + 1} of {TOTAL_STEPS}
        </p>
        <p
          className="text-[15px] text-white font-normal"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {title}
        </p>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Sans', sans-serif" }}
        >
          {body}
        </p>
        <button
          onClick={onCta}
          className="w-full h-10 mt-3 bg-white text-[#1C1917] rounded-xl text-[14px] font-medium"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {ctaLabel}
        </button>
      </motion.div>
    </>
  );
}
