import { useState } from 'react';
import { 
  Palette, Shirt, User, Briefcase, Target, Heart,
  ArrowRight, ArrowLeft, Loader2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// ─── Data ───

const COLORS = [
  'black','white','grey','navy','blue','lightblue','darkblue',
  'red','burgundy','coral','pink','lightpink','magenta',
  'green','olive','khaki','mint','forest',
  'beige','sand','camel','brown','darkbrown','cognac',
  'yellow','mustard','gold','orange','rust',
  'purple','lavender','plum',
  'turquoise','teal','silver','cream','off-white','denim'
];

const COLOR_I18N: Record<string, string> = {
  black:'color.black', white:'color.white', grey:'color.grey', navy:'color.navy',
  blue:'color.blue', red:'color.red', green:'color.green', beige:'color.beige',
  brown:'color.brown', pink:'color.pink', yellow:'color.yellow', orange:'color.orange', purple:'color.purple',
};

const PATTERN_OPTIONS = ['stripes','checks','florals','abstract','animal-print'] as const;
const FIT_OPTIONS = ['loose','regular','slim','mix'] as const;
const TOP_LENGTH = ['cropped','regular','oversized'] as const;
const BOTTOM_LENGTH = ['ankle','full-length','shorts','mix'] as const;
const LAYERING = ['minimal','love'] as const;
const STYLE_WORDS = ['minimal','street','preppy','bohemian','classic','sporty','edgy','romantic','scandi'] as const;
const ADVENTUROUSNESS = ['safe','occasionally','experimenting'] as const;
const TREND_FOLLOWING = ['always','sometimes','timeless'] as const;
const WEEKDAY_CONTEXT = ['office','remote','student','active','mix'] as const;
const WEEKEND_CONTEXT = ['casual','sports','going-out','family','mix'] as const;
const WORK_FORMALITY = ['very-casual','business-casual','formal','varies'] as const;
const FRUSTRATIONS = ['nothing-to-wear','too-similar','hard-to-combine','doesnt-fit-lifestyle'] as const;
const CAPSULE = ['yes','no','whats-that'] as const;
const BUDGET = ['fast-fashion','mid-range','investment','mix'] as const;
const SUSTAINABILITY = ['very-important','somewhat','not-priority'] as const;
const AGE_RANGES = ['16-24','25-34','35-44','45-54','55+'] as const;
const CLIMATE = ['nordic','temperate','warm','varies'] as const;

// ─── Types ───

export interface StyleProfile {
  favoriteColors: string[];
  dislikedColors: string[];
  colorTone: string;
  patternFeeling: string;
  likedPatterns: string[];
  fit: string;
  topLength: string;
  bottomLength: string;
  layering: string;
  styleWords: string[];
  styleIcons: string;
  adventurousness: string;
  genderNeutral: boolean;
  trendFollowing: string;
  weekdayContext: string;
  weekendContext: string;
  workFormality: string;
  comfortVsStyle: number;
  frustrations: string[];
  capsuleWardrobe: string;
  budgetMindset: string;
  sustainability: string;
  ageRange: string;
  climate: string;
  styleGoals: string;
}

interface Props {
  onComplete: (profile: StyleProfile) => void;
  onSkip: () => void;
  isSaving: boolean;
}

const TOTAL_PAGES = 6;

const PAGE_META = [
  { icon: Palette, titleKey: 'quiz.page1.title', subtitleKey: 'quiz.page1.subtitle' },
  { icon: Shirt, titleKey: 'quiz.page2.title', subtitleKey: 'quiz.page2.subtitle' },
  { icon: User, titleKey: 'quiz.page3.title', subtitleKey: 'quiz.page3.subtitle' },
  { icon: Briefcase, titleKey: 'quiz.page4.title', subtitleKey: 'quiz.page4.subtitle' },
  { icon: Target, titleKey: 'quiz.page5.title', subtitleKey: 'quiz.page5.subtitle' },
  { icon: Heart, titleKey: 'quiz.page6.title', subtitleKey: 'quiz.page6.subtitle' },
];

// ─── Component ───

export function StyleQuizStep({ onComplete, onSkip, isSaving }: Props) {
  const { t } = useLanguage();
  const [page, setPage] = useState(0);

  // All state
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [dislikedColors, setDislikedColors] = useState<string[]>([]);
  const [colorTone, setColorTone] = useState('neutral');
  const [patternFeeling, setPatternFeeling] = useState('neutral');
  const [likedPatterns, setLikedPatterns] = useState<string[]>([]);

  const [fit, setFit] = useState('regular');
  const [topLength, setTopLength] = useState('regular');
  const [bottomLength, setBottomLength] = useState('full-length');
  const [layering, setLayering] = useState('minimal');

  const [styleWords, setStyleWords] = useState<string[]>([]);
  const [styleIcons, setStyleIcons] = useState('');
  const [adventurousness, setAdventurousness] = useState('occasionally');
  const [genderNeutral, setGenderNeutral] = useState(false);
  const [trendFollowing, setTrendFollowing] = useState('sometimes');

  const [weekdayContext, setWeekdayContext] = useState('mix');
  const [weekendContext, setWeekendContext] = useState('casual');
  const [workFormality, setWorkFormality] = useState('business-casual');
  const [comfortVsStyle, setComfortVsStyle] = useState(50);

  const [frustrations, setFrustrations] = useState<string[]>([]);
  const [capsuleWardrobe, setCapsuleWardrobe] = useState('no');
  const [budgetMindset, setBudgetMindset] = useState('mid-range');
  const [sustainability, setSustainability] = useState('somewhat');

  const [ageRange, setAgeRange] = useState('25-34');
  const [climate, setClimate] = useState('nordic');
  const [styleGoals, setStyleGoals] = useState('');

  const toggleMulti = (list: string[], setList: (v: string[]) => void, val: string, max?: number) => {
    if (list.includes(val)) {
      setList(list.filter(v => v !== val));
    } else if (!max || list.length < max) {
      setList([...list, val]);
    }
  };

  const handleFinish = () => {
    onComplete({
      favoriteColors, dislikedColors, colorTone, patternFeeling, likedPatterns,
      fit, topLength, bottomLength, layering,
      styleWords, styleIcons, adventurousness, genderNeutral, trendFollowing,
      weekdayContext, weekendContext, workFormality, comfortVsStyle,
      frustrations, capsuleWardrobe, budgetMindset, sustainability,
      ageRange, climate, styleGoals,
    });
  };

  const next = () => {
    if (page < TOTAL_PAGES - 1) setPage(page + 1);
    else handleFinish();
  };
  const back = () => { if (page > 0) setPage(page - 1); };

  const meta = PAGE_META[page];
  const Icon = meta.icon;
  const progressPct = ((page + 1) / TOTAL_PAGES) * 100;

  // ─── Helpers ───

  const SingleSelect = ({ options, value, onChange, tPrefix }: {
    options: readonly string[]; value: string; onChange: (v: string) => void; tPrefix: string;
  }) => (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            'px-4 py-2.5 rounded-lg text-sm font-medium border transition-all',
            value === opt
              ? 'bg-accent text-accent-foreground border-accent'
              : 'bg-secondary/50 border-border text-foreground hover:bg-secondary'
          )}
        >
          {t(`${tPrefix}.${opt}`)}
        </button>
      ))}
    </div>
  );

  const MultiChips = ({ options, selected, toggle, tPrefix }: {
    options: readonly string[]; selected: string[]; toggle: (v: string) => void; tPrefix: string;
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <Chip
          key={opt}
          selected={selected.includes(opt)}
          onClick={() => toggle(opt)}
          className="capitalize text-xs"
        >
          {t(`${tPrefix}.${opt}`)}
        </Chip>
      ))}
    </div>
  );

  // ─── Pages ───

  const renderPage = () => {
    switch (page) {
      case 0: return (
        <div className="space-y-6">
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q1')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => (
                <Chip key={c} selected={favoriteColors.includes(c)}
                  onClick={() => toggleMulti(favoriteColors, setFavoriteColors, c)}
                  className="capitalize text-xs">
                  {t(COLOR_I18N[c] || '') || c}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q2')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => (
                <Chip key={c} selected={dislikedColors.includes(c)}
                  onClick={() => toggleMulti(dislikedColors, setDislikedColors, c)}
                  className="capitalize text-xs">
                  {t(COLOR_I18N[c] || '') || c}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q3')}</Label>
            <SingleSelect options={['neutral','bold'] as const} value={colorTone} onChange={setColorTone} tPrefix="quiz.tone" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q4')}</Label>
            <SingleSelect options={['love','neutral','avoid'] as const} value={patternFeeling} onChange={setPatternFeeling} tPrefix="quiz.pattern" />
          </div>
          {patternFeeling !== 'avoid' && (
            <div>
              <Label className="text-sm font-semibold mb-2 block">{t('quiz.q5')}</Label>
              <MultiChips options={PATTERN_OPTIONS} selected={likedPatterns}
                toggle={v => toggleMulti(likedPatterns, setLikedPatterns, v)} tPrefix="quiz.patterns" />
            </div>
          )}
        </div>
      );

      case 1: return (
        <div className="space-y-6">
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q6')}</Label>
            <SingleSelect options={FIT_OPTIONS} value={fit} onChange={setFit} tPrefix="quiz.fit" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q7')}</Label>
            <SingleSelect options={TOP_LENGTH} value={topLength} onChange={setTopLength} tPrefix="quiz.toplen" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q8')}</Label>
            <SingleSelect options={BOTTOM_LENGTH} value={bottomLength} onChange={setBottomLength} tPrefix="quiz.botlen" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q9')}</Label>
            <SingleSelect options={LAYERING} value={layering} onChange={setLayering} tPrefix="quiz.layer" />
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-6">
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q10')}</Label>
            <p className="text-xs text-muted-foreground mb-2">{t('quiz.q10_hint')}</p>
            <MultiChips options={STYLE_WORDS} selected={styleWords}
              toggle={v => toggleMulti(styleWords, setStyleWords, v, 3)} tPrefix="quiz.style" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q11')}</Label>
            <Input
              value={styleIcons}
              onChange={e => setStyleIcons(e.target.value)}
              placeholder={t('quiz.q11_placeholder')}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q12')}</Label>
            <SingleSelect options={ADVENTUROUSNESS} value={adventurousness} onChange={setAdventurousness} tPrefix="quiz.adv" />
          </div>
          <div className="flex items-center justify-between py-2">
            <Label className="text-sm font-medium">{t('quiz.q13')}</Label>
            <Switch checked={genderNeutral} onCheckedChange={setGenderNeutral} />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q14')}</Label>
            <SingleSelect options={TREND_FOLLOWING} value={trendFollowing} onChange={setTrendFollowing} tPrefix="quiz.trend" />
          </div>
        </div>
      );

      case 3: return (
        <div className="space-y-6">
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q15')}</Label>
            <SingleSelect options={WEEKDAY_CONTEXT} value={weekdayContext} onChange={setWeekdayContext} tPrefix="quiz.weekday" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q16')}</Label>
            <SingleSelect options={WEEKEND_CONTEXT} value={weekendContext} onChange={setWeekendContext} tPrefix="quiz.weekend" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q17')}</Label>
            <SingleSelect options={WORK_FORMALITY} value={workFormality} onChange={setWorkFormality} tPrefix="quiz.formality" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q18')}</Label>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-muted-foreground">{t('quiz.comfort')}</span>
              <Slider
                value={[comfortVsStyle]}
                onValueChange={([v]) => setComfortVsStyle(v)}
                min={0} max={100} step={5}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">{t('quiz.style_label')}</span>
            </div>
          </div>
        </div>
      );

      case 4: return (
        <div className="space-y-6">
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q19')}</Label>
            <MultiChips options={FRUSTRATIONS} selected={frustrations}
              toggle={v => toggleMulti(frustrations, setFrustrations, v)} tPrefix="quiz.frust" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q20')}</Label>
            <SingleSelect options={CAPSULE} value={capsuleWardrobe} onChange={setCapsuleWardrobe} tPrefix="quiz.capsule" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q21')}</Label>
            <SingleSelect options={BUDGET} value={budgetMindset} onChange={setBudgetMindset} tPrefix="quiz.budget" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q22')}</Label>
            <SingleSelect options={SUSTAINABILITY} value={sustainability} onChange={setSustainability} tPrefix="quiz.sust" />
          </div>
        </div>
      );

      case 5: return (
        <div className="space-y-6">
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q23')}</Label>
            <SingleSelect options={AGE_RANGES} value={ageRange} onChange={setAgeRange} tPrefix="quiz.age" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q24')}</Label>
            <SingleSelect options={CLIMATE} value={climate} onChange={setClimate} tPrefix="quiz.climate" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">{t('quiz.q25')}</Label>
            <Textarea
              value={styleGoals}
              onChange={e => setStyleGoals(e.target.value)}
              placeholder={t('quiz.q25_placeholder')}
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-accent/10 via-accent/5 to-background pt-14 pb-6 px-6 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-xl font-bold mb-1.5 tracking-tight">{t(meta.titleKey)}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{t(meta.subtitleKey)}</p>
        <div className="w-full max-w-xs mt-4">
          <Progress value={progressPct} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1.5">{page + 1} / {TOTAL_PAGES}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-36">
        <div className="max-w-lg mx-auto">
          {renderPage()}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-lg mx-auto flex gap-3">
          {page > 0 && (
            <Button variant="outline" onClick={back} className="h-12">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <Button
            onClick={next}
            disabled={isSaving}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-sm"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : page === TOTAL_PAGES - 1 ? (
              <ChevronRight className="w-5 h-5 mr-1" />
            ) : (
              <ArrowRight className="w-5 h-5 mr-1" />
            )}
            {page === TOTAL_PAGES - 1 ? t('quiz.finish') : t('quiz.next')}
          </Button>
        </div>
        {page === 0 && (
          <div className="max-w-lg mx-auto mt-2 text-center">
            <Button variant="link" onClick={onSkip} className="text-muted-foreground text-xs">
              {t('quiz.skip_all')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
