import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, SkipForward } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { EASE_CURVE } from '@/lib/motion';
import { useIsDark } from '@/hooks/useIsDark';
import type { StyleProfileV3 } from './StyleQuizV3';

interface Props {
  onComplete: (profile: StyleProfileV3) => void;
  onSkip: () => void;
  isSaving: boolean;
}

// ── 10 questions, ordered by AI-impact value ──
// 1. Goal (what do you want from BURS?)
// 2. Climate (affects every outfit suggestion)
// 3. Style words (core identity)
// 4. Gender (fit/silhouette)
// 5. Fit preference
// 6. Favorite colors (high value for outfit gen)
// 7. Hardest occasions
// 8. Work formality
// 9. Morning time (usage pattern)
// 10. Age range (lowest priority — optional)

const TOTAL = 10;

const COLOR_SWATCHES = [
  { id: 'black', hex: '#111111' }, { id: 'white', hex: '#FAFAFA' },
  { id: 'grey', hex: '#9CA3AF' }, { id: 'navy', hex: '#1E3A5F' },
  { id: 'blue', hex: '#3B82F6' }, { id: 'beige', hex: '#D4C5A9' },
  { id: 'camel', hex: '#C19A6B' }, { id: 'brown', hex: '#78350F' },
  { id: 'olive', hex: '#6B7040' }, { id: 'green', hex: '#22C55E' },
  { id: 'red', hex: '#EF4444' }, { id: 'burgundy', hex: '#7F1D1D' },
  { id: 'pink', hex: '#F472B6' }, { id: 'purple', hex: '#A855F7' },
  { id: 'orange', hex: '#F97316' }, { id: 'teal', hex: '#14B8A6' },
  { id: 'cream', hex: '#FFF8E7' }, { id: 'denim', hex: '#4B6C8A' },
];

