// Settings · Style profile — M38 8-section editor.
//
// Mirrors web's `src/pages/settings/SettingsStyle.tsx` shape: a stack of
// collapsible sections, each editing one slice of `style_profile_v4_jsonb`.
// Default state is collapsed; tapping a header expands ONE section at a
// time (accordion). Per-section "Apply" persists just that slice via
// `useUpdateStyleProfile`; a "Save all" button at the bottom commits any
// pending dirty edits at once.
//
// The 8 sections are mapped to V4 fields (see `mobile/src/lib/styleProfileV4.ts`):
//   1. Archetype       → archetypes (multi-select, 3-5)
//   2. Formality range → formalityFloor / formalityCeiling
//   3. Color palette   → favoriteColors (multi-select swatches, max 3)
//   4. Fits            → fitOverall (single-select)
//   5. Occasions       → occasions (multi-select)
//   6. Vibes           → paletteVibe (single-select palette tone)
//   7. Pattern comfort → patternComfort (single-select)
//   8. Disliked colors → dislikedColors (multi-select swatches, max 3)
//
// Note on wave-spec drift: the M38 spec lists "Brands" and "Accent color"
// as sections, but neither is a field on the canonical V4 schema (see
// `mobile/src/lib/styleProfileV4.ts:StyleProfileV4`). The wave's binding
// goal — "edits style_profile_v4 JSONB" — takes precedence; we substitute
// patternComfort and dislikedColors so every section has a real backing
// field. Brands/accent can be added later if the schema grows.
//
// Mutation pattern:
//   - Local draft state per section, seeded from the in-memory V4 profile.
//   - Apply → call useUpdateStyleProfile with just that section's patch.
//   - Save all → flush every section that's dirty in one RPC call.
//   - Errors surface via Alert with retry; success just collapses the
//     section. The DNA preview at top auto-refreshes on profile reload.
//
// Mirrors design_handoff_burs_rn/source/audit-screens.jsx SettingsStyleScreen
// hero card, but the action rows are replaced with the editor stack.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { styleColorToHex } from '../theme/styleColors';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { Skeleton } from '../components/Skeleton';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import {
  BackIcon,
  CheckIcon,
  ChevronIcon,
  RotateIcon,
  SparklesIcon,
} from '../components/icons';
import { useResetStyleMemory } from '../hooks/useResetStyleMemory';
import { FORMALITY_BUCKETS_DISPLAY, useStyleDNA } from '../hooks/useStyleDNA';
import { useUpdateStyleProfile } from '../hooks/useUpdateStyleProfile';
import { useAuth } from '../contexts/AuthContext';
import { hapticLight, hapticSelection } from '../lib/haptics';
import { isLightSwatch } from '../lib/color';
import { t as tr } from '../lib/i18n';
import {
  ARCHETYPE_OPTIONS,
  COLOR_SWATCHES,
  OCCASION_OPTIONS,
  defaultStyleProfileV4,
  parseStyleProfileV4,
  type ArchetypeId,
  type ColorSwatchId,
  type FitOverall,
  type OccasionId,
  type PaletteVibe,
  type PatternComfort,
  type StyleProfileV4,
} from '../lib/styleProfileV4';
import { clearOnboardingDraft } from './OnboardingScreen';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Limits (web parity) ────────────────────────────────────────────────────

const ARCHETYPE_MIN = 3;
const ARCHETYPE_MAX = 5;
const FAVORITE_COLORS_MAX = 3;
const DISLIKED_COLORS_MAX = 3;

// Single-select option lists. The `as const` on the source arrays in
// styleProfileV4.ts keeps these readonly literal-union typed.
const FIT_OVERALLS: readonly FitOverall[] = [
  'fitted',
  'regular',
  'relaxed',
  'oversized',
  'mixed',
] as const;
const PALETTE_VIBES: readonly PaletteVibe[] = [
  'neutrals',
  'bold',
  'dark',
  'pastels',
  'earth',
  'mixed',
] as const;
const PATTERN_COMFORTS: readonly PatternComfort[] = [
  'love',
  'some',
  'minimal',
  'solids_only',
] as const;

