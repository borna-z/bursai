import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/ui/page-intro';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { safeT } from '@/lib/i18nFallback';

import {
  ARCHETYPE_OPTIONS,
  COLOR_SWATCHES,
  FABRIC_OPTIONS,
  FABRIC_SENSITIVITY_OPTIONS,
  OCCASION_OPTIONS,
  STYLE_PROFILE_VERSION,
  createEmptyStyleProfileV4,
  type AgeRange,
  type BodyFocus,
  type Budget,
  type Build,
  type CarePreference,
  type Climate,
  type FitOverall,
  type FitTopVsBottom,
  type Gender,
  type Layering,
  type LifestyleMix,
  type PaletteVibe,
  type PatternComfort,
  type PrimaryGoal,
  type ShoppingFrequency,
  type ShoppingStyle,
  type StyleProfileV4,
} from '@/types/styleProfile';

interface Props {
  onComplete: (profile: StyleProfileV4) => void | Promise<void>;
  onSkip: () => void;
  isSaving: boolean;
  /** Used to scope the localStorage draft key per user; falls back to
   * 'anon' when not provided (acceptable — the draft only matters until
   * the quiz finishes). */
  userId?: string;
}

const TOTAL = 12;
const DRAFT_KEY_PREFIX = 'burs.quizV4.draft.';

function readDraft(userId: string): StyleProfileV4 | null {
  try {
    const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StyleProfileV4>;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== STYLE_PROFILE_VERSION) {
      return null;
    }
    // Merge with defaults so any missing fields stay sane.
    return { ...createEmptyStyleProfileV4(), ...parsed } as StyleProfileV4;
  } catch {
    return null;
  }
}

