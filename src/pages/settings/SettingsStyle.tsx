import { useState, useEffect } from 'react';
import { Ruler, Weight, Lock, Palette, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Chip } from '@/components/ui/chip';
import { toast } from 'sonner';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<string, string> = {
  svart: '#111111', vit: '#F6F4F1', grå: '#9CA3AF', marinblå: '#1E3A5F',
  blå: '#3B82F6', röd: '#EF4444', grön: '#22C55E', beige: '#D2B48C',
  brun: '#8B4513', rosa: '#F9A8D4', gul: '#FACC15', orange: '#F97316',
  lila: '#A855F7',
  // Neutrals
  ivory: '#FFFFF0', kräm: '#FFFDD0', sand: '#C2B280', khaki: '#BDB76B',
  kolgrå: '#54585A', antracit: '#383838',
  // Blues
  himmelsblå: '#87CEEB', turkos: '#40E0D0', petrol: '#006D6F',
  indigo: '#4B0082', kobolt: '#0047AB',
  // Greens
  olivgrön: '#6B8E23', skogsgrön: '#228B22', mint: '#98FF98', salviagrön: '#87AE73',
  // Reds / Pinks
  vinröd: '#722F37', korall: '#FF7F50', aprikos: '#FBCEB1',
  fuchsia: '#FF00FF', lavendel: '#E6E6FA',
  // Earths
  kamel: '#C19A6B', rost: '#B7410E', cognac: '#9A463D',
  choklad: '#7B3F00', terrakotta: '#E2725B',
  // Others
  guld: '#FFD700', silver: '#C0C0C0', kricka: '#008080',
  plommon: '#8E4585', senapsgul: '#FFDB58',
};

const COLORS = Object.keys(COLOR_MAP);

interface Preferences {
  favoriteColors?: string[];
  dislikedColors?: string[];
  fitPreference?: string;
  styleVibe?: string;
  genderNeutral?: boolean;
  morningReminder?: boolean;
}

type SectionId = 'body' | 'favorites' | 'disliked' | 'fit';

