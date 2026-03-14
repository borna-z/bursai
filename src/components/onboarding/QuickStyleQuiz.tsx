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

const TOTAL = 8;

export function QuickStyleQuiz({ onComplete, onSkip, isSaving }: Props) {
  const { t } = useLanguage();
  const dark = useIsDark();
  const [qi, setQi] = useState(0);
  const [dir, setDir] = useState(1);

  const [answers, setAnswers] = useState({
    gender: '',
    ageRange: '',
    climate: '',
    styleWords: [] as string[],
    fit: '',
    bursGoal: '',
    hardestOccasions: [] as string[],
    morningTime: '',
  });

  const set = useCallback(<K extends keyof typeof answers>(key: K, val: (typeof answers)[K]) => {
    setAnswers(prev => ({ ...prev, [key]: val }));
  }, []);

  const toggleMulti = useCallback((key: 'styleWords' | 'hardestOccasions', val: string, max?: number) => {
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
        weekday: '', workFormality: '', weekend: '', specialOccasion: '',
        styleWords: answers.styleWords, comfortVsStyle: 50, adventurousness: '', trendFollowing: '',
        genderNeutral: '', fit: answers.fit, layering: '', topStyle: '', bottomLength: '',
        favoriteColors: [], dislikedColors: [], paletteVibe: '', patternFeeling: '',
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

  const OptionBtn = ({ value, selected, onSelect, label }: {
    value: string; selected: boolean; onSelect: (v: string) => void; label: string;
  }) => (
    <button
      onClick={() => onSelect(value)}
      className={cn(
        'w-full text-left px-5 py-4 text-[15px] font-medium border transition-all',
        dark && 'rounded-xl',
        selected
          ? (dark ? 'bg-white/[0.1] text-white border-white/20' : 'bg-muted text-foreground border-foreground')
          : (dark ? 'bg-white/[0.03] border-white/[0.06] text-white/70 hover:bg-white/[0.06] hover:border-white/10' : 'bg-card border-border text-muted-foreground hover:bg-muted hover:border-foreground/20')
      )}
    >
      {label}
    </button>
  );

  const ChipBtn = ({ value, selected, onToggle, label }: {
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

  const renderQuestion = () => {
    switch (qi) {
      case 0: return (
        <QWrap question={t('q3.q1')} subtitle={t('q3.q1_sub')} dark={dark}>
          {['male', 'female', 'nonbinary', 'prefer_not'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.gender === v} onSelect={() => selectAndAdvance('gender', v)} label={t(`q3.gender.${v}`)} />
          ))}
        </QWrap>
      );
      case 1: return (
        <QWrap question={t('q3.q2')} dark={dark}>
          {['18-24', '25-34', '35-44', '45-54', '55+'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.ageRange === v} onSelect={() => selectAndAdvance('ageRange', v)} label={v} />
          ))}
        </QWrap>
      );
      case 2: return (
        <QWrap question={t('q3.q4')} dark={dark}>
          {['nordic', 'temperate', 'warm', 'varies'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.climate === v} onSelect={() => selectAndAdvance('climate', v)} label={t(`q3.climate.${v}`)} />
          ))}
        </QWrap>
      );
      case 3: return (
        <QWrap question={t('q3.q9')} subtitle={t('q3.q9_sub')} dark={dark}>
          <div className="flex flex-wrap gap-2.5">
            {['minimal', 'classic', 'street', 'preppy', 'bohemian', 'sporty', 'edgy', 'romantic', 'scandi', 'avantgarde'].map(v => (
              <ChipBtn key={v} value={v} selected={answers.styleWords.includes(v)} onToggle={() => toggleMulti('styleWords', v, 3)} label={t(`q3.sw.${v}`)} />
            ))}
          </div>
        </QWrap>
      );
      case 4: return (
        <QWrap question={t('q3.q14')} dark={dark}>
          {['loose', 'regular', 'slim', 'depends'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.fit === v} onSelect={() => selectAndAdvance('fit', v)} label={t(`q3.fit.${v}`)} />
          ))}
        </QWrap>
      );
      case 5: return (
        <QWrap question={t('q3.q30')} dark={dark}>
          {['daily_outfits', 'better_wardrobe', 'personal_style', 'plan_events', 'all'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.bursGoal === v} onSelect={() => selectAndAdvance('bursGoal', v)} label={t(`q3.goal.${v}`)} />
          ))}
        </QWrap>
      );
      case 6: return (
        <QWrap question={t('q3.q27')} subtitle={t('q3.q27_sub')} dark={dark}>
          <div className="space-y-2">
            {['work', 'dates', 'casual_weekends', 'formal_events', 'travel'].map(v => (
              <ChipBtn key={v} value={v} selected={answers.hardestOccasions.includes(v)} onToggle={() => toggleMulti('hardestOccasions', v)} label={t(`q3.occ.${v}`)} />
            ))}
          </div>
        </QWrap>
      );
      case 7: return (
        <QWrap question={t('q3.q31')} dark={dark}>
          {['under5', '5to15', 'enjoy'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.morningTime === v} onSelect={() => selectAndAdvance('morningTime', v)} label={t(`q3.morning.${v}`)} />
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

      {/* Progress dots */}
      <div className="relative z-10 pt-14 pb-4 px-6 flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              dark
                ? (i === qi ? 'w-6 bg-white/70' : i < qi ? 'w-1.5 bg-white/30' : 'w-1.5 bg-white/10')
                : (i === qi ? 'w-6 bg-foreground' : i < qi ? 'w-1.5 bg-foreground/30' : 'w-1.5 bg-border')
            )}
          />
        ))}
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
      <div className={cn(
        'fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-20 border-t',
        dark ? 'bg-[#030305]/80 backdrop-blur-xl border-white/[0.04]' : 'bg-background border-border'
      )}>
        <div className="max-w-sm mx-auto flex items-center gap-3">
          {qi > 0 ? (
            <button
              onClick={back}
              className={cn(
                'h-12 w-12 border flex items-center justify-center flex-shrink-0 transition-colors',
                dark
                  ? 'rounded-xl border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white/80'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onSkip}
              className={cn(
                'h-12 px-4 text-sm font-medium transition-colors flex items-center gap-1 flex-shrink-0',
                dark ? 'text-white/30 hover:text-white/50' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <SkipForward className="w-4 h-4" />
              {t('q3.skip')}
            </button>
          )}
          <button
            onClick={next}
            disabled={isSaving}
            className={cn(
              'flex-1 h-12 text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-1.5',
              dark
                ? 'rounded-xl bg-white text-[#030305] hover:bg-white/90'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            )}
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : qi === TOTAL - 1 ? (
              t('q3.finish')
            ) : (
              <>
                {t('q3.next')}
                <ArrowRight className="w-4 h-4" />
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
