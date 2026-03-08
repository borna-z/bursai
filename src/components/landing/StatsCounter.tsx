import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, Sparkles, Shirt, TrendingUp } from 'lucide-react';

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

const ICONS = [Users, Sparkles, Shirt, TrendingUp];

export function StatsCounter() {
  const { t } = useLanguage();

  const stats = [
    { target: 12500, suffix: '+', label: t('landing.stat_users') },
    { target: 85000, suffix: '+', label: t('landing.stat_outfits_created') },
    { target: 250000, suffix: '+', label: t('landing.stat_garments_added') },
    { target: 98, suffix: '%', label: t('landing.stat_satisfaction') },
  ];

  return (
    <section className="px-6 py-16 md:py-24 relative border-y border-white/5" style={{ zIndex: 10 }}>
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 text-center">
        {stats.map((s, i) => {
          const Icon = ICONS[i];
          return (
            <div key={i} className="reveal-up flex flex-col items-center gap-3" style={{ '--reveal-delay': `${i * 100}ms` } as React.CSSProperties}>
              <div className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center mb-1">
                <Icon size={18} strokeWidth={1.5} className="text-gray-400" />
              </div>
              <AnimatedCount target={s.target} suffix={s.suffix} />
              <p className="text-[11px] md:text-xs text-gray-500 tracking-widest uppercase">{s.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
