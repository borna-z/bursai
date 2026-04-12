import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { HomeSectionHeader } from './HomeSectionHeader';

const ITEMS = [
  {
    titleKey: 'home.styleChat',
    descKey: 'home.styleChatDesc',
    path: '/ai/chat',
    icon: (
      <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 3h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H7l-4 4V4a1 1 0 0 1 1-1z" />
      </svg>
    ),
  },
  {
    titleKey: 'home.generateOutfit',
    descKey: 'home.generateOutfitDesc',
    path: '/ai/generate',
    icon: (
      <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 2l2.09 6.26L19 11l-5.91 2.74L11 20l-2.09-6.26L3 11l5.91-2.74L11 2z" />
      </svg>
    ),
  },
  {
    titleKey: 'home.styleMe',
    descKey: 'home.styleMeDesc',
    path: '/ai',
    icon: (
      <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3h6" />
        <path d="M8 3C7 5 5 6 4 8c3 0 4 1 4 1v10h6V9s1-1 4-1c-1-2-3-3-4-5" />
        <path d="M10 9h2" />
      </svg>
    ),
  },
  {
    titleKey: 'home.moodOutfit',
    descKey: 'home.moodOutfitDesc',
    path: '/ai/mood',
    icon: (
      <svg width={22} height={22} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={11} cy={11} r={8} />
        <path d="M8 13s1 2 3 2 3-2 3-2" />
        <circle cx={8.5} cy={9.5} r={0.5} fill="currentColor" stroke="none" />
        <circle cx={13.5} cy={9.5} r={0.5} fill="currentColor" stroke="none" />
      </svg>
    ),
  },
] as const;

export function HomeStylistSection() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <section>
      <HomeSectionHeader label={t('home.yourStylist')} />
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