export function QuickStyleQuiz({ onComplete, onSkip, isSaving }: Props) {
  const { t } = useLanguage();
  const dark = useIsDark();
  const [qi, setQi] = useState(0);
  const [dir, setDir] = useState(1);

  const [answers, setAnswers] = useState({
    bursGoal: '',
    climate: '',
    styleWords: [] as string[],
    gender: '',
    fit: '',
    favoriteColors: [] as string[],
    hardestOccasions: [] as string[],
    workFormality: '',
    morningTime: '',
    ageRange: '',
  });

  const set = useCallback(<K extends keyof typeof answers>(key: K, val: (typeof answers)[K]) => {
    setAnswers(prev => ({ ...prev, [key]: val }));
  }, []);

  const toggleMulti = useCallback((key: 'styleWords' | 'hardestOccasions' | 'favoriteColors', val: string, max?: number) => {
    setAnswers(prev => {
      const list = prev[key];
      if (list.includes(val)) return { ...prev, [key]: list.filter(v => v !== val) };
      if (max && list.length >= max) return prev;
      return { ...prev, [key]: [...list, val] };
    });
  }, []);

  const next = () => {
    if (qi < TOTAL - 1) { setDir(1); setQi(qi + 1); }
    else {
      const full: StyleProfileV3 = {
        gender: answers.gender, ageRange: answers.ageRange, height: '', climate: answers.climate,
        weekday: '', workFormality: answers.workFormality, weekend: '', specialOccasion: '',
        styleWords: answers.styleWords, comfortVsStyle: 50, adventurousness: '', trendFollowing: '',
        genderNeutral: '', fit: answers.fit, layering: '', topStyle: '', bottomLength: '',
        favoriteColors: answers.favoriteColors, dislikedColors: [], paletteVibe: '', patternFeeling: '',
        shoppingMindset: '', sustainability: '', capsuleWardrobe: '', frustrations: [],
        styleIcons: '', hardestOccasions: answers.hardestOccasions, fabricFeel: '',
        signaturePieces: '', bursGoal: answers.bursGoal, morningTime: answers.morningTime, freeText: '',
      };
      onComplete(full);
    }
  };

  const back = () => { if (qi > 0) { setDir(-1); setQi(qi - 1); } };

  const selectAndAdvance = (key: keyof typeof answers, val: string) => {
    set(key, val as typeof answers[typeof key]);
    setTimeout(() => {
      if (qi < TOTAL - 1) { setDir(1); setQi(prev => prev + 1); }
    }, 250);
  };

  // ── Shared components ──

  const OptionBtn = ({ value, selected, onSelect, label }: {
    value: string; selected: boolean; onSelect: (v: string) => void; label: string;
  }) => (
    <button
      onClick={() => onSelect(value)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
        background: selected ? '#1C1917' : '#EDE8DF',
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      <span style={{
        width: 9, height: 9, flexShrink: 0,
        background: selected ? '#F5F0E8' : 'rgba(28,25,23,0.15)',
      }} />
      <span style={{
        fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
        fontSize: 12, color: selected ? '#F5F0E8' : '#1C1917',
      }}>
        {label}
      </span>
    </button>
  );

  const ChipBtn = ({ value: _value, selected, onToggle, label }: {
    value: string; selected: boolean; onToggle: () => void; label: string;
  }) => (
    <button
      onClick={onToggle}
      className={cn(
        'px-4 py-2.5 text-sm font-medium border transition-all',
        dark && 'rounded-xl',
        selected
          ? (dark ? 'bg-white/[0.1] text-white border-white/20' : 'bg-muted text-foreground border-foreground')
          : (dark ? 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:bg-white/[0.06]' : 'bg-card border-border text-muted-foreground hover:bg-muted')
      )}
    >
      {label}
    </button>
  );

  // ── Questions ──

  const renderQuestion = () => {
    switch (qi) {
      // 1. Goal — highest value, frames the entire experience
      case 0: return (
        <QWrap question={t('q3.q30')} subtitle={t('onboarding.quiz.goal_sub') || 'This helps us personalize everything for you.'} dark={dark}>
          {['daily_outfits', 'better_wardrobe', 'personal_style', 'plan_events', 'all'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.bursGoal === v} onSelect={() => selectAndAdvance('bursGoal', v)} label={t(`q3.goal.${v}`)} />
          ))}
        </QWrap>
      );

      // 2. Climate — affects every outfit suggestion
      case 1: return (
        <QWrap question={t('q3.q4')} subtitle={t('onboarding.quiz.climate_sub') || 'So we can factor in weather from day one.'} dark={dark}>
          {['nordic', 'temperate', 'warm', 'varies'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.climate === v} onSelect={() => selectAndAdvance('climate', v)} label={t(`q3.climate.${v}`)} />
          ))}
        </QWrap>
      );

      // 3. Style words — core identity
      case 2: return (
        <QWrap question={t('q3.q9')} subtitle={t('q3.q9_sub')} dark={dark}>
          <div className="flex flex-wrap gap-2.5">
            {['minimal', 'classic', 'street', 'preppy', 'bohemian', 'sporty', 'edgy', 'romantic', 'scandi', 'avantgarde'].map(v => (
              <ChipBtn key={v} value={v} selected={answers.styleWords.includes(v)} onToggle={() => toggleMulti('styleWords', v, 3)} label={t(`q3.sw.${v}`)} />
            ))}
          </div>
        </QWrap>
      );

      // 4. Gender
      case 3: return (
        <QWrap question={t('q3.q1')} subtitle={t('q3.q1_sub')} dark={dark}>
          {['male', 'female', 'nonbinary', 'prefer_not'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.gender === v} onSelect={() => selectAndAdvance('gender', v)} label={t(`q3.gender.${v}`)} />
          ))}
        </QWrap>
      );

      // 5. Fit
      case 4: return (
        <QWrap question={t('q3.q14')} dark={dark}>
          {['loose', 'regular', 'slim', 'depends'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.fit === v} onSelect={() => selectAndAdvance('fit', v)} label={t(`q3.fit.${v}`)} />
          ))}
        </QWrap>
      );

      // 6. Favorite colors — NEW, high value
      case 5: return (
        <QWrap question={t('onboarding.quiz.colors_q') || 'Colors you love to wear'} subtitle={t('onboarding.quiz.colors_sub') || 'Pick up to 5. This shapes your outfit palette.'} dark={dark}>
          <div className="flex flex-wrap gap-2.5">
            {COLOR_SWATCHES.map(c => (
              <button
                key={c.id}
                onClick={() => toggleMulti('favoriteColors', c.id, 5)}
                className={cn(
                  'w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center',
                  answers.favoriteColors.includes(c.id)
                    ? (dark ? 'border-white scale-110 shadow-lg' : 'border-foreground scale-110 shadow-md')
                    : (dark ? 'border-white/[0.08] hover:border-white/20' : 'border-border/40 hover:border-border')
                )}
                style={{ backgroundColor: c.hex }}
                title={t(`q3.color.${c.id}`) !== `q3.color.${c.id}` ? t(`q3.color.${c.id}`) : c.id}
              >
                {answers.favoriteColors.includes(c.id) && (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8l3 3 5-5" stroke={c.id === 'white' || c.id === 'cream' || c.id === 'beige' ? '#111' : '#fff'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
          {answers.favoriteColors.length > 0 && (
            <p className={cn('text-xs mt-2', dark ? 'text-white/30' : 'text-muted-foreground')}>
              {answers.favoriteColors.length}/5 {t('onboarding.quiz.selected') || 'selected'}
            </p>
          )}
        </QWrap>
      );

      // 7. Hardest occasions
      case 6: return (
        <QWrap question={t('q3.q27')} subtitle={t('q3.q27_sub')} dark={dark}>
          <div className="space-y-2">
            {['work', 'dates', 'casual_weekends', 'formal_events', 'travel'].map(v => (
              <ChipBtn key={v} value={v} selected={answers.hardestOccasions.includes(v)} onToggle={() => toggleMulti('hardestOccasions', v)} label={t(`q3.occ.${v}`)} />
            ))}
          </div>
        </QWrap>
      );

      // 8. Work formality
      case 7: return (
        <QWrap question={t('onboarding.quiz.formality_q') || 'How formal is your typical day?'} dark={dark}>
          {['very_casual', 'casual', 'smart_casual', 'business', 'formal'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.workFormality === v} onSelect={() => selectAndAdvance('workFormality', v)} label={t(`q3.formality.${v}`)} />
          ))}
        </QWrap>
      );

      // 9. Morning time
      case 8: return (
        <QWrap question={t('q3.q31')} dark={dark}>
          {['under5', '5to15', 'enjoy'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.morningTime === v} onSelect={() => selectAndAdvance('morningTime', v)} label={t(`q3.morning.${v}`)} />
          ))}
        </QWrap>
      );

      // 10. Age range — lowest priority, last
      case 9: return (
        <QWrap question={t('q3.q2')} dark={dark}>
          {['18-24', '25-34', '35-44', '45-54', '55+'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.ageRange === v} onSelect={() => selectAndAdvance('ageRange', v)} label={v} />
          ))}
        </QWrap>
      );

      default: return null;
    }
  };

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className={cn('min-h-screen flex flex-col relative overflow-hidden', dark ? 'dark-landing' : 'bg-background text-foreground')}>
      {dark && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse,rgba(99,102,241,0.06)_0%,transparent_70%)] blur-3xl" />
        </div>
      )}

      {/* Headline + progress dots */}
      <div className="relative z-10 pt-14 px-6">
        <h2 style={{
          fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
          fontSize: 20, textAlign: 'center', maxWidth: 240, margin: '0 auto 12px',
          color: dark ? '#fff' : '#1C1917',
        }}>
          Tell us how you dress.
        </h2>
        <div className="flex items-center justify-center gap-2 pb-4">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 4, borderRadius: 0,
                transition: 'all 0.3s',
                width: i === qi ? 24 : 6,
                background: dark
                  ? (i === qi ? 'rgba(255,255,255,0.7)' : i < qi ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)')
                  : (i === qi ? '#1C1917' : i < qi ? 'rgba(28,25,23,0.3)' : 'rgba(28,25,23,0.08)'),
              }}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-32">
        <div className="max-w-sm mx-auto">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={qi}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: EASE_CURVE }}
            >
              {renderQuestion()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
        padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        background: dark ? 'rgba(3,3,5,0.8)' : '#F5F0E8',
        borderTop: '1px solid rgba(28,25,23,0.06)',
        backdropFilter: dark ? 'blur(12px)' : undefined,
      }}>
        <div style={{ maxWidth: 384, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {qi > 0 ? (
            <button
              onClick={back}
              style={{
                width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, background: '#EDE8DF', border: 'none', cursor: 'pointer',
              }}
            >
              <ArrowLeft style={{ width: 18, height: 18, color: '#1C1917' }} />
            </button>
          ) : (
            <button
              onClick={onSkip}
              style={{
                flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif', fontSize: 11,
                color: 'rgba(28,25,23,0.32)', padding: '12px 8px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <SkipForward style={{ width: 14, height: 14 }} />
              {t('q3.skip')}
            </button>
          )}
          <button
            onClick={next}
            disabled={isSaving}
            style={{
              flex: 1, height: 48, background: '#1C1917', color: '#F5F0E8',
              border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: isSaving ? 0.4 : 1,
            }}
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : qi === TOTAL - 1 ? (
              t('q3.finish')
            ) : (
              <>
                {t('q3.next')}
                <ArrowRight style={{ width: 14, height: 14 }} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function QWrap({ question, subtitle, children, dark }: {
  question: string; subtitle?: string; children: React.ReactNode; dark: boolean;
}) {
  return (
    <div className="pt-6 space-y-6">
      <div>
        <h1 className={cn('text-xl font-bold tracking-tight leading-tight', dark ? 'text-white' : 'text-foreground')}>{question}</h1>
        {subtitle && <p className={cn('text-sm mt-1.5', dark ? 'text-white/40' : 'text-muted-foreground')}>{subtitle}</p>}
      </div>
      <div className="space-y-2.5">
        {children}
      </div>
    </div>
  );
}
