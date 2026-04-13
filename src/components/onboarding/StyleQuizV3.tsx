import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  User, Briefcase, Palette, Shirt, Sparkles, Target, Heart, Compass,
  ArrowLeft, ArrowRight, Loader2, SkipForward
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { EASE_CURVE, DURATION_DEFAULT } from '@/lib/motion';

// ─── Types ───

export interface StyleProfileV3 {
  gender: string;
  ageRange: string;
  height: string;
  climate: string;
  weekday: string;
  workFormality: string;
  weekend: string;
  specialOccasion: string;
  styleWords: string[];
  comfortVsStyle: number;
  adventurousness: string;
  trendFollowing: string;
  genderNeutral: string;
  fit: string;
  layering: string;
  topStyle: string;
  bottomLength: string;
  favoriteColors: string[];
  dislikedColors: string[];
  paletteVibe: string;
  patternFeeling: string;
  shoppingMindset: string;
  sustainability: string;
  capsuleWardrobe: string;
  frustrations: string[];
  styleIcons: string;
  hardestOccasions: string[];
  fabricFeel: string;
  signaturePieces: string;
  bursGoal: string;
  morningTime: string;
  freeText: string;
}

interface Props {
  onComplete: (profile: StyleProfileV3) => void;
  onSkip: () => void;
  isSaving: boolean;
}

// ─── Section definitions ───

const SECTIONS = [
  { id: 'about', icon: User, titleKey: 'q3.s1.title', questions: [0, 1, 2, 3] },
  { id: 'daily', icon: Briefcase, titleKey: 'q3.s2.title', questions: [4, 5, 6, 7] },
  { id: 'style', icon: Sparkles, titleKey: 'q3.s3.title', questions: [8, 9, 10, 11, 12] },
  { id: 'fit', icon: Shirt, titleKey: 'q3.s4.title', questions: [13, 14, 15, 16] },
  { id: 'colors', icon: Palette, titleKey: 'q3.s5.title', questions: [17, 18, 19, 20] },
  { id: 'philosophy', icon: Target, titleKey: 'q3.s6.title', questions: [21, 22, 23, 24] },
  { id: 'inspiration', icon: Compass, titleKey: 'q3.s7.title', questions: [25, 26, 27, 28] },
  { id: 'goals', icon: Heart, titleKey: 'q3.s8.title', questions: [29, 30, 31] },
];

const TOTAL_QUESTIONS = 32;

// ─── Color palette (curated 20) ───

const COLOR_SWATCHES: { id: string; hex: string }[] = [
  { id: 'black', hex: '#111111' },
  { id: 'white', hex: '#FAFAFA' },
  { id: 'grey', hex: '#9CA3AF' },
  { id: 'navy', hex: '#1E3A5F' },
  { id: 'blue', hex: '#3B82F6' },
  { id: 'lightblue', hex: '#93C5FD' },
  { id: 'red', hex: '#EF4444' },
  { id: 'burgundy', hex: '#7F1D1D' },
  { id: 'pink', hex: '#F472B6' },
  { id: 'green', hex: '#22C55E' },
  { id: 'olive', hex: '#6B7040' },
  { id: 'beige', hex: '#D4C5A9' },
  { id: 'camel', hex: '#C19A6B' },
  { id: 'brown', hex: '#78350F' },
  { id: 'yellow', hex: '#FACC15' },
  { id: 'orange', hex: '#F97316' },
  { id: 'purple', hex: '#A855F7' },
  { id: 'teal', hex: '#14B8A6' },
  { id: 'cream', hex: '#FFF8E7' },
  { id: 'denim', hex: '#4B6C8A' },
];

// ─── Component ───

