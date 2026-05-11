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
// as sections, but neither is a field on the canonical V4 schema. The
// wave's binding goal — "edits style_profile_v4 JSONB" — takes
// precedence; we substitute patternComfort and dislikedColors so every
// section has a real backing field.
//
// N13 split — Section shell, DNA card, editor primitives, and per-section
// editors live in sibling files. This file is the orchestrator: draft
// state + dirty tracking + save handlers + layout.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { SettingsRow } from '../components/SettingsRow';
import { TypedConfirmModal } from '../components/TypedConfirmModal';
import { BackIcon, RotateIcon, SparklesIcon } from '../components/icons';
import { useResetStyleMemory } from '../hooks/useResetStyleMemory';
import { useStyleDNA } from '../hooks/useStyleDNA';
import { useUpdateStyleProfile } from '../hooks/useUpdateStyleProfile';
import { useAuth } from '../contexts/AuthContext';
import { hapticLight, hapticSelection } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import type {
  ArchetypeId,
  ColorSwatchId,
  FitOverall,
  OccasionId,
  PaletteVibe,
  PatternComfort,
  StyleProfileV4,
} from '../lib/styleProfileV4';
import { clearOnboardingDraft } from './OnboardingScreen';
import type { RootStackParamList } from '../navigation/RootNavigator';

import {
  ARCHETYPE_MAX,
  DISLIKED_COLORS_MAX,
  EMPTY_DIRTY_MAP,
  FAVORITE_COLORS_MAX,
  SECTION_IDS,
  readCurrentV4FromProfile,
  type DirtyMap,
  type SectionId,
} from './SettingsStyleScreen.helpers';
import { DnaSummaryCard } from './SettingsStyleScreen.dnaCard';
import { StyleEditorList } from './SettingsStyleScreen.editorList';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
  const [dirty, setDirty] = useState<DirtyMap>(EMPTY_DIRTY_MAP);

  // Re-seed the draft whenever the persisted profile changes (after a
  // successful save). The dirty map resets in lockstep so the UI doesn't
  // claim there are pending edits after a refresh.
  React.useEffect(() => {
    setDraft(persisted);
    setDirty(EMPTY_DIRTY_MAP);
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
        <DnaSummaryCard dna={dna} />

        {/* ============ EDITOR — 8 SECTIONS ============ */}
        <StyleEditorList
          draft={draft}
          dirty={dirty}
          openSection={openSection}
          isPending={isPending}
          onToggleSection={toggleSection}
          onApplySection={applySection}
          onToggleArchetype={toggleArchetype}
          onFormalityFloorChange={setFormalityFloor}
          onFormalityCeilingChange={setFormalityCeiling}
          onToggleFavoriteColor={toggleFavoriteColor}
          onToggleDislikedColor={toggleDislikedColor}
          onSelectFitOverall={setFitOverall}
          onToggleOccasion={toggleOccasion}
          onSelectPaletteVibe={setPaletteVibe}
          onSelectPatternComfort={setPatternComfort}
        />

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
              // otherwise OnboardingScreen.loadDraft() would resume the
              // user on whatever step they were last on instead of
              // starting at step 0 with empty answers.
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

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
});
