import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { HomeSectionHeader } from './HomeSectionHeader';

const ITEMS = [
  {
    titleKey: 'home.travelCapsule',
    descKey: 'home.travelCapsuleDesc',
    path: '/plan/travel-capsule',
    icon: (
      <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x={3} y={8} width={16} height={11} rx={2} />
        <path d="M8 8V6a3 3 0 0 1 6 0v2" />
        <path d="M3 13h16" />
      </svg>
    ),
  },
  {
    titleKey: 'home.outfits',
    descKey: 'home.outfitsDesc',
    path: '/outfits',
    icon: (
      <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4l3.5 2L11 3l3.5 3L18 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" />
        <path d="M8 16v3M14 16v3" />
      </svg>
    ),
  },
  {
    titleKey: 'home.wardrobeGaps',
    descKey: 'home.wardrobeGapsDesc',
    path: '/gaps',
    icon: (
      <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x={3} y={3} width={7} height={7} rx={1} />
        <rect x={12} y={3} width={7} height={7} rx={1} />
        <rect x={3} y={12} width={7} height={7} rx={1} />
        <rect x={12} y={12} width={7} height={7} rx={1} strokeDasharray="2 1.5" />
      </svg>
    ),
  },
  {
    titleKey: 'home.settingsLabel',
    descKey: 'home.settingsDesc',
    path: '/settings',
    icon: (
      <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={11} cy={11} r={3} />
        <path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.93 4.93l1.41 1.41M15.66 15.66l1.41 1.41M4.93 17.07l1.41-1.41M15.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
] as const;

export function HomeDiscoverSection() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <section>
      <HomeSectionHeader label={t('home.discoverLabel')} />
      <div className="px-[var(--page-px)] grid grid-cols-2 gap-2.5">
        {ITEMS.map((item) => (
          <motion.button
            key={item.path}
            whileTap={{ scale: 0.97 }}
            onClick={() => { hapticLight(); navigate(item.path); }}
            className="bg-card/30 border-[0.5px] border-border/40 rounded-[16px] p-4 text-left cursor-pointer"
          >
            <div className="text-foreground/70 mb-2.5">{item.icon}</div>
            <p
              className="text-foreground leading-tight"
              style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
            >
              {t(item.titleKey)}
            </p>
            <p
              className="text-foreground mt-0.5 leading-snug"
              style={{ fontSize: 11, opacity: 0.35 }}
            >
              {t(item.descKey)}
            </p>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