export function StyleQuizV3({ onComplete, onSkip, isSaving }: Props) {
  const { t } = useLanguage();
  const [qi, setQi] = useState(0); // question index 0-31
  const [dir, setDir] = useState(1); // slide direction

  // All answers
  const [answers, setAnswers] = useState<StyleProfileV3>({
    gender: '', ageRange: '', height: '', climate: '',
    weekday: '', workFormality: '', weekend: '', specialOccasion: '',
    styleWords: [], comfortVsStyle: 50, adventurousness: '', trendFollowing: '', genderNeutral: '',
    fit: '', layering: '', topStyle: '', bottomLength: '',
    favoriteColors: [], dislikedColors: [], paletteVibe: '', patternFeeling: '',
    shoppingMindset: '', sustainability: '', capsuleWardrobe: '', frustrations: [],
    styleIcons: '', hardestOccasions: [], fabricFeel: '', signaturePieces: '',
    bursGoal: '', morningTime: '', freeText: '',
  });

  const set = useCallback(<K extends keyof StyleProfileV3>(key: K, val: StyleProfileV3[K]) => {
    setAnswers(prev => ({ ...prev, [key]: val }));
  }, []);

  const toggleMulti = useCallback((key: 'styleWords' | 'favoriteColors' | 'dislikedColors' | 'frustrations' | 'hardestOccasions', val: string, max?: number) => {
    setAnswers(prev => {
      const list = prev[key] as string[];
      if (list.includes(val)) return { ...prev, [key]: list.filter(v => v !== val) };
      if (max && list.length >= max) return prev;
      return { ...prev, [key]: [...list, val] };
    });
  }, []);

  // Navigation
  const next = () => {
    if (qi < TOTAL_QUESTIONS - 1) { setDir(1); setQi(qi + 1); }
    else onComplete(answers);
  };
  const back = () => { if (qi > 0) { setDir(-1); setQi(qi - 1); } };

  // Get current section
  const currentSection = SECTIONS.find(s => s.questions.includes(qi))!;
  const isFirstInSection = currentSection.questions[0] === qi;
  const SectionIcon = currentSection.icon;
  const progressPct = ((qi + 1) / TOTAL_QUESTIONS) * 100;

  // ─── Option button helper ───

  const OptionBtn = ({ value, selected, onSelect, label }: {
    value: string; selected: boolean; onSelect: (v: string) => void; label: string;
  }) => (
    <button
      onClick={() => onSelect(value)}
      className={cn(
        'w-full text-left px-5 py-3.5 rounded-xl text-[15px] font-medium border transition-all',
        selected
          ? 'bg-accent text-accent-foreground border-accent shadow-sm'
          : 'bg-card border-border hover:bg-secondary/60'
      )}
    >
      {label}
    </button>
  );

  // ─── Color swatch helper ───

  const ColorSwatch = ({ color, selected, onToggle }: {
    color: typeof COLOR_SWATCHES[0]; selected: boolean; onToggle: () => void;
  }) => (
    <button
      onClick={onToggle}
      className={cn(
        'w-11 h-11 rounded-full border-2 transition-all flex items-center justify-center',
        selected ? 'border-accent scale-110 shadow-md' : 'border-border/40 hover:border-border'
      )}
      style={{ backgroundColor: color.hex }}
      title={t(`q3.color.${color.id}`)}
    >
      {selected && (
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <path d="M4 8l3 3 5-5" stroke={color.id === 'white' || color.id === 'cream' || color.id === 'beige' || color.id === 'yellow' ? '#111' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );

  // ─── Question renderer ───

  const renderQuestion = () => {
    switch (qi) {
      // Section 1: About You
      case 0: return (
        <QWrap question={t('q3.q1')} subtitle={t('q3.q1_sub')}>
          {['male','female','nonbinary','prefer_not'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.gender === v} onSelect={v => set('gender', v)} label={t(`q3.gender.${v}`)} />
          ))}
        </QWrap>
      );
      case 1: return (
        <QWrap question={t('q3.q2')}>
          {['18-24','25-34','35-44','45-54','55+'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.ageRange === v} onSelect={v => set('ageRange', v)} label={v} />
          ))}
        </QWrap>
      );
      case 2: return (
        <QWrap question={t('q3.q3')} subtitle={t('q3.q3_sub')}>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={answers.height}
              onChange={e => set('height', e.target.value)}
              placeholder="175"
              className="text-center text-lg font-medium w-28"
              min={100} max={250}
            />
            <span className="text-muted-foreground text-sm">cm</span>
          </div>
        </QWrap>
      );
      case 3: return (
        <QWrap question={t('q3.q4')}>
          {['nordic','temperate','warm','varies'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.climate === v} onSelect={v => set('climate', v)} label={t(`q3.climate.${v}`)} />
          ))}
        </QWrap>
      );

      // Section 2: Daily Life
      case 4: return (
        <QWrap question={t('q3.q5')}>
          {['office','remote','student','active','mix'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.weekday === v} onSelect={v => set('weekday', v)} label={t(`q3.weekday.${v}`)} />
          ))}
        </QWrap>
      );
      case 5: return (
        <QWrap question={t('q3.q6')}>
          {['very_casual','smart_casual','business_casual','formal'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.workFormality === v} onSelect={v => set('workFormality', v)} label={t(`q3.formality.${v}`)} />
          ))}
        </QWrap>
      );
      case 6: return (
        <QWrap question={t('q3.q7')}>
          {['relaxed','active_sports','social','family','mix'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.weekend === v} onSelect={v => set('weekend', v)} label={t(`q3.weekend.${v}`)} />
          ))}
        </QWrap>
      );
      case 7: return (
        <QWrap question={t('q3.q8')}>
          {['rarely','few_monthly','weekly'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.specialOccasion === v} onSelect={v => set('specialOccasion', v)} label={t(`q3.occasion.${v}`)} />
          ))}
        </QWrap>
      );

      // Section 3: Style DNA
      case 8: return (
        <QWrap question={t('q3.q9')} subtitle={t('q3.q9_sub')}>
          <div className="flex flex-wrap gap-2">
            {['minimal','classic','street','preppy','bohemian','sporty','edgy','romantic','scandi','avantgarde'].map(v => (
              <Chip key={v} selected={answers.styleWords.includes(v)} onClick={() => toggleMulti('styleWords', v, 3)} size="lg" className="capitalize">
                {t(`q3.sw.${v}`)}
              </Chip>
            ))}
          </div>
        </QWrap>
      );
      case 9: return (
        <QWrap question={t('q3.q10')}>
          <div className="pt-4 px-2">
            <div className="flex justify-between mb-3">
              <span className="text-sm text-muted-foreground">{t('q3.comfort')}</span>
              <span className="text-sm text-muted-foreground">{t('q3.style')}</span>
            </div>
            <Slider value={[answers.comfortVsStyle]} onValueChange={([v]) => set('comfortVsStyle', v)} min={0} max={100} step={5} />
          </div>
        </QWrap>
      );
      case 10: return (
        <QWrap question={t('q3.q11')}>
          {['safe','sometimes','experimenting'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.adventurousness === v} onSelect={v => set('adventurousness', v)} label={t(`q3.adv.${v}`)} />
          ))}
        </QWrap>
      );
      case 11: return (
        <QWrap question={t('q3.q12')}>
          {['always','pick_choose','timeless'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.trendFollowing === v} onSelect={v => set('trendFollowing', v)} label={t(`q3.trend.${v}`)} />
          ))}
        </QWrap>
      );
      case 12: return (
        <QWrap question={t('q3.q13')}>
          {['yes','no'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.genderNeutral === v} onSelect={v => set('genderNeutral', v)} label={t(`q3.yn.${v}`)} />
          ))}
        </QWrap>
      );

      // Section 4: Fit & Shape
      case 13: return (
        <QWrap question={t('q3.q14')}>
          {['loose','regular','slim','depends'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.fit === v} onSelect={v => set('fit', v)} label={t(`q3.fit.${v}`)} />
          ))}
        </QWrap>
      );
      case 14: return (
        <QWrap question={t('q3.q15')}>
          {['minimal','love'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.layering === v} onSelect={v => set('layering', v)} label={t(`q3.layering.${v}`)} />
          ))}
        </QWrap>
      );
      case 15: return (
        <QWrap question={t('q3.q16')}>
          {['fitted','regular','oversized'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.topStyle === v} onSelect={v => set('topStyle', v)} label={t(`q3.top.${v}`)} />
          ))}
        </QWrap>
      );
      case 16: return (
        <QWrap question={t('q3.q17')}>
          {['ankle','full','shorts','mix'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.bottomLength === v} onSelect={v => set('bottomLength', v)} label={t(`q3.bottom.${v}`)} />
          ))}
        </QWrap>
      );

      // Section 5: Colors & Patterns
      case 17: return (
        <QWrap question={t('q3.q18')} subtitle={t('q3.q18_sub')}>
          <div className="flex flex-wrap gap-3 justify-center">
            {COLOR_SWATCHES.map(c => (
              <ColorSwatch key={c.id} color={c} selected={answers.favoriteColors.includes(c.id)} onToggle={() => toggleMulti('favoriteColors', c.id, 5)} />
            ))}
          </div>
        </QWrap>
      );
      case 18: return (
        <QWrap question={t('q3.q19')}>
          <div className="flex flex-wrap gap-3 justify-center">
            {COLOR_SWATCHES.map(c => (
              <ColorSwatch key={c.id} color={c} selected={answers.dislikedColors.includes(c.id)} onToggle={() => toggleMulti('dislikedColors', c.id)} />
            ))}
          </div>
        </QWrap>
      );
      case 19: return (
        <QWrap question={t('q3.q20')}>
          {['neutrals','bold','dark','pastels','mix'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.paletteVibe === v} onSelect={v => set('paletteVibe', v)} label={t(`q3.palette.${v}`)} />
          ))}
        </QWrap>
      );
      case 20: return (
        <QWrap question={t('q3.q21')}>
          {['love','some','solids'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.patternFeeling === v} onSelect={v => set('patternFeeling', v)} label={t(`q3.pattern.${v}`)} />
          ))}
        </QWrap>
      );

      // Section 6: Philosophy
      case 21: return (
        <QWrap question={t('q3.q22')}>
          {['bargain','mid_range','investment','mix'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.shoppingMindset === v} onSelect={v => set('shoppingMindset', v)} label={t(`q3.shop.${v}`)} />
          ))}
        </QWrap>
      );
      case 22: return (
        <QWrap question={t('q3.q23')}>
          {['very','nice_to_have','not_priority'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.sustainability === v} onSelect={v => set('sustainability', v)} label={t(`q3.sust.${v}`)} />
          ))}
        </QWrap>
      );
      case 23: return (
        <QWrap question={t('q3.q24')}>
          {['yes_active','interested','no'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.capsuleWardrobe === v} onSelect={v => set('capsuleWardrobe', v)} label={t(`q3.capsule.${v}`)} />
          ))}
        </QWrap>
      );
      case 24: return (
        <QWrap question={t('q3.q25')} subtitle={t('q3.q25_sub')}>
          <div className="space-y-2">
            {['nothing_to_wear','too_similar','hard_combine','doesnt_match'].map(v => (
              <button
                key={v}
                onClick={() => toggleMulti('frustrations', v)}
                className={cn(
                  'w-full text-left px-5 py-3.5 rounded-xl text-[15px] font-medium border transition-all',
                  answers.frustrations.includes(v)
                    ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                    : 'bg-card border-border hover:bg-secondary/60'
                )}
              >
                {t(`q3.frust.${v}`)}
              </button>
            ))}
          </div>
        </QWrap>
      );

      // Section 7: Inspiration
      case 25: return (
        <QWrap question={t('q3.q26')} subtitle={t('q3.q26_sub')}>
          <Input
            value={answers.styleIcons}
            onChange={e => set('styleIcons', e.target.value)}
            placeholder={t('q3.q26_placeholder')}
            className="text-[15px]"
          />
        </QWrap>
      );
      case 26: return (
        <QWrap question={t('q3.q27')} subtitle={t('q3.q27_sub')}>
          <div className="space-y-2">
            {['work','dates','casual_weekends','formal_events','travel'].map(v => (
              <button
                key={v}
                onClick={() => toggleMulti('hardestOccasions', v)}
                className={cn(
                  'w-full text-left px-5 py-3.5 rounded-xl text-[15px] font-medium border transition-all',
                  answers.hardestOccasions.includes(v)
                    ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                    : 'bg-card border-border hover:bg-secondary/60'
                )}
              >
                {t(`q3.occ.${v}`)}
              </button>
            ))}
          </div>
        </QWrap>
      );
      case 27: return (
        <QWrap question={t('q3.q28')}>
          {['cotton_linen','wool_knit','denim','technical','silk_satin','no_pref'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.fabricFeel === v} onSelect={v => set('fabricFeel', v)} label={t(`q3.fabric.${v}`)} />
          ))}
        </QWrap>
      );
      case 28: return (
        <QWrap question={t('q3.q29')}>
          {['yes_fav','not_really','want_to_find'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.signaturePieces === v} onSelect={v => set('signaturePieces', v)} label={t(`q3.sig.${v}`)} />
          ))}
        </QWrap>
      );

      // Section 8: Goals
      case 29: return (
        <QWrap question={t('q3.q30')}>
          {['daily_outfits','better_wardrobe','personal_style','plan_events','all'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.bursGoal === v} onSelect={v => set('bursGoal', v)} label={t(`q3.goal.${v}`)} />
          ))}
        </QWrap>
      );
      case 30: return (
        <QWrap question={t('q3.q31')}>
          {['under5','5to15','enjoy'].map(v => (
            <OptionBtn key={v} value={v} selected={answers.morningTime === v} onSelect={v => set('morningTime', v)} label={t(`q3.morning.${v}`)} />
          ))}
        </QWrap>
      );
      case 31: return (
        <QWrap question={t('q3.q32')} subtitle={t('q3.q32_sub')}>
          <Textarea
            value={answers.freeText}
            onChange={e => set('freeText', e.target.value)}
            placeholder={t('q3.q32_placeholder')}
            rows={4}
            className="text-[15px] resize-none"
          />
        </QWrap>
      );
      default: return null;
    }
  };

  // Animation variants
  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0" style={{ zIndex: 'var(--z-modal)' as unknown as number }}>
        <Progress value={progressPct} className="h-1 rounded-none" />
      </div>

      {/* Section header — only on first question of section */}
      <AnimatePresence mode="wait">
        {isFirstInSection && (
          <motion.div
            key={`section-${currentSection.id}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: DURATION_DEFAULT, ease: EASE_CURVE }}
            className="bg-gradient-to-br from-accent/10 via-accent/5 to-background pt-14 pb-6 px-6 flex flex-col items-center text-center"
          >
            <div className="w-14 h-14 rounded-[1.25rem] bg-accent/15 flex items-center justify-center mb-3">
              <SectionIcon className="w-7 h-7 text-accent" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">{t(currentSection.titleKey)}</h2>
            <p className="text-xs text-muted-foreground mt-1">{qi + 1} / {TOTAL_QUESTIONS}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-first-in-section: small counter */}
      {!isFirstInSection && (
        <div className="pt-14 pb-2 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <SectionIcon className="w-4 h-4" />
            <span className="text-xs font-medium">{t(currentSection.titleKey)}</span>
          </div>
          <span className="text-xs text-muted-foreground">{qi + 1} / {TOTAL_QUESTIONS}</span>
        </div>
      )}

      {/* Question content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="max-w-lg mx-auto">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={qi}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: DURATION_DEFAULT, ease: EASE_CURVE }}
            >
              {renderQuestion()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {qi > 0 && (
            <Button variant="outline" onClick={back} className="h-12 w-12 flex-shrink-0" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          {qi === 0 && (
            <Button variant="ghost" onClick={onSkip} className="h-12 text-muted-foreground text-sm flex-shrink-0">
              <SkipForward className="w-4 h-4 mr-1" />
              {t('q3.skip')}
            </Button>
          )}
          <Button
            onClick={next}
            disabled={isSaving}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-sm font-medium"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : qi === TOTAL_QUESTIONS - 1 ? (
              <>{t('q3.finish')}</>
            ) : (
              <>
                {t('q3.next')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Question wrapper ───

function QWrap({ question, subtitle, children }: {
  question: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="pt-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight leading-tight">{question}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}
