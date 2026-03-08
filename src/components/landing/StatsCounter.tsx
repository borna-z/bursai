import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

function AnimatedCount({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !animated.current) {
        animated.current = true;
        const duration = 2200;
        const start = performance.now();
        const step = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 4);
          setCount(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-3xl md:text-5xl font-bold text-white font-space tabular-nums">
      {count.toLocaleString()}{suffix}
    </div>
  );
}

export function StatsCounter() {
  const { t } = useLanguage();

  const stats = [
    { target: 12500, suffix: '+', label: t('landing.stat_users') },
    { target: 85000, suffix: '+', label: t('landing.stat_outfits_created') },
    { target: 250000, suffix: '+', label: t('landing.stat_garments_added') },
    { target: 98, suffix: '%', label: t('landing.stat_satisfaction') },
  ];

  return (
    <section className="px-6 py-16 md:py-24 border-y border-white/[0.04]">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6 text-center">
        {stats.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-2 reveal-up" style={{ '--reveal-delay': `${i * 80}ms` } as React.CSSProperties}>
            <AnimatedCount target={s.target} suffix={s.suffix} />
            <p className="text-[11px] text-gray-500 tracking-[0.2em] uppercase">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