function writeDraft(userId: string, value: StyleProfileV4): void {
  try {
    window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${userId}`, JSON.stringify(value));
  } catch {
    // Private mode / quota — best-effort only.
  }
}

function clearDraft(userId: string): void {
  try {
    window.localStorage.removeItem(`${DRAFT_KEY_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}

/** Tracks which Q1 fields the user has explicitly interacted with. Identity
 * fields default to enum values that ARE valid answers (e.g. 'prefer_not'),
 * so we can't infer "touched" from the answer alone. */
interface Q1Touched {
  gender: boolean;
  build: boolean;
  ageRange: boolean;
}

/** Returns true when the user has supplied enough answers on the current
 * question to advance. Q3 / Q9 / Q12 always return true (optional fields). */
function canAdvance(qi: number, answers: StyleProfileV4, q1Touched: Q1Touched): boolean {
  switch (qi) {
    case 0:
      // Q1 — identity & body. All four must be set; height_cm has a clean
      // 0 sentinel, the three enums need explicit-touch tracking because
      // their defaults are valid choices.
      return (
        q1Touched.gender
        && answers.height_cm > 0
        && q1Touched.build
        && q1Touched.ageRange
      );
    case 3:
      // Q4 — style identity. 3-5 archetypes required.
      return answers.archetypes.length >= 3;
    default:
      return true;
  }
}

// ─── Helper components (mirror QuickStyleQuiz patterns) ───

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

// ─── Component ───

export function StyleQuizV4({ onComplete, onSkip, isSaving, userId }: Props) {
  const { t } = useLanguage();
  const draftKeyUser = userId ?? 'anon';
  const [qi, setQi] = useState(0);
  const [dir, setDir] = useState(1);
  const [showQ4Hint, setShowQ4Hint] = useState(false);

  // Hydrate answers + q1Touched from localStorage in lockstep so a restored
  // draft with valid Q1 answers passes the gate without re-touching chips.
  const [{ answers, q1Touched }, setQuizState] = useState<{
    answers: StyleProfileV4;
    q1Touched: Q1Touched;
  }>(() => {
    const draft = readDraft(draftKeyUser);
    if (!draft) return { answers: createEmptyStyleProfileV4(), q1Touched: { gender: false, build: false, ageRange: false } };
    return {
      answers: draft,
      // Treat any persisted draft as having touched the Q1 enums — the user
      // has been here before and the gate's "explicit interaction" check
      // is moot. height_cm is gated by its 0 sentinel anyway.
      q1Touched: { gender: true, build: true, ageRange: true },
    };
  });

  const setAnswers = useCallback(
    (updater: StyleProfileV4 | ((prev: StyleProfileV4) => StyleProfileV4)) => {
      setQuizState((prev) => ({
        ...prev,
        answers: typeof updater === 'function' ? (updater as (p: StyleProfileV4) => StyleProfileV4)(prev.answers) : updater,
      }));
    },
    [],
  );

  const setQ1Touched = useCallback(
    (updater: Q1Touched | ((prev: Q1Touched) => Q1Touched)) => {
      setQuizState((prev) => ({
        ...prev,
        q1Touched: typeof updater === 'function' ? (updater as (p: Q1Touched) => Q1Touched)(prev.q1Touched) : updater,
      }));
    },
    [],
  );

  // Persist on every change. Wrapped in a ref so the persist effect only
  // fires once per actual answer mutation, not on initial mount (which
  // would otherwise overwrite a freshly-loaded draft with the same data).
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    writeDraft(draftKeyUser, answers);
  }, [answers, draftKeyUser]);

  const set = useCallback(<K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  }, [setAnswers]);

  const setLifestyle = useCallback((field: keyof LifestyleMix, val: number) => {
    setAnswers((prev) => ({
      ...prev,
      lifestyle: { ...prev.lifestyle, [field]: val },
    }));
  }, [setAnswers]);

  const toggleArrayValue = useCallback(
    <K extends 'archetypes' | 'favoriteColors' | 'dislikedColors' | 'fabricPreferred' | 'fabricSensitivities' | 'occasions'>(
      key: K,
      val: string,
      max?: number,
    ) => {
      setAnswers((prev) => {
        const list = prev[key];
        if (list.includes(val)) return { ...prev, [key]: list.filter((entry) => entry !== val) };
        if (max && list.length >= max) return prev;
        return { ...prev, [key]: [...list, val] };
      });
    },
    [setAnswers],
  );

  const next = async () => {
    // Gate-check before advancing. If invalid, surface inline hint on Q4
    // and bail without changing the question index.
    if (!canAdvance(qi, answers, q1Touched)) {
      if (qi === 3) setShowQ4Hint(true);
      return;
    }
    if (qi < TOTAL - 1) {
      setDir(1);
      setQi((prev) => prev + 1);
      setShowQ4Hint(false);
      return;
    }
    // Final step: await parent persistence BEFORE clearing the draft so a
    // failed save (or reload mid-failure) doesn't lose the user's answers.
    try {
      await onComplete({ ...answers, version: STYLE_PROFILE_VERSION });
      clearDraft(draftKeyUser);
    } catch {
      // Keep the draft for retry; parent surfaces the error toast.
    }
  };

  const back = () => {
    if (qi > 0) {
      setDir(-1);
      setQi((prev) => prev - 1);
    }
  };

  const setAndAdvance = <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => {
    set(key, val);
    window.setTimeout(() => {
      if (qi < TOTAL - 1) {
        setDir(1);
        setQi((prev) => prev + 1);
      }
    }, 220);
  };

  const handleSkip = useCallback(() => {
    clearDraft(draftKeyUser);
    onSkip();
  }, [draftKeyUser, onSkip]);

  // Q1 explicit-touch setters — separate from `set()` so the gate stays
  // distinct from the answer-shape mutation.
  const touchGender = (value: Gender) => {
    setQ1Touched((prev) => ({ ...prev, gender: true }));
    set('gender', value);
  };
  const touchBuild = (value: Build) => {
    setQ1Touched((prev) => ({ ...prev, build: true }));
    set('build', value);
  };
  const touchAgeRange = (value: AgeRange) => {
    setQ1Touched((prev) => ({ ...prev, ageRange: true }));
    set('ageRange', value);
  };

  const questionEyebrow = `${safeT(t, 'styleQuizV4.question_label', 'Question')} ${String(qi + 1).padStart(2, '0')}`;

  // ─── Per-question option lists ───

  const GENDERS: Gender[] = ['feminine', 'masculine', 'neutral', 'prefer_not'];
  const BUILDS: Build[] = ['slim', 'athletic', 'curvy', 'fuller', 'prefer_not'];
  const AGE_RANGES: AgeRange[] = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
  const CLIMATES: Climate[] = ['nordic', 'temperate', 'mediterranean', 'tropical', 'desert', 'varies'];
  const PALETTE_VIBES: PaletteVibe[] = ['neutrals', 'bold', 'dark', 'pastels', 'earth', 'mixed'];
  const PATTERN_COMFORTS: PatternComfort[] = ['love', 'some', 'minimal', 'solids_only'];
  const FIT_OVERALLS: FitOverall[] = ['fitted', 'regular', 'relaxed', 'oversized', 'mixed'];
  const FIT_TOP_VS_BOTTOMS: FitTopVsBottom[] = [
    'same',
    'fitted_top_loose_bottom',
    'loose_top_fitted_bottom',
    'mixed',
  ];
  const LAYERINGS: Layering[] = ['minimal', 'some', 'love'];
  const BODY_FOCUSES: BodyFocus[] = ['shoulders', 'waist', 'legs', 'none'];
  const CARE_PREFS: CarePreference[] = ['easy_care', 'mixed', 'high_maintenance_ok'];
  const SHOPPING_FREQS: ShoppingFrequency[] = ['rare', 'seasonal', 'monthly', 'frequent'];
  const BUDGETS: Budget[] = ['budget', 'mid', 'premium', 'luxury', 'mixed'];
  const SHOPPING_STYLES: ShoppingStyle[] = ['planned', 'impulse', 'mixed'];
  const PRIMARY_GOALS: PrimaryGoal[] = [
    'reduce_decisions',
    'discover_style',
    'curate_capsule',
    'special_events',
    'professional_polish',
    'sustainability',
    'fun_experimenting',
  ];

  const renderQuestion = () => {
    switch (qi) {
      // Q1 — Identity & body
      case 0:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q1.title') || 'A bit about you.'}
            subtitle={t('styleQuizV4.q1.subtitle') || 'Helps BURS suggest cuts and fits that flatter you.'}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q1.gender_label') || 'How do you express your style?'}
                </p>
                <div className="space-y-2">
                  {GENDERS.map((value) => (
                    <OptionBtn
                      key={value}
                      selected={q1Touched.gender && answers.gender === value}
                      onSelect={() => touchGender(value)}
                      label={t(`styleQuizV4.gender.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q1.height_label') || 'Height'}
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={100}
                    max={250}
                    value={answers.height_cm > 0 ? answers.height_cm : ''}
                    onChange={(e) => set('height_cm', Number(e.target.value) || 0)}
                    placeholder="175"
                    className="w-32 text-center text-base font-medium"
                  />
                  <span className="text-sm text-muted-foreground">cm</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q1.build_label') || 'Build'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {BUILDS.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={q1Touched.build && answers.build === value}
                      onToggle={() => touchBuild(value)}
                      label={t(`styleQuizV4.build.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q1.age_label') || 'Age range'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {AGE_RANGES.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={q1Touched.ageRange && answers.ageRange === value}
                      onToggle={() => touchAgeRange(value)}
                      label={value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </QWrap>
        );

      // Q2 — Lifestyle mix (5 sliders, no auto-rebalance)
      case 1: {
        const total =
          answers.lifestyle.work +
          answers.lifestyle.social +
          answers.lifestyle.casual +
          answers.lifestyle.sport +
          answers.lifestyle.evening;
        const lifestyleFields: { key: keyof LifestyleMix; tKey: string }[] = [
          { key: 'work', tKey: 'styleQuizV4.q2.work' },
          { key: 'social', tKey: 'styleQuizV4.q2.social' },
          { key: 'casual', tKey: 'styleQuizV4.q2.casual' },
          { key: 'sport', tKey: 'styleQuizV4.q2.sport' },
          { key: 'evening', tKey: 'styleQuizV4.q2.evening' },
        ];
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q2.title') || 'How is your week split?'}
            subtitle={
              t('styleQuizV4.q2.subtitle') ||
              'Drag each slider to roughly reflect your time. Totals do not need to hit 100.'
            }
          >
            <div className="space-y-5">
              {lifestyleFields.map(({ key, tKey }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-foreground">{t(tKey) || key}</span>
                    <span className="text-xs text-muted-foreground">{answers.lifestyle[key]}%</span>
                  </div>
                  <Slider
                    value={[answers.lifestyle[key]]}
                    onValueChange={([v]) => setLifestyle(key, v)}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {t('styleQuizV4.q2.total_label') || 'Total'}: {total}%
              </p>
            </div>
          </QWrap>
        );
      }

      // Q3 — Climate & location
      case 2:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q3.title') || 'Where do you dress?'}
            subtitle={
              t('styleQuizV4.q3.subtitle') ||
              'So weather and seasons are baked into recommendations from day one.'
            }
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q3.home_city_label') || 'Home city (optional)'}
                </p>
                <Input
                  value={answers.homeCity ?? ''}
                  onChange={(e) => set('homeCity', e.target.value)}
                  placeholder={t('styleQuizV4.q3.home_city_placeholder') || 'Stockholm'}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q3.climate_label') || 'Climate'}
                </p>
                <div className="space-y-2">
                  {CLIMATES.map((value) => (
                    <OptionBtn
                      key={value}
                      selected={answers.climate === value}
                      onSelect={() => set('climate', value)}
                      label={t(`styleQuizV4.climate.${value}`) || value}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q3.secondary_city_label') || 'Travel often? (optional)'}
                </p>
                <Input
                  value={answers.secondaryCity ?? ''}
                  onChange={(e) => set('secondaryCity', e.target.value)}
                  placeholder={t('styleQuizV4.q3.secondary_city_placeholder') || 'London'}
                />
              </div>
            </div>
          </QWrap>
        );

      // Q4 — Style identity
      case 3:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q4.title') || 'Pick your style words.'}
            subtitle={t('styleQuizV4.q4.subtitle') || 'Choose 3–5 that feel true to you.'}
          >
            <div className="flex flex-wrap gap-2.5">
              {ARCHETYPE_OPTIONS.map((value) => (
                <ChipBtn
                  key={value}
                  selected={answers.archetypes.includes(value)}
                  onToggle={() => toggleArrayValue('archetypes', value, 5)}
                  label={t(`styleQuizV4.archetype.${value}`) || value}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {answers.archetypes.length}/5 {t('styleQuizV4.q4.selected') || 'selected'}
              {' · '}
              <span
                className={cn(
                  'transition-colors',
                  showQ4Hint && answers.archetypes.length < 3 ? 'text-destructive font-medium' : 'text-muted-foreground',
                )}
              >
                {safeT(t, 'styleQuizV4.q4.hint_pick3', 'Pick 3-5')}
              </span>
            </p>
            <div className="space-y-2 pt-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {t('styleQuizV4.q4.icons_label') || 'Style icons (optional)'}
              </p>
              <Input
                value={answers.styleIcons ?? ''}
                onChange={(e) => set('styleIcons', e.target.value)}
                placeholder={t('styleQuizV4.q4.icons_placeholder') || 'e.g. The Row, Phoebe Philo, Kanye'}
              />
            </div>
          </QWrap>
        );

      // Q5 — Color DNA
      case 4:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q5.title') || 'Your color story.'}
            subtitle={t('styleQuizV4.q5.subtitle') || 'Up to 3 favorites, up to 3 to avoid.'}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q5.favorites_label') || 'Love wearing'}
                </p>
                <div className="grid grid-cols-6 gap-3">
                  {COLOR_SWATCHES.map((color) => {
                    const selected = answers.favoriteColors.includes(color.id);
                    const stroke =
                      color.id === 'white' || color.id === 'cream' || color.id === 'beige' ? '#111111' : '#FFFFFF';
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => toggleArrayValue('favoriteColors', color.id, 3)}
                        className={cn(
                          'flex aspect-square items-center justify-center rounded-full border-2 transition-all',
                          selected
                            ? 'scale-[1.08] border-foreground shadow-[0_12px_24px_rgba(28,25,23,0.14)]'
                            : 'border-border/55 hover:border-border',
                        )}
                        style={{ backgroundColor: color.hex }}
                        title={t(`styleQuizV4.color.${color.id}`) || color.id}
                      >
                        {selected ? (
                          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M4 8l3 3 5-5"
                              stroke={stroke}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {answers.favoriteColors.length}/3 {t('styleQuizV4.q5.selected') || 'selected'}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q5.disliked_label') || 'Avoid'}
                </p>
                <div className="grid grid-cols-6 gap-3">
                  {COLOR_SWATCHES.map((color) => {
                    const selected = answers.dislikedColors.includes(color.id);
                    const stroke =
                      color.id === 'white' || color.id === 'cream' || color.id === 'beige' ? '#111111' : '#FFFFFF';
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => toggleArrayValue('dislikedColors', color.id, 3)}
                        className={cn(
                          'flex aspect-square items-center justify-center rounded-full border-2 transition-all',
                          selected
                            ? 'scale-[1.08] border-foreground shadow-[0_12px_24px_rgba(28,25,23,0.14)]'
                            : 'border-border/55 hover:border-border',
                        )}
                        style={{ backgroundColor: color.hex }}
                      >
                        {selected ? (
                          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M4 8l3 3 5-5"
                              stroke={stroke}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q5.palette_label') || 'Palette vibe'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {PALETTE_VIBES.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.paletteVibe === value}
                      onToggle={() => set('paletteVibe', value)}
                      label={t(`styleQuizV4.palette.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q5.pattern_label') || 'Patterns'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {PATTERN_COMFORTS.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.patternComfort === value}
                      onToggle={() => set('patternComfort', value)}
                      label={t(`styleQuizV4.pattern.${value}`) || value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </QWrap>
        );

      // Q6 — Fit & silhouette
      case 5:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q6.title') || 'Fit & silhouette.'}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q6.overall_label') || 'Overall fit'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {FIT_OVERALLS.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.fitOverall === value}
                      onToggle={() => set('fitOverall', value)}
                      label={t(`styleQuizV4.fitOverall.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q6.top_vs_bottom_label') || 'Top vs bottom'}
                </p>
                <div className="space-y-2">
                  {FIT_TOP_VS_BOTTOMS.map((value) => (
                    <OptionBtn
                      key={value}
                      selected={answers.fitTopVsBottom === value}
                      onSelect={() => set('fitTopVsBottom', value)}
                      label={t(`styleQuizV4.fitTopVsBottom.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q6.layering_label') || 'Layering'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {LAYERINGS.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.layering === value}
                      onToggle={() => set('layering', value)}
                      label={t(`styleQuizV4.layering.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q6.body_focus_label') || 'Show off'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {BODY_FOCUSES.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.bodyFocus === value}
                      onToggle={() => set('bodyFocus', value)}
                      label={t(`styleQuizV4.bodyFocus.${value}`) || value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </QWrap>
        );

      // Q7 — Formality range
      case 6:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q7.title') || 'How formal can you go?'}
            subtitle={t('styleQuizV4.q7.subtitle') || 'Set your usual floor and your dressed-up ceiling.'}
          >
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t('styleQuizV4.q7.floor_label') || 'Casual floor'}
                  </span>
                  <span className="text-xs text-muted-foreground">{answers.formalityFloor}</span>
                </div>
                <Slider
                  value={[answers.formalityFloor]}
                  onValueChange={([v]) => set('formalityFloor', v)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t('styleQuizV4.q7.ceiling_label') || 'Formal ceiling'}
                  </span>
                  <span className="text-xs text-muted-foreground">{answers.formalityCeiling}</span>
                </div>
                <Slider
                  value={[answers.formalityCeiling]}
                  onValueChange={([v]) => set('formalityCeiling', v)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </div>
          </QWrap>
        );

      // Q8 — Fabric & feel
      case 7:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q8.title') || 'Fabric & feel.'}
            subtitle={t('styleQuizV4.q8.subtitle') || 'Pick what you reach for and what you avoid.'}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q8.preferred_label') || 'Love wearing (up to 3)'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {FABRIC_OPTIONS.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.fabricPreferred.includes(value)}
                      onToggle={() => toggleArrayValue('fabricPreferred', value, 3)}
                      label={t(`styleQuizV4.fabric.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q8.sensitivities_label') || 'Sensitivities'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {FABRIC_SENSITIVITY_OPTIONS.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.fabricSensitivities.includes(value)}
                      onToggle={() => toggleArrayValue('fabricSensitivities', value)}
                      label={t(`styleQuizV4.fabricSensitivity.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q8.care_label') || 'Care preference'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {CARE_PREFS.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.carePreference === value}
                      onToggle={() => set('carePreference', value)}
                      label={t(`styleQuizV4.care.${value}`) || value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </QWrap>
        );

      // Q9 — Occasions
      case 8:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q9.title') || 'When do you need outfits most?'}
            subtitle={t('styleQuizV4.q9.subtitle') || 'Pick all that apply.'}
          >
            <div className="flex flex-wrap gap-2.5">
              {OCCASION_OPTIONS.map((value) => (
                <ChipBtn
                  key={value}
                  selected={answers.occasions.includes(value)}
                  onToggle={() => toggleArrayValue('occasions', value)}
                  label={t(`styleQuizV4.occasion.${value}`) || value}
                />
              ))}
            </div>
          </QWrap>
        );

      // Q10 — Shopping habits
      case 9:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q10.title') || 'How do you shop?'}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q10.frequency_label') || 'How often'}
                </p>
                <div className="space-y-2">
                  {SHOPPING_FREQS.map((value) => (
                    <OptionBtn
                      key={value}
                      selected={answers.shoppingFrequency === value}
                      onSelect={() => set('shoppingFrequency', value)}
                      label={t(`styleQuizV4.shoppingFrequency.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q10.budget_label') || 'Budget'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {BUDGETS.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.budget === value}
                      onToggle={() => set('budget', value)}
                      label={t(`styleQuizV4.budget.${value}`) || value}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {t('styleQuizV4.q10.style_label') || 'Shopping style'}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {SHOPPING_STYLES.map((value) => (
                    <ChipBtn
                      key={value}
                      selected={answers.shoppingStyle === value}
                      onToggle={() => set('shoppingStyle', value)}
                      label={t(`styleQuizV4.shoppingStyle.${value}`) || value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </QWrap>
        );

      // Q11 — Primary goal
      case 10:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q11.title') || 'What should BURS do for you?'}
            subtitle={t('styleQuizV4.q11.subtitle') || 'Pick the one that matters most right now.'}
          >
            <div className="space-y-2">
              {PRIMARY_GOALS.map((value) => (
                <OptionBtn
                  key={value}
                  selected={answers.primaryGoal === value}
                  onSelect={() => setAndAdvance('primaryGoal', value)}
                  label={t(`styleQuizV4.goal.${value}`) || value}
                />
              ))}
            </div>
          </QWrap>
        );

      // Q12 — Cultural / accessibility
      case 11:
        return (
          <QWrap
            eyebrow={questionEyebrow}
            question={t('styleQuizV4.q12.title') || 'Anything else BURS should know?'}
            subtitle={
              t('styleQuizV4.q12.subtitle') ||
              'Cultural, religious, or accessibility needs we should respect. Optional.'
            }
          >
            <Textarea
              value={answers.cultural ?? ''}
              onChange={(e) => set('cultural', e.target.value)}
              placeholder={
                t('styleQuizV4.q12.placeholder') ||
                'e.g. always cover shoulders, prefer modest cuts, no high heels.'
              }
              rows={5}
              className="text-sm"
            />
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
      <div className="page-shell !max-w-lg !px-6 !pb-28 !pt-[calc(var(--safe-area-top)+6rem)] page-cluster">
        <Card surface="editorial" className="p-6">
          <PageIntro
            center
            eyebrow={t('styleQuizV4.eyebrow') || t('onboarding.quiz.eyebrow') || 'Style profile'}
            title={t('styleQuizV4.title_intro') || t('onboarding.quiz.title_intro') || 'Tell us how you dress.'}
            description={
              t('styleQuizV4.intro_desc') ||
              t('onboarding.quiz.intro_desc') ||
              'Twelve quick answers help BURS tune outfits, planning, and wardrobe guidance around your real life.'
            }
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
              <Button type="button" variant="quiet" onClick={handleSkip} className="shrink-0 px-2">
                <SkipForward className="h-4 w-4" />
                {safeT(t, 'styleQuizV4.skip', 'Skip')}
              </Button>
            )}

            <Button
              type="button"
              onClick={next}
              disabled={isSaving || !canAdvance(qi, answers, q1Touched)}
              size="lg"
              className="flex-1"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : qi === TOTAL - 1 ? (
                safeT(t, 'styleQuizV4.finish', 'Done')
              ) : (
                <>
                  {safeT(t, 'styleQuizV4.next', 'Next')}
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
