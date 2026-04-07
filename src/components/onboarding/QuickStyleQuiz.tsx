import { useCallback, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageIntro } from '@/components/ui/page-intro';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';

import type { StyleProfileV3 } from './StyleQuizV3';

interface Props {
  onComplete: (profile: StyleProfileV3) => void;
  onSkip: () => void;
  isSaving: boolean;
}

const TOTAL = 10;

const COLOR_SWATCHES = [
  { id: 'black', hex: '#111111' },
  { id: 'white', hex: '#FAFAFA' },
  { id: 'grey', hex: '#9CA3AF' },
  { id: 'navy', hex: '#1E3A5F' },
  { id: 'blue', hex: '#3B82F6' },
  { id: 'beige', hex: '#D4C5A9' },
  { id: 'camel', hex: '#C19A6B' },
  { id: 'brown', hex: '#78350F' },
  { id: 'olive', hex: '#6B7040' },
  { id: 'green', hex: '#22C55E' },
  { id: 'red', hex: '#EF4444' },
  { id: 'burgundy', hex: '#7F1D1D' },
  { id: 'pink', hex: '#F472B6' },
  { id: 'purple', hex: '#A855F7' },
  { id: 'orange', hex: '#F97316' },
  { id: 'teal', hex: '#14B8A6' },
  { id: 'cream', hex: '#FFF8E7' },
  { id: 'denim', hex: '#4B6C8A' },
];

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {Array.from({ length: TOTAL }).map((_, index) => (
          <div key={index} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/35">
            <motion.div
              className="h-full rounded-full bg-foreground"
              initial={false}
              animate={{ width: index <= current ? '100%' : '0%' }}
              transition={{ duration: 0.28, ease: EASE_CURVE }}
            />
          </div>
        ))}
      </div>
      <p className="text-center text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
        Question {String(current + 1).padStart(2, '0')} of {String(TOTAL).padStart(2, '0')}
      </p>
    </div>
  );
}