export default function SettingsStyle() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { t } = useLanguage();

  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightError, setHeightError] = useState('');
  const [bodySaved, setBodySaved] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  useEffect(() => {
    const p = profile as (typeof profile & { height_cm?: number | null; weight_kg?: number | null });
    if (p?.height_cm) setHeightCm(String(p.height_cm));
    if (p?.weight_kg) setWeightKg(String(p.weight_kg));
  }, [profile]);

  const preferences = (profile?.preferences as Preferences) || {};

  const updatePreference = async (key: keyof Preferences, value: unknown) => {
    const newPrefs = { ...preferences, [key]: value };
    try { await updateProfile.mutateAsync({ preferences: newPrefs }); }
    catch { toast.error(t('settings.pref_error')); }
  };

  const toggleColorPreference = async (type: 'favoriteColors' | 'dislikedColors', color: string) => {
    const currentColors = preferences[type] || [];
    const newColors = currentColors.includes(color)
      ? currentColors.filter((c: string) => c !== color)
      : [...currentColors, color];
    await updatePreference(type, newColors);
  };

  const validateHeight = (val: string) => {
    const n = parseInt(val, 10);
    if (val && (isNaN(n) || n < 100 || n > 250)) { setHeightError(t('settings.height_error')); return false; }
    setHeightError(''); return true;
  };

  const handleSaveBodyData = async () => {
    if (heightCm && !validateHeight(heightCm)) return;
    try {
      const updates: Record<string, unknown> = {};
      updates.height_cm = heightCm ? parseInt(heightCm, 10) : null;
      updates.weight_kg = weightKg ? parseInt(weightKg, 10) : null;
      await updateProfile.mutateAsync(updates as Parameters<typeof updateProfile.mutateAsync>[0]);
      setBodySaved(true);
      setTimeout(() => setBodySaved(false), 2500);
    } catch { toast.error(t('settings.body_save_error')); }
  };

  const toggle = (id: SectionId) => setOpenSection(prev => prev === id ? null : id);

  const SectionHeader = ({ id, title, badge }: { id: SectionId; title: string; badge?: number }) => (
    <CollapsibleTrigger
      onClick={() => toggle(id)}
      className="flex items-center justify-between w-full px-4 py-3.5 text-left"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] font-medium bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <ChevronDown
        className={cn(
          'w-4 h-4 text-muted-foreground transition-transform duration-200',
          openSection === id && 'rotate-180'
        )}
      />
    </CollapsibleTrigger>
  );

  const ColorGrid = ({ type }: { type: 'favoriteColors' | 'dislikedColors' }) => (
    <div className="px-4 pb-4 pt-1">
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((color) => (
          <Chip
            key={color}
            selected={preferences[type]?.includes(color)}
            onClick={() => toggleColorPreference(type, color)}
            className="capitalize text-xs"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-foreground/10"
              style={{ backgroundColor: COLOR_MAP[color] }}
            />
            {color}
          </Chip>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.style')} showBack />

      <div className="px-4 pb-6 pt-4 space-y-3 max-w-lg mx-auto">

        {/* Body Data */}
        <Collapsible open={openSection === 'body'} className="bg-card rounded-xl overflow-hidden">
          <SectionHeader id="body" title={t('settings.body_data')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
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
                <Label className="flex items-center gap-1.5 text-xs font-medium">
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

              <Button onClick={handleSaveBodyData} disabled={updateProfile.isPending} size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-9 text-xs">
                {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : bodySaved ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : null}
                {bodySaved ? t('settings.saved') : t('settings.save_measurements')}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Favorite Colors */}
        <Collapsible open={openSection === 'favorites'} className="bg-card rounded-xl overflow-hidden">
          <SectionHeader id="favorites" title={t('settings.favorite_colors')} badge={preferences.favoriteColors?.length} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <ColorGrid type="favoriteColors" />
          </CollapsibleContent>
        </Collapsible>

        {/* Disliked Colors */}
        <Collapsible open={openSection === 'disliked'} className="bg-card rounded-xl overflow-hidden">
          <SectionHeader id="disliked" title={t('settings.disliked_colors')} badge={preferences.dislikedColors?.length} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <ColorGrid type="dislikedColors" />
          </CollapsibleContent>
        </Collapsible>

        {/* Fit & Style */}
        <Collapsible open={openSection === 'fit'} className="bg-card rounded-xl overflow-hidden">
          <SectionHeader id="fit" title={t('settings.fit') + ' & ' + t('settings.default_style')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div>
              <SettingsRow icon={<Palette />} label={t('settings.fit')}>
                <Select value={preferences.fitPreference || 'regular'} onValueChange={(v) => updatePreference('fitPreference', v)}>
                  <SelectTrigger className="w-[110px] h-8 text-xs border-0 bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loose">{t('style.loose')}</SelectItem>
                    <SelectItem value="regular">{t('style.regular')}</SelectItem>
                    <SelectItem value="slim">{t('style.slim')}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
              <SettingsRow icon={<Palette />} label={t('settings.default_style')}>
                <Select value={preferences.styleVibe || 'smart-casual'} onValueChange={(v) => updatePreference('styleVibe', v)}>
                  <SelectTrigger className="w-[130px] h-8 text-xs border-0 bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">{t('style.minimal')}</SelectItem>
                    <SelectItem value="street">{t('style.street')}</SelectItem>
                    <SelectItem value="smart-casual">{t('style.smart_casual')}</SelectItem>
                    <SelectItem value="klassisk">{t('style.klassisk')}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
              <SettingsRow icon={<Palette />} label={t('settings.gender_neutral')} last>
                <Switch checked={preferences.genderNeutral || false} onCheckedChange={(v) => updatePreference('genderNeutral', v)} />
              </SettingsRow>
            </div>
          </CollapsibleContent>
        </Collapsible>

      </div>
    </AppLayout>
  );
}
