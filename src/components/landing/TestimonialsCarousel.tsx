import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

const TESTIMONIALS = [
  { nameKey: 'landing.test1_name', quoteKey: 'landing.test1_quote', stars: 5 },
  { nameKey: 'landing.test2_name', quoteKey: 'landing.test2_quote', stars: 5 },
  { nameKey: 'landing.test3_name', quoteKey: 'landing.test3_quote', stars: 5 },
];

export function TestimonialsCarousel() {
  const { t } = useLanguage();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent(c => (c + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="px-6 py-20 md:py-28 relative" style={{ zIndex: 11 }}>
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          {t('landing.testimonials_label')}
        </p>
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white font-space mb-12 reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.testimonials_title')}
        </h2>

        <div className="relative min-h-[200px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="glass-panel rounded-2xl p-8 md:p-12 max-w-2xl mx-auto"
            >
              <div className="flex justify-center gap-1 mb-6">
                {Array.from({ length: TESTIMONIALS[current].stars }).map((_, i) => (
                  <Star key={i} size={16} fill="#fbbf24" stroke="#fbbf24" />
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

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${i === current ? 'bg-white w-6' : 'bg-white/20 hover:bg-white/40'}`}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