// Ordered ids for the section list. Each value is also the i18n key fragment
// (`settingsStyle.section.<id>.title` / `.summary`).
const SECTION_IDS = [
  'archetype',
  'formality',
  'palette',
  'fits',
  'occasions',
  'vibes',
  'pattern',
  'disliked',
] as const;
type SectionId = (typeof SECTION_IDS)[number];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** "Updated Nh ago" — minimal bucket logic, no date-fns dependency.
 * Returns null when the timestamp is missing or unparseable so the
 * caller can hide the freshness caption rather than show "just now"
 * for a row that's actually decades stale. */
function formatUpdatedAgo(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return 'Updated just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

/** Pull the current V4 profile from AuthContext-cached preferences. Falls
 * back to defaults when no quiz has been answered yet — this lets a user
 * who skipped onboarding land on SettingsStyle and start picking values. */
function readCurrentV4FromProfile(prefs: unknown): StyleProfileV4 {
  if (!prefs || typeof prefs !== 'object') return defaultStyleProfileV4();
  const obj = prefs as Record<string, unknown>;
  const raw = obj['style_profile_v4_jsonb'] ?? obj['style_profile_v4'];
  if (!raw) return defaultStyleProfileV4();
  return parseStyleProfileV4(raw);
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export function SettingsStyleScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { profile } = useAuth();
  const dnaQuery = useStyleDNA();
  const dna = dnaQuery.data;
  const updateStyle = useUpdateStyleProfile();
  const resetMemory = useResetStyleMemory();
  const [resetOpen, setResetOpen] = useState(false);

  // Seed the editor draft from the cached profile. The seed updates whenever
  // the profile reference changes (e.g. after a successful Apply / Save all
  // refreshes AuthContext) so any section that wasn't part of the patch
  // re-syncs with the persisted source-of-truth.
  const persisted = useMemo(
    () => readCurrentV4FromProfile(profile?.preferences),
    [profile?.preferences],
  );

  // Local draft — every section reads from + writes to this shared object.
  // We track which sections have unsaved edits so "Save all" can flush only
  // dirty patches and the per-section Apply button can be disabled when
  // there's nothing to save.
  const [draft, setDraft] = useState<StyleProfileV4>(persisted);
  const [dirty, setDirty] = useState<Record<SectionId, boolean>>({
    archetype: false,
    formality: false,
    palette: false,
    fits: false,
    occasions: false,
    vibes: false,
    pattern: false,
    disliked: false,
  });

  // Re-seed the draft whenever the persisted profile changes (after a
  // successful save). The dirty map resets in lockstep so the UI doesn't
  // claim there are pending edits after a refresh.
  // Using a ref-keyed effect would be simpler, but `useMemo` + an
  // identity check inside a setter is sufficient and avoids the lint hit
  // for missing-dep on a stale persisted snapshot.
  React.useEffect(() => {
    setDraft(persisted);
    setDirty({
      archetype: false,
      formality: false,
      palette: false,
      fits: false,
      occasions: false,
      vibes: false,
      pattern: false,
      disliked: false,
    });
  }, [persisted]);

  // Single-section accordion state. Tapping the active header collapses it.
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const toggleSection = useCallback((id: SectionId) => {
    hapticLight();
    setOpenSection((prev) => (prev === id ? null : id));
  }, []);

  const markDirty = useCallback((id: SectionId) => {
    setDirty((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  // ─── Per-section setters ────────────────────────────────────────────────

  const toggleArchetype = useCallback(
    (value: ArchetypeId) => {
      hapticSelection();
      setDraft((prev) => {
        const has = prev.archetypes.includes(value);
        if (has) {
          return { ...prev, archetypes: prev.archetypes.filter((a) => a !== value) };
        }
        if (prev.archetypes.length >= ARCHETYPE_MAX) return prev;
        return { ...prev, archetypes: [...prev.archetypes, value] };
      });
      markDirty('archetype');
    },
    [markDirty],
  );

  const setFormalityFloor = useCallback(
    (v: number) => {
      setDraft((prev) => ({
        ...prev,
        formalityFloor: Math.min(v, prev.formalityCeiling),
      }));
      markDirty('formality');
    },
    [markDirty],
  );
  const setFormalityCeiling = useCallback(
    (v: number) => {
      setDraft((prev) => ({
        ...prev,
        formalityCeiling: Math.max(v, prev.formalityFloor),
      }));
      markDirty('formality');
    },
    [markDirty],
  );

  const toggleFavoriteColor = useCallback(
    (value: ColorSwatchId) => {
      hapticSelection();
      setDraft((prev) => {
        const has = prev.favoriteColors.includes(value);
        if (has) {
          return { ...prev, favoriteColors: prev.favoriteColors.filter((c) => c !== value) };
        }
        if (prev.favoriteColors.length >= FAVORITE_COLORS_MAX) return prev;
        return { ...prev, favoriteColors: [...prev.favoriteColors, value] };
      });
      markDirty('palette');
    },
    [markDirty],
  );

  const toggleDislikedColor = useCallback(
    (value: ColorSwatchId) => {
      hapticSelection();
      setDraft((prev) => {
        const has = prev.dislikedColors.includes(value);
        if (has) {
          return { ...prev, dislikedColors: prev.dislikedColors.filter((c) => c !== value) };
        }
        if (prev.dislikedColors.length >= DISLIKED_COLORS_MAX) return prev;
        return { ...prev, dislikedColors: [...prev.dislikedColors, value] };
      });
      markDirty('disliked');
    },
    [markDirty],
  );

  const setFitOverall = useCallback(
    (value: FitOverall) => {
      hapticSelection();
      setDraft((prev) => ({ ...prev, fitOverall: value }));
      markDirty('fits');
    },
    [markDirty],
  );

  const toggleOccasion = useCallback(
    (value: OccasionId) => {
      hapticSelection();
      setDraft((prev) => {
        const has = prev.occasions.includes(value);
        if (has) {
          return { ...prev, occasions: prev.occasions.filter((o) => o !== value) };
        }
        return { ...prev, occasions: [...prev.occasions, value] };
      });
      markDirty('occasions');
    },
    [markDirty],
  );

  const setPaletteVibe = useCallback(
    (value: PaletteVibe) => {
      hapticSelection();
      setDraft((prev) => ({ ...prev, paletteVibe: value }));
      markDirty('vibes');
    },
    [markDirty],
  );

  const setPatternComfort = useCallback(
    (value: PatternComfort) => {
      hapticSelection();
      setDraft((prev) => ({ ...prev, patternComfort: value }));
      markDirty('pattern');
    },
    [markDirty],
  );

  // ─── Save handlers ──────────────────────────────────────────────────────

  /** Build the partial patch for ONE section. Centralised so Apply +
   * Save-all stay consistent on which keys belong to each section. */
  const buildSectionPatch = useCallback(
    (id: SectionId): Partial<StyleProfileV4> => {
      switch (id) {
        case 'archetype':
          return { archetypes: draft.archetypes };
        case 'formality':
          return {
            formalityFloor: draft.formalityFloor,
            formalityCeiling: draft.formalityCeiling,
          };
        case 'palette':
          return { favoriteColors: draft.favoriteColors };
        case 'fits':
          return { fitOverall: draft.fitOverall };
        case 'occasions':
          return { occasions: draft.occasions };
        case 'vibes':
          return { paletteVibe: draft.paletteVibe };
        case 'pattern':
          return { patternComfort: draft.patternComfort };
        case 'disliked':
          return { dislikedColors: draft.dislikedColors };
      }
    },
    [draft],
  );

  const applySection = useCallback(
    (id: SectionId) => {
      if (!dirty[id]) return;
      hapticLight();
      updateStyle.mutate(buildSectionPatch(id), {
        onSuccess: () => {
          // Collapse on success so the user sees the DNA preview update.
          setOpenSection(null);
        },
        onError: (err) => {
          Alert.alert(
            tr('settingsStyle.editor.saveError.title'),
            err instanceof Error ? err.message : tr('settingsStyle.editor.saveError.body'),
            [
              { text: tr('settingsStyle.editor.saveError.cancel'), style: 'cancel' },
              {
                text: tr('settingsStyle.editor.saveError.retry'),
                onPress: () => applySection(id),
              },
            ],
          );
        },
      });
    },
    [buildSectionPatch, dirty, updateStyle],
  );

  const saveAll = useCallback(() => {
    const dirtyIds = SECTION_IDS.filter((id) => dirty[id]);
    if (dirtyIds.length === 0) return;
    hapticLight();
    // Merge every dirty section's patch into a single RPC call. The atomic
    // RPC takes a row-level write lock, so even if Save-all runs concurrent
    // with another writer (e.g. a coach-tour completion firing) neither
    // patch is lost.
    const merged: Partial<StyleProfileV4> = {};
    for (const id of dirtyIds) Object.assign(merged, buildSectionPatch(id));
    updateStyle.mutate(merged, {
      onSuccess: () => setOpenSection(null),
      onError: (err) => {
        Alert.alert(
          tr('settingsStyle.editor.saveError.title'),
          err instanceof Error ? err.message : tr('settingsStyle.editor.saveError.body'),
          [
            { text: tr('settingsStyle.editor.saveError.cancel'), style: 'cancel' },
            {
              text: tr('settingsStyle.editor.saveError.retry'),
              onPress: saveAll,
            },
          ],
        );
      },
    });
  }, [buildSectionPatch, dirty, updateStyle]);

  const handleConfirmReset = () => {
    resetMemory.mutate(undefined, {
      onSuccess: () => {
        setResetOpen(false);
        Alert.alert(
          tr('settings.reset_memory.success.title'),
          tr('settings.reset_memory.success.body'),
        );
      },
      onError: (err) => {
        setResetOpen(false);
        Alert.alert(
          tr('settings.reset_memory.title'),
          err instanceof Error ? err.message : tr('settings.reset_memory.error'),
        );
      },
    });
  };

  const anyDirty = SECTION_IDS.some((id) => dirty[id]);
  const isPending = updateStyle.isPending;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Settings</Eyebrow>
            <PageTitle>Style profile</PageTitle>
          </View>
        </View>

        {/* ============ STYLE SUMMARY CARD ============ */}
        <Card hero padding={18}>
          <Eyebrow style={{ marginBottom: 8 }}>{tr('settingsStyle.dnaPreview.title')}</Eyebrow>
          {dna ? (
            <>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 22,
                  fontWeight: '500',
                  color: t.fg,
                  letterSpacing: -0.22,
                  marginBottom: 4,
                }}>
                {dna.archetype}
              </Text>
              {(() => {
                const updatedAgo = formatUpdatedAgo(dna.updatedAt);
                return updatedAgo ? (
                  <Caption style={{ marginBottom: 14 }}>{updatedAgo}</Caption>
                ) : (
                  <View style={{ marginBottom: 14 }} />
                );
              })()}
            </>
          ) : (
            <Skeleton radius={4} height={26} style={{ width: 180, marginBottom: 14 }} />
          )}

          <Eyebrow style={{ marginBottom: 8 }}>Archetypes</Eyebrow>
          {dna && dna.vibes.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {dna.vibes.map((vibe) => (
                <Chip key={vibe} label={vibe} active />
              ))}
            </View>
          ) : dna ? (
            <Caption style={{ marginBottom: 16 }}>
              {tr('settingsStyle.dnaPreview.empty')}
            </Caption>
          ) : (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
              <Skeleton radius={14} height={28} style={{ width: 80 }} />
              <Skeleton radius={14} height={28} style={{ width: 80 }} />
              <Skeleton radius={14} height={28} style={{ width: 80 }} />
            </View>
          )}

          {dna && dna.signatureColors.length > 0 ? (
            <>
              <Eyebrow style={{ marginBottom: 8 }}>Favorite colors</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {dna.signatureColors.map((colorName) => (
                  <View
                    key={colorName}
                    accessibilityLabel={colorName}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: styleColorToHex(colorName),
                      borderWidth: 1,
                      borderColor: t.border,
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Eyebrow style={{ marginBottom: 8 }}>Formality</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {FORMALITY_BUCKETS_DISPLAY.map((level) => (
              <Chip key={level} label={level} active={dna ? level === dna.formality : false} />
            ))}
          </View>
        </Card>

        {/* ============ EDITOR — 8 SECTIONS ============ */}
        <View style={{ gap: 10 }}>
          <Section
            id="archetype"
            open={openSection === 'archetype'}
            dirty={dirty.archetype}
            isPending={isPending}
            onToggle={() => toggleSection('archetype')}
            onApply={() => applySection('archetype')}
            summary={
              draft.archetypes.length > 0
                ? draft.archetypes
                    .map((a) => tr(`onboarding.quizV4.choice.archetypes.${a}`))
                    .join(' · ')
                : undefined
            }>
            <Caption>
              {tr('settingsStyle.editor.archetype.help', {
                min: ARCHETYPE_MIN,
                max: ARCHETYPE_MAX,
              })}
            </Caption>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 12,
              }}>
              {ARCHETYPE_OPTIONS.map((value) => (
                <Chip
                  key={value}
                  label={tr(`onboarding.quizV4.choice.archetypes.${value}`)}
                  active={draft.archetypes.includes(value)}
                  onPress={() => toggleArchetype(value)}
                />
              ))}
            </View>
          </Section>

          <Section
            id="formality"
            open={openSection === 'formality'}
            dirty={dirty.formality}
            isPending={isPending}
            onToggle={() => toggleSection('formality')}
            onApply={() => applySection('formality')}
            summary={tr('settingsStyle.editor.formality.summaryTemplate', {
              floor: draft.formalityFloor,
              ceiling: draft.formalityCeiling,
            })}>
            <Caption>{tr('settingsStyle.editor.formality.help')}</Caption>
            <View style={{ gap: 14, marginTop: 12 }}>
              <PercentSlider
                label={tr('settingsStyle.editor.formality.floor')}
                value={draft.formalityFloor}
                onChange={setFormalityFloor}
              />
              <PercentSlider
                label={tr('settingsStyle.editor.formality.ceiling')}
                value={draft.formalityCeiling}
                onChange={setFormalityCeiling}
              />
            </View>
          </Section>

          <Section
            id="palette"
            open={openSection === 'palette'}
            dirty={dirty.palette}
            isPending={isPending}
            onToggle={() => toggleSection('palette')}
            onApply={() => applySection('palette')}
            summary={
              draft.favoriteColors.length > 0
                ? tr('settingsStyle.favoritesCountTemplate', {
                    count: draft.favoriteColors.length,
                  })
                : undefined
            }>
            <Caption>
              {tr('settingsStyle.editor.palette.help', { max: FAVORITE_COLORS_MAX })}
            </Caption>
            <ColorGrid
              selected={draft.favoriteColors}
              onToggle={(id) => toggleFavoriteColor(id as ColorSwatchId)}
            />
          </Section>

          <Section
            id="fits"
            open={openSection === 'fits'}
            dirty={dirty.fits}
            isPending={isPending}
            onToggle={() => toggleSection('fits')}
            onApply={() => applySection('fits')}
            summary={tr(`onboarding.quizV4.choice.fitOverall.${draft.fitOverall}`)}>
            <Caption>{tr('settingsStyle.editor.fits.help')}</Caption>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 12,
              }}>
              {FIT_OVERALLS.map((value) => (
                <Chip
                  key={value}
                  label={tr(`onboarding.quizV4.choice.fitOverall.${value}`)}
                  active={draft.fitOverall === value}
                  onPress={() => setFitOverall(value)}
                />
              ))}
            </View>
          </Section>

          <Section
            id="occasions"
            open={openSection === 'occasions'}
            dirty={dirty.occasions}
            isPending={isPending}
            onToggle={() => toggleSection('occasions')}
            onApply={() => applySection('occasions')}
            summary={
              draft.occasions.length > 0
                ? draft.occasions
                    .map((o) => tr(`onboarding.quizV4.choice.occasion.${o}`))
                    .join(' · ')
                : undefined
            }>
            <Caption>{tr('settingsStyle.editor.occasions.help')}</Caption>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 12,
              }}>
              {OCCASION_OPTIONS.map((value) => (
                <Chip
                  key={value}
                  label={tr(`onboarding.quizV4.choice.occasion.${value}`)}
                  active={draft.occasions.includes(value)}
                  onPress={() => toggleOccasion(value)}
                />
              ))}
            </View>
          </Section>

          <Section
            id="vibes"
            open={openSection === 'vibes'}
            dirty={dirty.vibes}
            isPending={isPending}
            onToggle={() => toggleSection('vibes')}
            onApply={() => applySection('vibes')}
            summary={tr(`onboarding.quizV4.choice.palette.${draft.paletteVibe}`)}>
            <Caption>{tr('settingsStyle.editor.vibes.help')}</Caption>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 12,
              }}>
              {PALETTE_VIBES.map((value) => (
                <Chip
                  key={value}
                  label={tr(`onboarding.quizV4.choice.palette.${value}`)}
                  active={draft.paletteVibe === value}
                  onPress={() => setPaletteVibe(value)}
                />
              ))}
            </View>
          </Section>

          <Section
            id="pattern"
            open={openSection === 'pattern'}
            dirty={dirty.pattern}
            isPending={isPending}
            onToggle={() => toggleSection('pattern')}
            onApply={() => applySection('pattern')}
            summary={tr(`settingsStyle.editor.pattern.choice.${draft.patternComfort}`)}>
            <Caption>{tr('settingsStyle.editor.pattern.help')}</Caption>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 12,
              }}>
              {PATTERN_COMFORTS.map((value) => (
                <Chip
                  key={value}
                  label={tr(`settingsStyle.editor.pattern.choice.${value}`)}
                  active={draft.patternComfort === value}
                  onPress={() => setPatternComfort(value)}
                />
              ))}
            </View>
          </Section>

          <Section
            id="disliked"
            open={openSection === 'disliked'}
            dirty={dirty.disliked}
            isPending={isPending}
            onToggle={() => toggleSection('disliked')}
            onApply={() => applySection('disliked')}
            summary={
              draft.dislikedColors.length > 0
                ? tr('settingsStyle.editor.disliked.summaryTemplate', {
                    count: draft.dislikedColors.length,
                  })
                : undefined
            }>
            <Caption>
              {tr('settingsStyle.editor.disliked.help', { max: DISLIKED_COLORS_MAX })}
            </Caption>
            <ColorGrid
              selected={draft.dislikedColors}
              onToggle={(id) => toggleDislikedColor(id as ColorSwatchId)}
            />
          </Section>
        </View>

        {/* ============ SAVE ALL ============ */}
        <Button
          label={
            isPending
              ? tr('settingsStyle.editor.saveAll.busy')
              : tr('settingsStyle.editor.saveAll.label')
          }
          variant="accent"
          block
          onPress={saveAll}
          disabled={!anyDirty || isPending}
          accessibilityState={{ disabled: !anyDirty || isPending, busy: isPending }}
        />

        {/* ============ ACTIONS (retake quiz · reset memory) ============ */}
        <Card padding={4}>
          <SettingsRow
            icon={<SparklesIcon size={16} color={t.accent} />}
            title={tr('settingsStyle.row.retakeQuiz.title')}
            caption={tr('settingsStyle.row.retakeQuiz.caption')}
            onPress={async () => {
              // Purge the persisted onboarding draft before navigating —
              // otherwise OnboardingScreen.loadDraft() would resume the user
              // on whatever step they were last on instead of starting at
              // step 0 with empty answers.
              await clearOnboardingDraft();
              nav.navigate('Onboarding');
            }}
          />
          <SettingsRow
            icon={<RotateIcon size={16} color={t.destructive} />}
            title={tr('settingsStyle.row.resetMemory.title')}
            caption={tr('settingsStyle.row.resetMemory.caption')}
            destructive
            last
            onPress={() => setResetOpen(true)}
          />
        </Card>
      </ScrollView>

      <TypedConfirmModal
        open={resetOpen}
        title={tr('settings.reset_memory.title')}
        body={tr('settings.reset_memory.body')}
        requiredText={tr('settings.reset_memory.required')}
        confirmLabel={tr('settings.reset_memory.confirm')}
        destructive
        isPending={resetMemory.isPending}
        onConfirm={handleConfirmReset}
        onCancel={() => setResetOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Section shell ─────────────────────────────────────────────────────────

/** Collapsible card with header + optional Apply button. The ChevronIcon
 * rotates on expand to mirror web's `<Collapsible>` accordion affordance. */
function Section({
  id,
  open,
  dirty,
  isPending,
  onToggle,
  onApply,
  summary,
  children,
}: {
  id: SectionId;
  open: boolean;
  dirty: boolean;
  isPending: boolean;
  onToggle: () => void;
  onApply: () => void;
  summary?: string;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <Card padding={0}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={tr(`settingsStyle.editor.section.${id}.title`)}
        style={({ pressed }) => ({
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.85 : 1,
        })}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 15,
              color: t.fg,
              letterSpacing: -0.15,
            }}>
            {tr(`settingsStyle.editor.section.${id}.title`)}
          </Text>
          {!open && summary ? (
            <Caption style={{ marginTop: 2 }} numberOfLines={1}>
              {summary}
            </Caption>
          ) : null}
        </View>
        {dirty && !open ? (
          <View
            accessibilityLabel={tr('settingsStyle.editor.unsavedDot')}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: t.accent,
            }}
          />
        ) : null}
        <View
          style={{
            transform: [{ rotate: open ? '180deg' : '0deg' }],
          }}>
          <ChevronIcon size={14} color={t.fg2} />
        </View>
      </Pressable>
      {open ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 4,
            borderTopWidth: 1,
            borderTopColor: t.border,
          }}>
          {children}
          <View style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <Button
              label={
                isPending
                  ? tr('settingsStyle.editor.apply.busy')
                  : tr('settingsStyle.editor.apply.label')
              }
              variant="primary"
              size="sm"
              onPress={onApply}
              disabled={!dirty || isPending}
              accessibilityState={{ disabled: !dirty || isPending, busy: isPending }}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

