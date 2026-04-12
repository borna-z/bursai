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
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx={12} cy={12} r={3} />
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