function OptionBtn({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="text-left">
      <Card
        surface={selected ? 'editorial' : 'utility'}
        className={cn(
          'flex items-center gap-4 p-4 transition-transform duration-200',
          selected ? 'border-foreground/18' : 'hover:-translate-y-0.5',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
            selected
              ? 'border-foreground/15 bg-foreground text-background'
              : 'border-border/70 bg-background/84 text-muted-foreground',
          )}
        >
          {selected ? <Check className="h-4 w-4" /> : <span className="h-2.5 w-2.5 rounded-full bg-current opacity-45" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">{label}</p>
        </div>
      </Card>
    </button>
  );
}

function ChipBtn({
  selected,
  onToggle,
  label,
}: {
  selected: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'rounded-full border px-4 py-2.5 text-sm font-medium transition-all',
        selected
          ? 'border-foreground/15 bg-foreground text-background shadow-[0_10px_24px_rgba(28,25,23,0.12)]'
          : 'border-border/70 bg-background/82 text-muted-foreground hover:bg-secondary/55 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function QWrap({
  question,
  subtitle,
  eyebrow,
  children,
}: {
  question: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <Card surface="editorial" className="p-6 sm:p-7">
      <PageIntro
        eyebrow={eyebrow}
        title={question}
        description={subtitle}
        className="gap-4"
        titleClassName="text-[1.6rem] leading-[1.04]"
      />
      <div className="mt-6 space-y-3">{children}</div>
    </Card>
  );
}

export function QuickStyleQuiz({ onComplete, onSkip, isSaving }: Props) {
  const { t } = useLanguage();
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
    setAnswers((prev) => ({ ...prev, [key]: val }));
  }, []);

  const toggleMulti = useCallback((key: 'styleWords' | 'hardestOccasions' | 'favoriteColors', val: string, max?: number) => {
    setAnswers((prev) => {
      const list = prev[key];
      if (list.includes(val)) return { ...prev, [key]: list.filter((entry) => entry !== val) };
      if (max && list.length >= max) return prev;
      return { ...prev, [key]: [...list, val] };
    });
  }, []);

  const next = () => {
    if (qi < TOTAL - 1) {
      setDir(1);
      setQi((prev) => prev + 1);
      return;
    }

    const full: StyleProfileV3 = {
      gender: answers.gender,
      ageRange: answers.ageRange,
      height: '',
      climate: answers.climate,
      weekday: '',
      workFormality: answers.workFormality,
      weekend: '',
      specialOccasion: '',
      styleWords: answers.styleWords,
      comfortVsStyle: 50,
      adventurousness: '',
      trendFollowing: '',
      genderNeutral: '',
      fit: answers.fit,
      layering: '',
      topStyle: '',
      bottomLength: '',
      favoriteColors: answers.favoriteColors,
      dislikedColors: [],
      paletteVibe: '',
      patternFeeling: '',
      shoppingMindset: '',
      sustainability: '',
      capsuleWardrobe: '',
      frustrations: [],
      styleIcons: '',
      hardestOccasions: answers.hardestOccasions,
      fabricFeel: '',
      signaturePieces: '',
      bursGoal: answers.bursGoal,
      morningTime: answers.morningTime,
      freeText: '',
    };

    onComplete(full);
  };

  const back = () => {
    if (qi > 0) {
      setDir(-1);
      setQi((prev) => prev - 1);
    }
  };

  const selectAndAdvance = (key: keyof typeof answers, val: string) => {
    set(key, val as (typeof answers)[typeof key]);
    window.setTimeout(() => {
      if (qi < TOTAL - 1) {
        setDir(1);
        setQi((prev) => prev + 1);
      }
    }, 220);
  };

  const questionEyebrow = `Question ${String(qi + 1).padStart(2, '0')}`;

  const renderQuestion = () => {
    switch (qi) {
      case 0:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('q3.q30')}
            subtitle={t('onboarding.quiz.goal_sub') || 'This shapes the way BURS prioritizes outfits, planning, and wardrobe guidance.'}
          >
            {['daily_outfits', 'better_wardrobe', 'personal_style', 'plan_events', 'all'].map((value) => (
              <OptionBtn
                key={value}
                selected={answers.bursGoal === value}
                onSelect={() => selectAndAdvance('bursGoal', value)}
                label={t(`q3.goal.${value}`)}
              />
            ))}
          </QWrap>
        );

      case 1:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('q3.q4')}
            subtitle={t('onboarding.quiz.climate_sub') || 'So recommendations can respond to your weather from day one.'}
          >
            {['nordic', 'temperate', 'warm', 'varies'].map((value) => (
              <OptionBtn
                key={value}
                selected={answers.climate === value}
                onSelect={() => selectAndAdvance('climate', value)}
                label={t(`q3.climate.${value}`)}
              />
            ))}
          </QWrap>
        );

      case 2:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('q3.q9')}
            subtitle={t('q3.q9_sub')}
          >
            <div className="flex flex-wrap gap-2.5">
              {['minimal', 'classic', 'street', 'preppy', 'bohemian', 'sporty', 'edgy', 'romantic', 'scandi', 'avantgarde'].map((value) => (
                <ChipBtn
                  key={value}
                  selected={answers.styleWords.includes(value)}
                  onToggle={() => toggleMulti('styleWords', value, 3)}
                  label={t(`q3.sw.${value}`)}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Pick up to 3.</p>
          </QWrap>
        );

      case 3:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('q3.q1')}
            subtitle={t('q3.q1_sub')}
          >
            {['male', 'female', 'nonbinary', 'prefer_not'].map((value) => (
              <OptionBtn
                key={value}
                selected={answers.gender === value}
                onSelect={() => selectAndAdvance('gender', value)}
                label={t(`q3.gender.${value}`)}
              />
            ))}
          </QWrap>
        );

      case 4:
        return (
          <QWrap eyebrow={questionEyebrow} question={t('q3.q14')}>
            {['loose', 'regular', 'slim', 'depends'].map((value) => (
              <OptionBtn
                key={value}
                selected={answers.fit === value}
                onSelect={() => selectAndAdvance('fit', value)}
                label={t(`q3.fit.${value}`)}
              />
            ))}
          </QWrap>
        );

      case 5:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('onboarding.quiz.colors_q') || 'Colors you love to wear'}
            subtitle={t('onboarding.quiz.colors_sub') || 'Pick up to 5 to guide your outfit palette.'}
          >
            <div className="grid grid-cols-6 gap-3 sm:grid-cols-6">
              {COLOR_SWATCHES.map((color) => {
                const isSelected = answers.favoriteColors.includes(color.id);
                const stroke = color.id === 'white' || color.id === 'cream' || color.id === 'beige' ? '#111111' : '#FFFFFF';

                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => toggleMulti('favoriteColors', color.id, 5)}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-full border-2 transition-all',
                      isSelected
                        ? 'scale-[1.08] border-foreground shadow-[0_12px_24px_rgba(28,25,23,0.14)]'
                        : 'border-border/55 hover:border-border',
                    )}
                    style={{ backgroundColor: color.hex }}
                    title={t(`q3.color.${color.id}`) !== `q3.color.${color.id}` ? t(`q3.color.${color.id}`) : color.id}
                  >
                    {isSelected ? (
                      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                        <path d="M4 8l3 3 5-5" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {answers.favoriteColors.length}/5 {t('onboarding.quiz.selected') || 'selected'}
            </p>
          </QWrap>
        );

      case 6:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('q3.q27')}
            subtitle={t('q3.q27_sub')}
          >
            <div className="flex flex-wrap gap-2.5">
              {['work', 'dates', 'casual_weekends', 'formal_events', 'travel'].map((value) => (
                <ChipBtn
                  key={value}
                  selected={answers.hardestOccasions.includes(value)}
                  onToggle={() => toggleMulti('hardestOccasions', value)}
                  label={t(`q3.occ.${value}`)}
                />
              ))}
            </div>
          </QWrap>
        );

      case 7:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('onboarding.quiz.formality_q') || 'How formal is your typical day?'}
          >
            {['very_casual', 'casual', 'smart_casual', 'business', 'formal'].map((value) => (
              <OptionBtn
                key={value}
                selected={answers.workFormality === value}
                onSelect={() => selectAndAdvance('workFormality', value)}
                label={t(`q3.formality.${value}`)}
              />
            ))}
          </QWrap>
        );

      case 8:
        return (
          <QWrap eyebrow={questionEyebrow} question={t('q3.q31')}>
            {['under5', '5to15', 'enjoy'].map((value) => (
              <OptionBtn
                key={value}
                selected={answers.morningTime === value}
                onSelect={() => selectAndAdvance('morningTime', value)}
                label={t(`q3.morning.${value}`)}
              />
            ))}
          </QWrap>
        );

      case 9:
        return (
          <QWrap eyebrow={questionEyebrow} question={t('q3.q2')}>
            {['18-24', '25-34', '35-44', '45-54', '55+'].map((value) => (
              <OptionBtn
                key={value}
                selected={answers.ageRange === value}
                onSelect={() => selectAndAdvance('ageRange', value)}
                label={value}
              />
            ))}
          </QWrap>
        );

      default:
        return null;
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 56 : -56, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? -56 : 56, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-28 !pt-24 page-cluster">
        <Card surface="editorial" className="p-6">
          <PageIntro
            center
            eyebrow="Style profile"
            title="Tell us how you dress."
            description="Ten quick answers help BURS tune outfits, planning, and wardrobe guidance around your real life."
          />
          <div className="mt-6">
            <ProgressDots current={qi} />
          </div>
        </Card>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={qi}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: EASE_CURVE }}
          >
            {renderQuestion()}
          </motion.div>
        </AnimatePresence>

        <div className="action-bar-floating rounded-[1.6rem] p-3">
          <div className="flex items-center gap-3">
            {qi > 0 ? (
              <Button type="button" variant="editorial" size="icon" onClick={back} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" variant="quiet" onClick={onSkip} className="shrink-0 px-2">
                <SkipForward className="h-4 w-4" />
                {t('q3.skip')}
              </Button>
            )}

            <Button type="button" onClick={next} disabled={isSaving} size="lg" className="flex-1">
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : qi === TOTAL - 1 ? (
                t('q3.finish')
              ) : (
                <>
                  {t('q3.next')}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