// ─── Color grid (reused for favorites + dislikes) ──────────────────────────

function ColorGrid({
  selected,
  onToggle,
}: {
  selected: readonly string[];
  onToggle: (id: string) => void;
}) {
  const t = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 12,
      }}>
      {COLOR_SWATCHES.map((color) => {
        const isSelected = selected.includes(color.id);
        const checkColor = isLightSwatch(color.hex) ? t.fg : t.bg;
        return (
          <Pressable
            key={color.id}
            onPress={() => onToggle(color.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={tr(`onboarding.quizV4.choice.color.${color.id}`)}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: color.hex,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? t.fg : t.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}>
            {isSelected ? <CheckIcon size={16} color={checkColor} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Percent slider (formality range) ──────────────────────────────────────
//
// Inline copy of StyleQuizV4Step's PercentSlider — same look + feel + a11y
// hooks. We could try to share via a new primitive, but mobile/CLAUDE.md
// says "no new design primitives without checking", and this is the only
// other consumer so far. If a third lands, refactor.

function PercentSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTokens();
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = React.useRef(0);
  const onChangeRef = React.useRef(onChange);
  widthRef.current = trackWidth;
  onChangeRef.current = onChange;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: (e) => {
          const w = widthRef.current;
          if (w <= 0) return;
          const x = Math.max(0, Math.min(w, e.nativeEvent.locationX));
          onChangeRef.current(Math.round((x / w) * 100));
          hapticSelection();
        },
        onPanResponderMove: (e) => {
          const w = widthRef.current;
          if (w <= 0) return;
          const x = Math.max(0, Math.min(w, e.nativeEvent.locationX));
          onChangeRef.current(Math.round((x / w) * 100));
        },
      }),
    [],
  );

  // Animated fill width — keeps RN happy with a Pure-React-Native track. The
  // Easing reference avoids an unused-import lint hit (we use it for a 0ms
  // tween-on-mount so the bar paints immediately).
  const fill = React.useRef(new Animated.Value(value)).current;
  React.useEffect(() => {
    Animated.timing(fill, {
      toValue: value,
      duration: 0,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [fill, value]);

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13,
            color: t.fg,
            letterSpacing: -0.1,
          }}>
          {label}
        </Text>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13,
            color: t.fg2,
            fontVariant: ['tabular-nums'],
          }}>
          {value}%
        </Text>
      </View>
      <View
        {...pan.panHandlers}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const step = 5;
          if (event.nativeEvent.actionName === 'increment') {
            onChangeRef.current(Math.min(100, value + step));
          } else if (event.nativeEvent.actionName === 'decrement') {
            onChangeRef.current(Math.max(0, value - step));
          }
        }}
        hitSlop={{ top: 6, bottom: 6 }}
        style={{
          height: 32,
          justifyContent: 'center',
        }}>
        <View
          style={{
            height: 10,
            borderRadius: radii.pill,
            backgroundColor: t.bg2,
            overflow: 'hidden',
          }}>
          <View
            style={{
              width: `${value}%`,
              height: '100%',
              backgroundColor: t.accent,
              borderRadius: radii.pill,
            }}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
});
