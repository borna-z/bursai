import { useState, useEffect, useCallback } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

const TESTIMONIALS = [
  { nameKey: 'landing.test1_name', quoteKey: 'landing.test1_quote', stars: 5 },
  { nameKey: 'landing.test2_name', quoteKey: 'landing.test2_quote', stars: 5 },
  { nameKey: 'landing.test3_name', quoteKey: 'landing.test3_quote', stars: 5 },
  { nameKey: 'landing.test4_name', quoteKey: 'landing.test4_quote', stars: 5 },
  { nameKey: 'landing.test5_name', quoteKey: 'landing.test5_quote', stars: 4 },
];

export function TestimonialsCarousel() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const goTo = useCallback((idx: number) => {
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
  }, [current]);

  const next = useCallback(() => {
    setDirection(1);
    setCurrent(c => (c + 1) % TESTIMONIALS.length);
  }, []);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent(c => (c - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 60 : -60, scale: 0.96 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -60 : 60, scale: 0.96 }),
  };

  return (
    <section className="px-6 py-20 md:py-28 relative" style={{ zIndex: 11 }}>
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 mb-4 reveal-down">
          {t('landing.testimonials_label')}
        </p>
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white font-space mb-12 text-shimmer reveal-up">
          {t('landing.testimonials_title')}
        </h2>

        <div className="relative min-h-[240px] flex items-center justify-center">
          {/* Decorative quote marks */}
          <div className="absolute -top-4 left-4 md:left-12 text-6xl md:text-8xl text-white/[0.03] font-serif pointer-events-none select-none" aria-hidden="true">"</div>
          <div className="absolute -bottom-4 right-4 md:right-12 text-6xl md:text-8xl text-white/[0.03] font-serif pointer-events-none select-none" aria-hidden="true">"</div>

          {/* Nav arrows */}
          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full hyper-glass text-gray-400 hover:text-white transition-colors hidden md:flex"
            aria-label="Previous testimonial"
          >
            <ChevronLeft size={20} strokeWidth={1.5} />
          </button>
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full hyper-glass text-gray-400 hover:text-white transition-colors hidden md:flex"
            aria-label="Next testimonial"
          >
            <ChevronRight size={20} strokeWidth={1.5} />
          </button>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="hyper-glass rounded-2xl p-8 md:p-12 max-w-2xl mx-auto md:mx-12 luminous-border"
              style={{ '--luminous-color': 'rgba(99,102,241,0.15)' } as React.CSSProperties}
            >
              <div className="flex justify-center gap-1 mb-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    fill={i < TESTIMONIALS[current].stars ? '#fbbf24' : 'transparent'}
                    stroke={i < TESTIMONIALS[current].stars ? '#fbbf24' : '#4b5563'}
                    style={i < TESTIMONIALS[current].stars ? { filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.4))' } : {}}
                  />
                ))}
              </div>
              <blockquote className="text-lg md:text-xl text-gray-200 leading-relaxed mb-6 font-light italic">
                "{t(TESTIMONIALS[current].quoteKey)}"
              </blockquote>
              <p className="text-sm text-gray-500 tracking-wide">
                — {t(TESTIMONIALS[current].nameKey)}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots with active glow */}
        <div className="flex justify-center gap-2 mt-8">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'bg-indigo-400 w-6' : 'bg-white/20 hover:bg-white/40 w-2'}`}
              style={i === current ? { boxShadow: '0 0 10px rgba(99,102,241,0.5)' } : {}}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>

        <p className="text-xs text-gray-600 mt-6 tracking-wide">
          {t('landing.avg_rating')}
        </p>
      </div>
    </section>
  );
}
