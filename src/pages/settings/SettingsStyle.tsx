import { useState, useEffect, useMemo } from 'react';
import { Ruler, Weight, Lock, CheckCircle2, Loader2, ChevronDown, Palette, Shirt, Sparkles, Target, Heart, Compass, User, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Chip } from '@/components/ui/chip';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { StyleProfile } from '@/types/preferences';
import type { Json, TablesUpdate } from '@/integrations/supabase/types';
import { mannequinPresentationFromStyleProfileGender } from '@/lib/mannequinPresentation';

// ── Color palette ──

const COLOR_MAP: Record<string, string> = {
  black: '#111111', white: '#F6F4F1', grey: '#9CA3AF', navy: '#1E3A5F',
  blue: '#3B82F6', red: '#EF4444', green: '#22C55E', beige: '#D2B48C',
  brown: '#8B4513', pink: '#F9A8D4', yellow: '#FACC15', orange: '#F97316',
  purple: '#A855F7', ivory: '#FFFFF0', cream: '#FFFDD0', sand: '#C2B280',
  khaki: '#BDB76B', charcoal: '#54585A', skyblue: '#87CEEB', turquoise: '#40E0D0',
  olive: '#6B8E23', forest: '#228B22', mint: '#98FF98', sage: '#87AE73',
  burgundy: '#722F37', coral: '#FF7F50', lavender: '#E6E6FA',
  camel: '#C19A6B', rust: '#B7410E', cognac: '#9A463D',
  teal: '#008080', plum: '#8E4585', mustard: '#FFDB58', gold: '#FFD700',
  indigo: '#4B0082', cobalt: '#0047AB',
};

const COLORS = Object.keys(COLOR_MAP);

type SectionId = 'body' | 'identity' | 'daily' | 'style' | 'fit' | 'colors' | 'philosophy' | 'inspiration' | 'goals';

