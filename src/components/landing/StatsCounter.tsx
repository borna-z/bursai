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
    <div ref={ref} className="text-3xl md:text-5xl font-bold gradient-text font-space tabular-nums">
      {count.toLocaleString()}{suffix}
    </div>
  );
}

const STATS_CONFIG = [
  { icon: Users, color: 'rgba(6,182,212,0.4)', glow: 'rgba(6,182,212,0.15)' },
  { icon: Sparkles, color: 'rgba(245,158,11,0.4)', glow: 'rgba(245,158,11,0.15)' },
  { icon: Shirt, color: 'rgba(244,63,94,0.4)', glow: 'rgba(244,63,94,0.15)' },
  { icon: TrendingUp, color: 'rgba(16,185,129,0.4)', glow: 'rgba(16,185,129,0.15)' },
];

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
          const cfg = STATS_CONFIG[i];
          const Icon = cfg.icon;
          return (
            <div key={i} className="reveal-up flex flex-col items-center gap-3 relative" style={{ '--reveal-delay': `${i * 100}ms` } as React.CSSProperties}>
              {/* Radial glow behind */}
              <div className="absolute inset-0 rounded-xl" style={{ background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)` }} aria-hidden="true" />
              <div className="w-10 h-10 rounded-xl hyper-glass flex items-center justify-center mb-1 relative z-10">
                <Icon size={18} strokeWidth={1.5} style={{ color: cfg.color, filter: `drop-shadow(0 0 4px ${cfg.color})` }} />
              </div>
              <AnimatedCount target={s.target} suffix={s.suffix} />
              <p className="text-[11px] md:text-xs text-gray-500 tracking-widest uppercase relative z-10">{s.label}</p>
              {/* Desktop divider */}
              {i < 3 && <div className="hidden md:block absolute right-0 top-1/4 h-1/2 w-px bg-white/5" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
