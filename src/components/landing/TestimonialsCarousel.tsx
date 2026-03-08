import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AnimatePresence, motion } from 'framer-motion';

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

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % TESTIMONIALS.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const testimonial = TESTIMONIALS[current];

  return (
    <section className="px-6 py-20 md:py-28 border-y border-white/[0.04]">
      <div className="max-w-2xl mx-auto text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center"
          >
            <div className="flex gap-0.5 mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  fill={i < testimonial.stars ? '#fbbf24' : 'transparent'}
                  stroke={i < testimonial.stars ? '#fbbf24' : '#374151'}
                />
              ))}
            </div>
            <blockquote className="text-xl md:text-2xl text-gray-300 leading-relaxed font-light mb-6">
              "{t(testimonial.quoteKey)}"
            </blockquote>
            <p className="text-xs text-gray-500 tracking-wide">
              — {t(testimonial.nameKey)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
