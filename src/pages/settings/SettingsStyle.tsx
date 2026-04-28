import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Ruler, Weight, Lock, CheckCircle2, Loader2, ChevronDown, Palette, Shirt, Sparkles, Target, Heart, Compass, User, Briefcase } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
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
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM } from '@/lib/motion';
import type { StyleProfile } from '@/types/preferences';
import type { Json, TablesUpdate } from '@/integrations/supabase/types';
import { mannequinPresentationFromStyleProfileGender } from '@/lib/mannequinPresentation';
import {
  ARCHETYPE_OPTIONS,
  COLOR_SWATCHES,
  STYLE_PROFILE_VERSION,
  v3ArchetypeToV4,
  v3ColorToV4,
  v3FitToV4,
  v4ClimateToV3,
  v4FitToV3,
  v4GenderToV3,
  v4LayeringToV3,
  v4PaletteVibeToV3,
  v4PrimaryGoalToV3,
  type ArchetypeId as V4ArchetypeId,
  type Climate as V4Climate,
  type ColorSwatchId as V4ColorSwatchId,
  type FitOverall as V4FitOverall,
  type Gender as V4Gender,
  type Layering as V4Layering,
  type PaletteVibe as V4PaletteVibe,
  type PrimaryGoal as V4PrimaryGoal,
} from '@/types/styleProfile';

const V4_GENDER_VALUES = new Set(['feminine', 'masculine', 'neutral', 'prefer_not']);
const V4_FIT_VALUES = new Set(['fitted', 'regular', 'relaxed', 'oversized', 'mixed']);
const V4_CLIMATE_VALUES = new Set(['nordic', 'temperate', 'mediterranean', 'tropical', 'desert', 'varies']);
const V4_LAYERING_VALUES = new Set(['minimal', 'some', 'love']);
const V4_PALETTE_VALUES = new Set(['neutrals', 'bold', 'dark', 'pastels', 'earth', 'mixed']);
const V4_GOAL_VALUES = new Set([
  'reduce_decisions', 'discover_style', 'curate_capsule',
  'special_events', 'professional_polish', 'sustainability', 'fun_experimenting',
]);

// ── Color palette ──
//
// 36-entry V3 legacy palette. Wave 7.9 audit P1 #10 introduced the
// curated V4 18-set via `COLOR_SWATCHES` (imported above). The 36-entry
// map remains so legacy V3 records that already stored V3-only color
// names (`yellow`, `coral`, `gold`, `cobalt`, …) keep rendering with
// their saved selection visible. V4-aware records use the V4 18 only —
// see the `paletteOptions` derivation below.

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
  // V4 swatches not in the legacy V3 list. Without these entries,
  // the swatch dot would render with no background color when V4 mode
  // shows them in the grid (Wave 7.9 audit P1 #10).
  denim: '#4B6C8A',
};