export default function SettingsStyle() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { t } = useLanguage();

  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightError, setHeightError] = useState('');
  const [bodySaved, setBodySaved] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  const prefs = useMemo(() => (profile?.preferences as Record<string, unknown>) || {}, [profile]);
  const sp: StyleProfile = useMemo(() => (prefs.styleProfile as StyleProfile) || {}, [prefs]);

  useEffect(() => {
    if (profile?.height_cm) setHeightCm(String(profile.height_cm));
    if (profile?.weight_kg) setWeightKg(String(profile.weight_kg));
  }, [profile]);

  // ── Helpers ──

  const updateStyleField = async (key: keyof StyleProfile, value: unknown) => {
    const newSp = { ...sp, [key]: value };
    try {
      await updateProfile.mutateAsync({
        mannequin_presentation: key === 'gender'
          ? mannequinPresentationFromStyleProfileGender(value)
          : undefined,
        preferences: { ...prefs, styleProfile: newSp } as Json,
      });
    } catch { toast.error(t('settings.pref_error')); }
  };

  const toggleColor = async (field: 'favoriteColors' | 'dislikedColors', color: string) => {
    const current = sp[field] || [];
    const next = current.includes(color)
      ? current.filter(c => c !== color)
      : [...current, color];
    await updateStyleField(field, next);
  };

  const toggleMulti = async (field: 'styleWords' | 'wardrobeFrustrations' | 'hardestOccasions', val: string, max = 5) => {
    const current = (sp[field] as string[]) || [];
    const next = current.includes(val)
      ? current.filter(v => v !== val)
      : current.length >= max ? current : [...current, val];
    await updateStyleField(field, next);
  };

  const validateHeight = (val: string) => {
    const n = parseInt(val, 10);
    if (val && (isNaN(n) || n < 100 || n > 250)) { setHeightError(t('settings.height_error')); return false; }
    setHeightError(''); return true;
  };

  const handleSaveBodyData = async () => {
    if (heightCm && !validateHeight(heightCm)) return;
    try {
      await updateProfile.mutateAsync({
        height_cm: heightCm ? parseInt(heightCm, 10) : null,
        weight_kg: weightKg ? parseInt(weightKg, 10) : null,
      } as TablesUpdate<'profiles'>);
      setBodySaved(true);
      setTimeout(() => setBodySaved(false), 2500);
    } catch { toast.error(t('settings.body_save_error')); }
  };

  const toggle = (id: SectionId) => setOpenSection(prev => prev === id ? null : id);

  const hasProfile = !!sp.gender || !!sp.styleWords?.length;

  // ── Section header ──

  const SectionHeader = ({ id, icon: Icon, title, summary }: { id: SectionId; icon: React.ElementType; title: string; summary?: string }) => (
    <CollapsibleTrigger
      onClick={() => toggle(id)}
      className="flex items-center justify-between w-full px-4 py-3.5 text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-4 h-4 text-accent flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-semibold text-foreground block">{title}</span>
          {summary && openSection !== id && (
            <span className="text-[11px] text-muted-foreground truncate block mt-0.5">{summary}</span>
          )}
        </div>
      </div>
      <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0', openSection === id && 'rotate-180')} />
    </CollapsibleTrigger>
  );

  // ── Select helper ──

  const FieldSelect = ({ label, value, options, onChange }: {
    label: string; value: string | undefined; options: { value: string; label: string }[]; onChange: (v: string) => void;
  }) => (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm border-border/50 bg-muted/30"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  // ── Chip multi-select helper ──

  const ChipMulti = ({ field, options, max = 5 }: {
    field: 'styleWords' | 'wardrobeFrustrations' | 'hardestOccasions'; options: string[]; max?: number;
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(v => (
        <Chip key={v} selected={(sp[field] as string[] || []).includes(v)} onClick={() => toggleMulti(field, v, max)} className="text-xs capitalize">
          {t(`q3.opt.${v}`) !== `q3.opt.${v}` ? t(`q3.opt.${v}`) : v.replace(/_/g, ' ')}
        </Chip>
      ))}
    </div>
  );

  // ── Color grid ──

  const ColorGrid = ({ field }: { field: 'favoriteColors' | 'dislikedColors' }) => (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map(color => {
        const selected = (sp[field] || []).includes(color);
        return (
          <Chip key={color} selected={selected} onClick={() => toggleColor(field, color)} className="capitalize text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-foreground/10" style={{ backgroundColor: COLOR_MAP[color] }} />
            {t(`color.${color}`) !== `color.${color}` ? t(`color.${color}`) : color}
          </Chip>
        );
      })}
    </div>
  );

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.style')} showBack />

      <div className="px-4 pb-6 pt-4 space-y-3 max-w-lg mx-auto">

        {!hasProfile && (
          <div className="bg-accent/8 border border-accent/20 rounded-[1.25rem] p-4 text-center space-y-2">
            <Sparkles className="w-5 h-5 text-accent mx-auto" />
            <p className="text-sm text-foreground font-medium">{t('settings.no_profile_title') || 'No style profile yet'}</p>
            <p className="text-xs text-muted-foreground">{t('settings.no_profile_desc') || 'Complete the style quiz during onboarding to personalize your experience.'}</p>
          </div>
        )}

        {/* Body Data */}
        <Collapsible open={openSection === 'body'} className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <SectionHeader id="body" icon={Ruler} title={t('settings.body_data')} summary={heightCm ? `${heightCm} cm${weightKg ? ` · ${weightKg} kg` : ''}` : undefined} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-[13px] font-medium">
                  <Ruler className="w-3.5 h-3.5 text-accent" />{t('settings.height')}
                </Label>
                <div className="relative">
                  <Input type="number" inputMode="numeric" value={heightCm}
                    onChange={(e) => { setHeightCm(e.target.value); if (heightError) validateHeight(e.target.value); }}
                    onBlur={() => validateHeight(heightCm)}
                    placeholder="175"
                    className={`pr-12 h-10 text-sm${heightError ? ' border-destructive focus-visible:ring-destructive' : ''}`}
                    min={100} max={250} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
                </div>
                {heightError && <p className="text-xs text-destructive">{heightError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-[13px] font-medium">
                  <Weight className="w-3.5 h-3.5 text-accent" />{t('settings.weight')}
                  <span className="text-muted-foreground font-normal">{t('settings.optional')}</span>
                </Label>
                <div className="relative">
                  <Input type="number" inputMode="numeric" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" className="pr-12 h-10 text-sm" min={30} max={300} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">{t('settings.body_privacy')}</p>
              </div>
              <Button onClick={handleSaveBodyData} disabled={updateProfile.isPending} size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11 text-xs">
                {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : bodySaved ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : null}
                {bodySaved ? t('settings.saved') : t('settings.save_measurements')}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Identity */}
        <Collapsible open={openSection === 'identity'} className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <SectionHeader id="identity" icon={User} title={t('q3.s1.title') || 'About you'} summary={[sp.gender, sp.ageRange, sp.climate].filter(Boolean).join(' · ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-4">
              <FieldSelect label={t('q3.q1') || 'Gender'} value={sp.gender} onChange={v => updateStyleField('gender', v)} options={[
                { value: 'male', label: t('q3.gender.male') || 'Male' },
                { value: 'female', label: t('q3.gender.female') || 'Female' },
                { value: 'nonbinary', label: t('q3.gender.nonbinary') || 'Non-binary' },
                { value: 'prefer_not', label: t('q3.gender.prefer_not') || 'Prefer not to say' },
              ]} />
              <FieldSelect label={t('q3.q2') || 'Age range'} value={sp.ageRange} onChange={v => updateStyleField('ageRange', v)} options={
                ['18-24', '25-34', '35-44', '45-54', '55+'].map(v => ({ value: v, label: v }))
              } />
              <FieldSelect label={t('q3.q4') || 'Climate'} value={sp.climate} onChange={v => updateStyleField('climate', v)} options={[
                { value: 'cold', label: t('q3.climate.cold') || 'Cold' },
                { value: 'temperate', label: t('q3.climate.temperate') || 'Temperate' },
                { value: 'warm', label: t('q3.climate.warm') || 'Warm' },
                { value: 'tropical', label: t('q3.climate.tropical') || 'Tropical' },
                { value: 'mixed', label: t('q3.climate.mixed') || 'Mixed/seasonal' },
              ]} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Daily life */}
        <Collapsible open={openSection === 'daily'} className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <SectionHeader id="daily" icon={Briefcase} title={t('q3.s2.title') || 'Daily life'} summary={[sp.weekdayLife, sp.workFormality].filter(Boolean).join(' · ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-4">
              <FieldSelect label={t('q3.q5') || 'Weekday life'} value={sp.weekdayLife} onChange={v => updateStyleField('weekdayLife', v)} options={[
                { value: 'office', label: t('q3.weekday.office') || 'Office' },
                { value: 'remote', label: t('q3.weekday.remote') || 'Remote/WFH' },
                { value: 'creative', label: t('q3.weekday.creative') || 'Creative field' },
                { value: 'active', label: t('q3.weekday.active') || 'Active/outdoors' },
                { value: 'student', label: t('q3.weekday.student') || 'Student' },
              ]} />
              <FieldSelect label={t('q3.q6') || 'Work formality'} value={sp.workFormality} onChange={v => updateStyleField('workFormality', v)} options={[
                { value: 'very_casual', label: t('q3.formality.very_casual') || 'Very casual' },
                { value: 'casual', label: t('q3.formality.casual') || 'Casual' },
                { value: 'smart_casual', label: t('q3.formality.smart_casual') || 'Smart casual' },
                { value: 'business', label: t('q3.formality.business') || 'Business' },
                { value: 'formal', label: t('q3.formality.formal') || 'Formal' },
              ]} />
              <FieldSelect label={t('q3.q7') || 'Weekend life'} value={sp.weekendLife} onChange={v => updateStyleField('weekendLife', v)} options={[
                { value: 'relaxed', label: t('q3.weekend.relaxed') || 'Relaxed' },
                { value: 'social', label: t('q3.weekend.social') || 'Social' },
                { value: 'active', label: t('q3.weekend.active') || 'Active' },
                { value: 'mixed', label: t('q3.weekend.mixed') || 'Mixed' },
              ]} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Style direction */}
        <Collapsible open={openSection === 'style'} className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <SectionHeader id="style" icon={Sparkles} title={t('q3.s3.title') || 'Style direction'} summary={sp.styleWords?.slice(0, 3).join(', ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('q3.q9') || 'Style words'}</Label>
                <ChipMulti field="styleWords" options={['minimal', 'classic', 'streetwear', 'romantic', 'edgy', 'bohemian', 'preppy', 'sporty', 'elegant', 'scandinavian', 'vintage', 'artsy']} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  {t('q3.q10') || 'Comfort vs. style'}: {sp.comfortVsStyle ?? 50}%
                </Label>
                <Slider value={[sp.comfortVsStyle ?? 50]} min={0} max={100} step={5}
                  onValueCommit={([v]) => updateStyleField('comfortVsStyle', v)}
                  className="w-full" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{t('q3.comfort') || 'Comfort'}</span>
                  <span>{t('q3.style') || 'Style'}</span>
                </div>
              </div>
              <FieldSelect label={t('q3.q11') || 'Adventurousness'} value={sp.adventurousness} onChange={v => updateStyleField('adventurousness', v)} options={[
                { value: 'safe', label: t('q3.adv.safe') || 'Play it safe' },
                { value: 'balanced', label: t('q3.adv.balanced') || 'Balanced' },
                { value: 'adventurous', label: t('q3.adv.adventurous') || 'Love trying new things' },
              ]} />
              <FieldSelect label={t('q3.q12') || 'Trend following'} value={sp.trendFollowing} onChange={v => updateStyleField('trendFollowing', v)} options={[
                { value: 'timeless', label: t('q3.trend.timeless') || 'Timeless only' },
                { value: 'selective', label: t('q3.trend.selective') || 'Selective trends' },
                { value: 'trend_forward', label: t('q3.trend.trend_forward') || 'Trend-forward' },
              ]} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Fit & silhouette */}
        <Collapsible open={openSection === 'fit'} className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <SectionHeader id="fit" icon={Shirt} title={t('q3.s4.title') || 'Fit & silhouette'} summary={[sp.fit, sp.layering].filter(Boolean).join(' · ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-4">
              <FieldSelect label={t('q3.q14') || 'Overall fit'} value={sp.fit} onChange={v => updateStyleField('fit', v)} options={[
                { value: 'slim', label: t('style.slim') || 'Slim' },
                { value: 'regular', label: t('style.regular') || 'Regular' },
                { value: 'loose', label: t('style.loose') || 'Loose/relaxed' },
                { value: 'oversized', label: t('q3.fit.oversized') || 'Oversized' },
              ]} />
              <FieldSelect label={t('q3.q15') || 'Layering'} value={sp.layering} onChange={v => updateStyleField('layering', v)} options={[
                { value: 'minimal', label: t('q3.layer.minimal') || 'Minimal layers' },
                { value: 'moderate', label: t('q3.layer.moderate') || 'Some layering' },
                { value: 'loves', label: t('q3.layer.loves') || 'Love layering' },
              ]} />
              <FieldSelect label={t('q3.q16') || 'Top preference'} value={sp.topFit} onChange={v => updateStyleField('topFit', v)} options={[
                { value: 'fitted', label: t('q3.top.fitted') || 'Fitted' },
                { value: 'regular', label: t('q3.top.regular') || 'Regular' },
                { value: 'relaxed', label: t('q3.top.relaxed') || 'Relaxed' },
                { value: 'oversized', label: t('q3.top.oversized') || 'Oversized' },
              ]} />
              <FieldSelect label={t('q3.q17') || 'Bottom length'} value={sp.bottomLength} onChange={v => updateStyleField('bottomLength', v)} options={[
                { value: 'cropped', label: t('q3.bottom.cropped') || 'Cropped' },
                { value: 'ankle', label: t('q3.bottom.ankle') || 'Ankle' },
                { value: 'full', label: t('q3.bottom.full') || 'Full length' },
                { value: 'any', label: t('q3.bottom.any') || 'No preference' },
              ]} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Colors & patterns */}
        <Collapsible open={openSection === 'colors'} className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <SectionHeader id="colors" icon={Palette} title={t('q3.s5.title') || 'Colors & patterns'} summary={sp.favoriteColors?.slice(0, 4).join(', ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('settings.favorite_colors')}</Label>
                <ColorGrid field="favoriteColors" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('settings.disliked_colors')}</Label>
                <ColorGrid field="dislikedColors" />
              </div>
              <FieldSelect label={t('q3.q21') || 'Palette vibe'} value={sp.paletteVibe} onChange={v => updateStyleField('paletteVibe', v)} options={[
                { value: 'neutral', label: t('q3.palette.neutral') || 'Neutral/earth tones' },
                { value: 'muted', label: t('q3.palette.muted') || 'Muted/dusty' },
                { value: 'bold', label: t('q3.palette.bold') || 'Bold/saturated' },
                { value: 'monochrome', label: t('q3.palette.monochrome') || 'Monochrome' },
              ]} />
              <FieldSelect label={t('q3.q22') || 'Pattern feeling'} value={sp.patternFeeling} onChange={v => updateStyleField('patternFeeling', v)} options={[
                { value: 'solids_only', label: t('q3.pattern.solids_only') || 'Solids only' },
                { value: 'subtle', label: t('q3.pattern.subtle') || 'Subtle patterns' },
                { value: 'bold_patterns', label: t('q3.pattern.bold_patterns') || 'Bold patterns' },
                { value: 'mixed', label: t('q3.pattern.mixed') || 'Mix of both' },
              ]} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Philosophy */}
        <Collapsible open={openSection === 'philosophy'} className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <SectionHeader id="philosophy" icon={Target} title={t('q3.s6.title') || 'Philosophy'} summary={[sp.shoppingMindset, sp.sustainability].filter(Boolean).join(' · ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-4">
              <FieldSelect label={t('q3.q23') || 'Shopping mindset'} value={sp.shoppingMindset} onChange={v => updateStyleField('shoppingMindset', v)} options={[
                { value: 'minimal', label: t('q3.shop.minimal') || 'Buy less, buy better' },
                { value: 'regular', label: t('q3.shop.regular') || 'Regular shopping' },
                { value: 'enthusiast', label: t('q3.shop.enthusiast') || 'Fashion enthusiast' },
              ]} />
              <FieldSelect label={t('q3.q24') || 'Sustainability'} value={sp.sustainability} onChange={v => updateStyleField('sustainability', v)} options={[
                { value: 'important', label: t('q3.sus.important') || 'Very important' },
                { value: 'somewhat', label: t('q3.sus.somewhat') || 'Somewhat' },
                { value: 'not_priority', label: t('q3.sus.not_priority') || 'Not a priority' },
              ]} />
              <FieldSelect label={t('q3.q25') || 'Capsule wardrobe'} value={sp.capsuleWardrobe} onChange={v => updateStyleField('capsuleWardrobe', v)} options={[
                { value: 'yes', label: t('q3.capsule.yes') || 'Yes, striving for it' },
                { value: 'interested', label: t('q3.capsule.interested') || 'Interested' },
                { value: 'no', label: t('q3.capsule.no') || 'Not interested' },
              ]} />
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('q3.q26') || 'Wardrobe frustrations'}</Label>
                <ChipMulti field="wardrobeFrustrations" options={['nothing_to_wear', 'too_many_clothes', 'outfit_repeating', 'color_matching', 'occasion_dressing', 'fit_issues']} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Inspiration */}
        <Collapsible open={openSection === 'inspiration'} className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <SectionHeader id="inspiration" icon={Compass} title={t('q3.s7.title') || 'Inspiration'} summary={sp.fabricFeel || sp.signaturePieces || undefined} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('q3.q27') || 'Style icons'}</Label>
                <Input value={sp.styleIcons || ''} onChange={e => updateStyleField('styleIcons', e.target.value)} placeholder={t('q3.q27_hint') || 'e.g. Scandinavian minimalism'} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('q3.q28') || 'Hardest occasions'}</Label>
                <ChipMulti field="hardestOccasions" options={['work', 'date_night', 'wedding', 'travel', 'weekend_casual', 'formal_event']} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('q3.q29') || 'Favorite fabrics'}</Label>
                <Input value={sp.fabricFeel || ''} onChange={e => updateStyleField('fabricFeel', e.target.value)} placeholder={t('q3.q29_hint') || 'e.g. linen, cashmere'} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('q3.q30') || 'Signature pieces'}</Label>
                <Input value={sp.signaturePieces || ''} onChange={e => updateStyleField('signaturePieces', e.target.value)} placeholder={t('q3.q30_hint') || 'e.g. oversized blazer, white sneakers'} className="h-9 text-sm" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Goals */}
        <Collapsible open={openSection === 'goals'} className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <SectionHeader id="goals" icon={Heart} title={t('q3.s8.title') || 'Goals'} summary={sp.primaryGoal || undefined} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-4">
              <FieldSelect label={t('q3.q31') || 'Primary goal with BURS'} value={sp.primaryGoal} onChange={v => updateStyleField('primaryGoal', v)} options={[
                { value: 'save_time', label: t('q3.goal.save_time') || 'Save time getting dressed' },
                { value: 'better_style', label: t('q3.goal.better_style') || 'Improve my style' },
                { value: 'wardrobe_org', label: t('q3.goal.wardrobe_org') || 'Organize my wardrobe' },
                { value: 'reduce_waste', label: t('q3.goal.reduce_waste') || 'Reduce fashion waste' },
                { value: 'plan_outfits', label: t('q3.goal.plan_outfits') || 'Plan outfits ahead' },
              ]} />
              <FieldSelect label={t('q3.q32') || 'Morning routine'} value={sp.morningTime} onChange={v => updateStyleField('morningTime', v)} options={[
                { value: '5min', label: t('q3.morning.5min') || 'Under 5 minutes' },
                { value: '10min', label: t('q3.morning.10min') || '5–10 minutes' },
                { value: '15min', label: t('q3.morning.15min') || '10–15 minutes' },
                { value: 'enjoy', label: t('q3.morning.enjoy') || 'I enjoy taking my time' },
              ]} />
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{t('q3.q33') || 'Anything else?'}</Label>
                <Input value={sp.freeNote || ''} onChange={e => updateStyleField('freeNote', e.target.value)} placeholder={t('q3.q33_hint') || 'Any personal style notes...'} className="h-9 text-sm" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Read-only style words summary */}
        {sp.styleWords && sp.styleWords.length > 0 && (
          <div className="px-1 py-3 space-y-2">
            <p style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'rgba(28,25,23,0.4)',
            }}>
              YOUR STYLE WORDS
            </p>
            <div className="flex flex-wrap gap-2">
              {sp.styleWords.map(word => (
                <span
                  key={word}
                  style={{
                    backgroundColor: '#EDE8DF',
                    borderRadius: 0,
                    padding: '6px 12px',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 12,
                    color: '#1C1917',
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Mannequin preference */}
        <div className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-foreground block">Show garments on mannequin</span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">Displays a clean ghost mannequin view when available</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!prefs.show_mannequin}
              onClick={async () => {
                const next = !prefs.show_mannequin;
                try {
                  await updateProfile.mutateAsync({
                    preferences: { ...prefs, show_mannequin: next } as Json,
                  });
                } catch { toast.error(t('settings.pref_error')); }
              }}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                prefs.show_mannequin ? 'bg-accent' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out',
                  prefs.show_mannequin ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </div>

        {/* Studio render prompt */}
        <div className="surface-editorial rounded-[1.25rem] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-foreground block">Offer studio renders</span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">Show the Studio Look prompt after adding a garment</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.showRenderPrompt !== false}
              onClick={async () => {
                const next = prefs.showRenderPrompt === false;
                try {
                  await updateProfile.mutateAsync({
                    preferences: { ...prefs, showRenderPrompt: next } as Json,
                  });
                } catch { toast.error(t('settings.pref_error')); }
              }}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                prefs.showRenderPrompt !== false ? 'bg-accent' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out',
                  prefs.showRenderPrompt !== false ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