// Codex P2 round 4 (PR #696): V3 chip set is HARDCODED as the original
// 36-color list, NOT derived from `Object.keys(COLOR_MAP)`. The earlier
// round 3 fix added `denim` to `COLOR_MAP` so V4 chips have a hex value
// — but `Object.keys` leaked `denim` into the V3 set, letting legacy
// V3 users pick a swatch that's V4-only vocab. Keeping the V3 list
// explicit prevents cross-version vocab drift in saved V3 profiles.
const LEGACY_V3_COLORS: readonly string[] = [
  'black', 'white', 'grey', 'navy',
  'blue', 'red', 'green', 'beige',
  'brown', 'pink', 'yellow', 'orange',
  'purple', 'ivory', 'cream', 'sand',
  'khaki', 'charcoal', 'skyblue', 'turquoise',
  'olive', 'forest', 'mint', 'sage',
  'burgundy', 'coral', 'lavender',
  'camel', 'rust', 'cognac',
  'teal', 'plum', 'mustard', 'gold',
  'indigo', 'cobalt',
];
const COLORS = LEGACY_V3_COLORS;
const V4_COLOR_IDS = COLOR_SWATCHES.map((s) => s.id) as readonly string[];

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

  const isV4 = (sp as { version?: number }).version === STYLE_PROFILE_VERSION;

  // Codex P1 round 3 follow-up on PR #696 — V4 normalized arrays shared by
  // render + toggle paths.
  //
  // The previous rounds normalized the WRITE path (output to archetypes
  // mirror, output favoriteColors). But the READ path (chip selected state
  // in ChipMulti / ColorGrid + max-cap check in toggleMulti) still derived
  // from raw `sp[field]`, which produced two concrete UX bugs:
  //
  // (a) Color chip flip-direction: V4 user with `favoriteColors: ['gold']`
  //     sees `camel` rendered UNSELECTED (raw .includes('camel') is false)
  //     but click handler treats `normalizedCurrent.includes('camel')` as
  //     true (gold→camel) and REMOVES instead of adding. Opposite of user
  //     intent.
  //
  // (b) StyleWords cap-stuck: V4 user with 5 hidden V3 tokens
  //     ['streetwear','scandinavian','elegant','vintage','artsy'] hits
  //     `current.length >= 5` cap immediately. Visible V4 chips can't be
  //     added because cap is full; hidden tokens can't be removed because
  //     they're not in the V4 chip list. User is stuck.
  //
  // Fix: memoize the normalized arrays here and use them for BOTH the
  // chip-selected render state AND the toggle includes/max/filter checks.
  // Pass-through for non-V4 records (no normalization, legacy V3 vocab
  // preserved as-is).
  const normalizedStyleWordsV4 = useMemo(() => {
    if (!isV4) return null;
    const seen = new Set<V4ArchetypeId>();
    const out: V4ArchetypeId[] = [];
    for (const token of (sp.styleWords as string[] | undefined) ?? []) {
      if (typeof token !== 'string') continue;
      const v4 = v3ArchetypeToV4(token);
      if (v4 && !seen.has(v4)) {
        seen.add(v4);
        out.push(v4);
      }
    }
    return out;
  }, [isV4, sp]);

  const normalizeColorsV4Memoized = (raw: readonly string[] | undefined): V4ColorSwatchId[] => {
    const seen = new Set<V4ColorSwatchId>();
    const out: V4ColorSwatchId[] = [];
    for (const token of raw ?? []) {
      if (typeof token !== 'string') continue;
      const v4 = v3ColorToV4(token);
      if (v4 && !seen.has(v4)) {
        seen.add(v4);
        out.push(v4);
      }
    }
    return out;
  };
  const normalizedFavoriteColorsV4 = useMemo(
    () => (isV4 ? normalizeColorsV4Memoized(sp.favoriteColors) : null),
    [isV4, sp],
  );
  const normalizedDislikedColorsV4 = useMemo(
    () => (isV4 ? normalizeColorsV4Memoized(sp.dislikedColors) : null),
    [isV4, sp],
  );

  const updateStyleField = async (key: keyof StyleProfile, value: unknown) => {
    // V4-aware write strategy (PR #688 audit finding #9 alignment with
    // `migrateV4ToV3Compat`):
    //
    // The persisted record carries V4-only canonical keys (`fitOverall`,
    // `formalityCeiling`, `archetypes`, `lifestyle`) AND V3-mirror keys with
    // V3 vocab on every same-name collision (`gender`, `climate`, `layering`,
    // `paletteVibe`, `primaryGoal`). Five legacy edge readers
    // (`burs_style_engine`, `style_chat`, `_shared/outfit-scoring.ts`)
    // string-match on V3 enums, so we MUST persist V3 vocab on the
    // colliding keys. Translating dropdown input to V4 vocab on write would
    // re-introduce the original bug (V3 readers stop parsing the field).
    //
    // - Same-name collisions (gender, climate, layering, paletteVibe,
    //   primaryGoal): pass the V3 dropdown value through unchanged. The
    //   `v3*ToV4` translators are still exported for any future code that
    //   genuinely needs the V4 enum from a V3 input (e.g. building a V4
    //   profile object in tests), but Settings doesn't need them.
    // - `fit`: V3 'fit' and V4 'fitOverall' are DIFFERENT keys for the same
    //   conceptual field. Update BOTH — V3 mirror keeps V3 vocab for legacy
    //   readers, V4 canonical (`fitOverall`) gets the V4 enum so V4-aware
    //   consumers don't read stale data after a Settings edit (Codex round 5
    //   P1 on PR #685).
    // Non-V4 (pre-quiz) records pass through with no translation either way.
    let newSp: Record<string, unknown> = { ...sp, [key]: value };
    if (isV4 && typeof value === 'string') {
      if (key === 'fit') {
        const v4 = v3FitToV4(value);
        if (v4) newSp = { ...sp, fit: value, fitOverall: v4 };
      }
      // Other collision keys (gender / climate / layering / paletteVibe /
      // primaryGoal) intentionally fall through with V3 vocab preserved.
    }

    try {
      await updateProfile.mutateAsync({
        // Mannequin helper expects V3 vocab ('male'/'female'/'mixed'); the
        // dropdown emits V3 strings directly so we can pass `value` through.
        mannequin_presentation: key === 'gender'
          ? mannequinPresentationFromStyleProfileGender(value)
          : undefined,
        preferences: { ...prefs, styleProfile: newSp } as Json,
      });
    } catch { toast.error(t('settings.pref_error')); }
  };

  // Display values for V4-vocab fields shown via legacy V3 dropdowns. When
  // the persisted record is V4, transform `gender`/`fit` for display so the
  // FieldSelect can highlight the matching option (otherwise the dropdown
  // shows nothing selected, leading to silent edits that overwrite V4).
  const displayGender =
    typeof sp.gender === 'string' && V4_GENDER_VALUES.has(sp.gender)
      ? v4GenderToV3(sp.gender as V4Gender)
      : sp.gender;
  const displayFit =
    typeof sp.fit === 'string' && V4_FIT_VALUES.has(sp.fit)
      ? v4FitToV3(sp.fit as V4FitOverall)
      : sp.fit;
  const displayClimate =
    typeof sp.climate === 'string' && V4_CLIMATE_VALUES.has(sp.climate)
      ? v4ClimateToV3(sp.climate as V4Climate)
      : sp.climate;
  const displayLayering =
    typeof sp.layering === 'string' && V4_LAYERING_VALUES.has(sp.layering)
      ? v4LayeringToV3(sp.layering as V4Layering)
      : sp.layering;
  const displayPaletteVibe =
    typeof sp.paletteVibe === 'string' && V4_PALETTE_VALUES.has(sp.paletteVibe)
      ? v4PaletteVibeToV3(sp.paletteVibe as V4PaletteVibe)
      : sp.paletteVibe;
  const displayPrimaryGoal =
    typeof sp.primaryGoal === 'string' && V4_GOAL_VALUES.has(sp.primaryGoal)
      ? v4PrimaryGoalToV3(sp.primaryGoal as V4PrimaryGoal)
      : sp.primaryGoal;

  const toggleColor = async (field: 'favoriteColors' | 'dislikedColors', color: string) => {
    // Codex P1 round 2 (PR #696): for V4 records, normalize the existing
    // array through `v3ColorToV4` BEFORE applying the toggle so legacy
    // V3 ids (gold, cobalt, ...) get translated to V4 vocab and the
    // user can actually remove them by tapping their V4-translated chip.
    //
    // Codex P1 round 3 (PR #696): the SAME normalized array is now
    // exposed via the memoized `normalizedFavoriteColorsV4` /
    // `normalizedDislikedColorsV4` so the ColorGrid render uses the same
    // source of truth for the `selected` chip state. Without that, the
    // chip would show UNSELECTED while the click handler treated it as
    // already selected — opposite-of-intent click outcome for migrated
    // users.
    const memoized =
      field === 'favoriteColors' ? normalizedFavoriteColorsV4 : normalizedDislikedColorsV4;
    const normalizedCurrent: readonly string[] =
      isV4 && memoized ? memoized : (sp[field] || []);

    const next = normalizedCurrent.includes(color)
      ? normalizedCurrent.filter(c => c !== color)
      : [...normalizedCurrent, color];
    await updateStyleField(field, next);
  };

  // Wave 7.9 audit P1 #8 + #10 — V4-aware vocab options.
  //
  // Legacy V3 records render the original 12 V3 archetype names + 36 V3
  // colors so existing users keep seeing their saved picks. V4 records
  // render V4's curated 12 archetypes + 18 colors, matching the Style DNA
  // Quiz V4 vocabulary. On edit through this page, V4-vocab IDs are
  // written to BOTH the V3 mirror (`styleWords` / `favoriteColors` /
  // `dislikedColors`) AND the V4 canonical fields — see toggleMulti.
  const archetypeOptions = isV4
    ? (ARCHETYPE_OPTIONS as readonly string[])
    : (['minimal', 'classic', 'streetwear', 'romantic', 'edgy', 'bohemian', 'preppy', 'sporty', 'elegant', 'scandinavian', 'vintage', 'artsy'] as readonly string[]);
  const colorOptions = isV4 ? V4_COLOR_IDS : COLORS;

  const toggleMulti = async (field: 'styleWords' | 'wardrobeFrustrations' | 'hardestOccasions', val: string, max = 5) => {
    // Codex P1 round 3 (PR #696): for V4 records' styleWords, normalize
    // the existing array against the V4 vocab BEFORE the includes/max/
    // filter checks. Otherwise a profile with 5 hidden V3 tokens
    // (streetwear/scandinavian/elegant/vintage/artsy) would already be
    // at the cap, so no V4 chip could be added — and the user can't
    // deselect the hidden ones because they're not in the V4 chip set.
    // Mirror behavior to toggleColor's memoized normalized array.
    const current: string[] =
      isV4 && field === 'styleWords' && normalizedStyleWordsV4
        ? [...normalizedStyleWordsV4]
        : ((sp[field] as string[]) || []);
    const next = current.includes(val)
      ? current.filter(v => v !== val)
      : current.length >= max ? current : [...current, val];

    // Wave 7.9 audit P1 #8: when the record is V4, `styleWords` is the V3
    // mirror of `archetypes`. Mirror writes to BOTH so the V4 canonical
    // field doesn't drift from edits made through this V3-vocab UI. The
    // ChipMulti renders V4 vocab when isV4=true (see render block) so the
    // V3 mirror also ends up holding V4 IDs — that's intentional. Legacy
    // V3 readers (`burs_style_engine`, etc.) read `styleWords` and accept
    // any string; they won't crash on V4 archetype IDs.
    //
    // Codex P1 follow-up on PR #696: existing V4 users may already have
    // stale V3 archetype names ('streetwear', 'scandinavian', 'elegant',
    // 'vintage', 'artsy') in their persisted `styleWords` array from
    // earlier edits before the V4-aware ChipMulti landed. Mirroring `next`
    // raw into `archetypes` would copy those legacy tokens into the V4
    // canonical field, undoing the normalization work in P1 #8. Normalize
    // through `v3ArchetypeToV4` first — passthrough for already-V4 tokens,
    // rename for V3 names with a known mapping, drop unknown tokens
    // entirely (rather than silently corrupt the V4 vocab). The V3 mirror
    // (`styleWords`) keeps the user-facing list (which is V4-vocab on V4
    // records via the ChipMulti render); only the V4 canonical
    // (`archetypes`) gets the strict-vocab guard.
    if (isV4 && field === 'styleWords') {
      const archetypesNormalized: V4ArchetypeId[] = [];
      const seen = new Set<V4ArchetypeId>();
      for (const token of next) {
        if (typeof token !== 'string') continue;
        const v4 = v3ArchetypeToV4(token);
        if (v4 && !seen.has(v4)) {
          seen.add(v4);
          archetypesNormalized.push(v4);
        }
      }
      const newSp: Record<string, unknown> = { ...sp, styleWords: next, archetypes: archetypesNormalized };
      try {
        await updateProfile.mutateAsync({
          preferences: { ...prefs, styleProfile: newSp } as Json,
        });
      } catch { toast.error(t('settings.pref_error')); }
      return;
    }

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

  const toggle = (id: SectionId) => { hapticLight(); setOpenSection(prev => prev === id ? null : id); };

  const hasProfile = !!sp.gender || !!sp.styleWords?.length;

  // ── Section header ──

  const SectionHeader = ({ id, icon: Icon, title, summary }: { id: SectionId; icon: React.ElementType; title: string; summary?: string }) => (
    <CollapsibleTrigger
      onClick={() => toggle(id)}
      className="flex items-center justify-between w-full px-5 py-4 text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] bg-accent/10">
          <Icon className="w-4 h-4 text-accent flex-shrink-0" />
        </span>
        <div className="min-w-0">
          <span className="text-[15px] font-medium text-foreground block">{title}</span>
          {summary && openSection !== id && (
            <span className="text-[12px] text-muted-foreground/60 truncate block mt-0.5 font-body">{summary}</span>
          )}
        </div>
      </div>
      <ChevronDown className={cn('w-4 h-4 text-muted-foreground/50 transition-transform duration-200 flex-shrink-0', openSection === id && 'rotate-180')} />
    </CollapsibleTrigger>
  );

  // ── Select helper ──

  const FieldSelect = ({ label, value, options, onChange }: {
    label: string; value: string | undefined; options: { value: string; label: string }[]; onChange: (v: string) => void;
  }) => (
    <div className="space-y-1.5">
      <Label className="label-editorial text-muted-foreground/60">{label}</Label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-11 text-[13px] font-body border-border/40 bg-background/60 rounded-xl"><SelectValue placeholder="---" /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  // ── Chip multi-select helper ──

  const ChipMulti = ({ field, options, max = 5 }: {
    field: 'styleWords' | 'wardrobeFrustrations' | 'hardestOccasions'; options: string[]; max?: number;
  }) => {
    // Codex P1 round 3 (PR #696): on V4 records, the styleWords chip
    // selected-state must derive from the SAME normalized array the
    // toggle handler uses. Otherwise a chip rendered as 'street'
    // (V4-canonical translation of stored 'streetwear') would show
    // UNSELECTED while click flow treats it as selected — bouncing
    // user intent. For non-styleWords fields and non-V4 records, fall
    // back to raw `sp[field]`.
    const selectedSource: readonly string[] =
      isV4 && field === 'styleWords' && normalizedStyleWordsV4
        ? normalizedStyleWordsV4
        : ((sp[field] as string[]) || []);
    return (
      <div className="flex flex-wrap gap-2">
        {options.map(v => (
          <Chip key={v} selected={selectedSource.includes(v)} onClick={() => { hapticLight(); toggleMulti(field, v, max); }} className="text-xs capitalize font-body rounded-full">
            {t(`q3.opt.${v}`) !== `q3.opt.${v}` ? t(`q3.opt.${v}`) : v.replace(/_/g, ' ')}
          </Chip>
        ))}
      </div>
    );
  };

  // ── Color grid ──

  const ColorGrid = ({ field }: { field: 'favoriteColors' | 'dislikedColors' }) => {
    // Codex P1 round 3 (PR #696): on V4 records, the chip selected-state
    // must derive from the SAME normalized color array the toggle uses.
    // Without this, a profile with `favoriteColors: ['gold']` shows the
    // 'camel' chip (V4 translation) UNSELECTED while toggleColor treats
    // 'camel' as selected — first click REMOVES instead of adds. Same
    // root cause as the styleWords issue handled in ChipMulti above.
    const memoized =
      field === 'favoriteColors' ? normalizedFavoriteColorsV4 : normalizedDislikedColorsV4;
    const selectedSource: readonly string[] =
      isV4 && memoized ? memoized : (sp[field] || []);
    return (
      <div className="flex flex-wrap gap-2">
        {colorOptions.map(color => {
          const selected = selectedSource.includes(color);
          return (
            <Chip key={color} selected={selected} onClick={() => { hapticLight(); toggleColor(field, color); }} className="capitalize text-xs font-body rounded-full">
              <span className="w-3 h-3 rounded-full flex-shrink-0 border border-foreground/10 shadow-sm" style={{ backgroundColor: COLOR_MAP[color] || '#9CA3AF' }} />
              {t(`color.${color}`) !== `color.${color}` ? t(`color.${color}`) : color}
            </Chip>
          );
        })}
      </div>
    );
  };

  return (
    <AppLayout>
      <PageHeader title={t('settings.row.style')} showBack titleClassName="font-display italic" />

      <AnimatedPage className="px-[var(--page-px)] pb-8 pt-5 space-y-4 max-w-lg mx-auto">

        {/* V4 Style DNA header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE }}
          className="text-center space-y-1 pb-1"
        >
          <h2 className="font-display italic text-[1.4rem] text-foreground">{t('settings.style_dna_title') || 'Your Style DNA'}</h2>
          <p className="font-body text-sm text-muted-foreground/70">{t('settings.style_dna_desc') || 'Fine-tune how BURS understands your personal style'}</p>
        </motion.div>

        {!hasProfile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY }}
            className="bg-accent/8 border border-accent/20 rounded-[1.25rem] p-5 text-center space-y-2"
          >
            <Sparkles className="w-5 h-5 text-accent mx-auto" />
            <p className="text-sm text-foreground font-medium">{t('settings.no_profile_title') || 'No style profile yet'}</p>
            <p className="text-xs text-muted-foreground">{t('settings.no_profile_desc') || 'Complete the style quiz during onboarding to personalize your experience.'}</p>
          </motion.div>
        )}

        {/* Body Data */}
        <Collapsible open={openSection === 'body'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="body" icon={Ruler} title={t('settings.body_data')} summary={heightCm ? `${heightCm} cm${weightKg ? ` · ${weightKg} kg` : ''}` : undefined} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-5 pb-5 space-y-3">
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
              <Button onClick={() => { hapticLight(); handleSaveBodyData(); }} disabled={updateProfile.isPending} size="sm" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11 text-xs rounded-full font-body">
                {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : bodySaved ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : null}
                {bodySaved ? t('settings.saved') : t('settings.save_measurements')}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Identity */}
        <Collapsible open={openSection === 'identity'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="identity" icon={User} title={t('q3.s1.title') || 'About you'} summary={[sp.gender, sp.ageRange, sp.climate].filter(Boolean).join(' · ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-5 pb-5 space-y-4">
              <FieldSelect label={t('q3.q1') || 'Gender'} value={displayGender} onChange={v => updateStyleField('gender', v)} options={[
                { value: 'male', label: t('q3.gender.male') || 'Male' },
                { value: 'female', label: t('q3.gender.female') || 'Female' },
                { value: 'nonbinary', label: t('q3.gender.nonbinary') || 'Non-binary' },
                { value: 'prefer_not', label: t('q3.gender.prefer_not') || 'Prefer not to say' },
              ]} />
              <FieldSelect label={t('q3.q2') || 'Age range'} value={sp.ageRange} onChange={v => updateStyleField('ageRange', v)} options={
                // V4 schema added the granular '55-64' / '65+' buckets (Codex
                // round 7 P2 on PR #685); legacy V3 records with '55+' still
                // render with no selection but can be upgraded by re-picking.
                ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map(v => ({ value: v, label: v }))
              } />
              <FieldSelect label={t('q3.q4') || 'Climate'} value={displayClimate} onChange={v => updateStyleField('climate', v)} options={[
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
        <Collapsible open={openSection === 'daily'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="daily" icon={Briefcase} title={t('q3.s2.title') || 'Daily life'} summary={[sp.weekdayLife, sp.workFormality].filter(Boolean).join(' · ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-5 pb-5 space-y-4">
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
        <Collapsible open={openSection === 'style'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="style" icon={Sparkles} title={t('q3.s3.title') || 'Style direction'} summary={sp.styleWords?.slice(0, 3).join(', ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-5 pb-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="label-editorial text-muted-foreground/60">{t('q3.q9') || 'Style words'}</Label>
                <ChipMulti field="styleWords" options={[...archetypeOptions]} />
              </div>
              <div className="space-y-1.5">
                <Label className="label-editorial text-muted-foreground/60">
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
        <Collapsible open={openSection === 'fit'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="fit" icon={Shirt} title={t('q3.s4.title') || 'Fit & silhouette'} summary={[sp.fit, sp.layering].filter(Boolean).join(' · ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-5 pb-5 space-y-4">
              <FieldSelect label={t('q3.q14') || 'Overall fit'} value={displayFit} onChange={v => updateStyleField('fit', v)} options={[
                { value: 'slim', label: t('style.slim') || 'Slim' },
                { value: 'regular', label: t('style.regular') || 'Regular' },
                { value: 'loose', label: t('style.loose') || 'Loose/relaxed' },
                { value: 'oversized', label: t('q3.fit.oversized') || 'Oversized' },
              ]} />
              <FieldSelect label={t('q3.q15') || 'Layering'} value={displayLayering} onChange={v => updateStyleField('layering', v)} options={[
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
        <Collapsible open={openSection === 'colors'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="colors" icon={Palette} title={t('q3.s5.title') || 'Colors & patterns'} summary={sp.favoriteColors?.slice(0, 4).join(', ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-5 pb-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="label-editorial text-muted-foreground/60">{t('settings.favorite_colors')}</Label>
                <ColorGrid field="favoriteColors" />
              </div>
              <div className="space-y-1.5">
                <Label className="label-editorial text-muted-foreground/60">{t('settings.disliked_colors')}</Label>
                <ColorGrid field="dislikedColors" />
              </div>
              <FieldSelect label={t('q3.q21') || 'Palette vibe'} value={displayPaletteVibe} onChange={v => updateStyleField('paletteVibe', v)} options={[
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
        <Collapsible open={openSection === 'philosophy'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="philosophy" icon={Target} title={t('q3.s6.title') || 'Philosophy'} summary={[sp.shoppingMindset, sp.sustainability].filter(Boolean).join(' · ')} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-5 pb-5 space-y-4">
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
                <Label className="label-editorial text-muted-foreground/60">{t('q3.q26') || 'Wardrobe frustrations'}</Label>
                <ChipMulti field="wardrobeFrustrations" options={['nothing_to_wear', 'too_many_clothes', 'outfit_repeating', 'color_matching', 'occasion_dressing', 'fit_issues']} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Inspiration */}
        <Collapsible open={openSection === 'inspiration'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="inspiration" icon={Compass} title={t('q3.s7.title') || 'Inspiration'} summary={sp.fabricFeel || sp.signaturePieces || undefined} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-5 pb-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="label-editorial text-muted-foreground/60">{t('q3.q27') || 'Style icons'}</Label>
                <Input value={sp.styleIcons || ''} onChange={e => updateStyleField('styleIcons', e.target.value)} placeholder={t('q3.q27_hint') || 'e.g. Scandinavian minimalism'} className="h-11 text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="label-editorial text-muted-foreground/60">{t('q3.q28') || 'Hardest occasions'}</Label>
                <ChipMulti field="hardestOccasions" options={['work', 'date_night', 'wedding', 'travel', 'weekend_casual', 'formal_event']} />
              </div>
              <div className="space-y-1.5">
                <Label className="label-editorial text-muted-foreground/60">{t('q3.q29') || 'Favorite fabrics'}</Label>
                <Input value={sp.fabricFeel || ''} onChange={e => updateStyleField('fabricFeel', e.target.value)} placeholder={t('q3.q29_hint') || 'e.g. linen, cashmere'} className="h-11 text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="label-editorial text-muted-foreground/60">{t('q3.q30') || 'Signature pieces'}</Label>
                <Input value={sp.signaturePieces || ''} onChange={e => updateStyleField('signaturePieces', e.target.value)} placeholder={t('q3.q30_hint') || 'e.g. oversized blazer, white sneakers'} className="h-11 text-[13px]" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Goals */}
        <Collapsible open={openSection === 'goals'} className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <SectionHeader id="goals" icon={Heart} title={t('q3.s8.title') || 'Goals'} summary={sp.primaryGoal || undefined} />
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-5 pb-5 space-y-4">
              <FieldSelect label={t('q3.q31') || 'Primary goal with BURS'} value={displayPrimaryGoal} onChange={v => updateStyleField('primaryGoal', v)} options={[
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
                <Label className="label-editorial text-muted-foreground/60">{t('q3.q33') || 'Anything else?'}</Label>
                <Input value={sp.freeNote || ''} onChange={e => updateStyleField('freeNote', e.target.value)} placeholder={t('q3.q33_hint') || 'Any personal style notes...'} className="h-11 text-[13px]" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Read-only style words summary */}
        {sp.styleWords && sp.styleWords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 8 }}
            className="px-1 py-3 space-y-2.5"
          >
            <p className="label-editorial text-muted-foreground/60">
              {t('settings.your_style_words') || 'YOUR STYLE WORDS'}
            </p>
            <div className="flex flex-wrap gap-2">
              {sp.styleWords.map(word => (
                <span
                  key={word}
                  className="bg-secondary/80 px-3.5 py-1.5 font-body text-xs text-foreground capitalize tracking-wide"
                >
                  {word}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Mannequin preference */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION_MEDIUM, ease: EASE_CURVE, delay: STAGGER_DELAY * 9 }}
        >
          <p className="label-editorial text-muted-foreground/60 px-1 mb-2.5">{t('settings.presentation_title') || 'PRESENTATION'}</p>
        <div className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="min-w-0">
              <span className="text-[15px] font-medium text-foreground block">Show garments on mannequin</span>
              <span className="text-[12px] text-muted-foreground/60 block mt-0.5 font-body">Displays a clean ghost mannequin view when available</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!prefs.show_mannequin}
              onClick={async () => {
                hapticLight();
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
        <div className="rounded-[1.25rem] overflow-hidden border border-border/40">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="min-w-0">
              <span className="text-[15px] font-medium text-foreground block">Offer studio renders</span>
              <span className="text-[12px] text-muted-foreground/60 block mt-0.5 font-body">Show the Studio Look prompt after adding a garment</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.showRenderPrompt !== false}
              onClick={async () => {
                hapticLight();
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
        </motion.div>

      </AnimatedPage>
    </AppLayout>
  );
}
