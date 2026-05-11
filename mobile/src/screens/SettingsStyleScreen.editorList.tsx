// SettingsStyleScreen — the 8 Section+Editor pairs (N13 split).
//
// Wraps each per-section Editor in the shared Section shell with the
// matching `open / dirty / summary / onApply` plumbing. Centralising this
// here keeps the orchestrator file focused on draft state + save handlers.

import React from 'react';
import { View } from 'react-native';

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

import type { DirtyMap, SectionId } from './SettingsStyleScreen.helpers';
import { Section } from './SettingsStyleScreen.section';
import {
  ArchetypeEditor,
  DislikedEditor,
  FitsEditor,
  FormalityEditor,
  OccasionsEditor,
  PaletteEditor,
  PatternEditor,
  VibesEditor,
} from './SettingsStyleScreen.editors';

export type StyleEditorListProps = {
  draft: StyleProfileV4;
  dirty: DirtyMap;
  openSection: SectionId | null;
  isPending: boolean;
  onToggleSection: (id: SectionId) => void;
  onApplySection: (id: SectionId) => void;
  onToggleArchetype: (value: ArchetypeId) => void;
  onFormalityFloorChange: (v: number) => void;
  onFormalityCeilingChange: (v: number) => void;
  onToggleFavoriteColor: (value: ColorSwatchId) => void;
  onToggleDislikedColor: (value: ColorSwatchId) => void;
  onSelectFitOverall: (value: FitOverall) => void;
  onToggleOccasion: (value: OccasionId) => void;
  onSelectPaletteVibe: (value: PaletteVibe) => void;
  onSelectPatternComfort: (value: PatternComfort) => void;
};

export function StyleEditorList({
  draft,
  dirty,
  openSection,
  isPending,
  onToggleSection,
  onApplySection,
  onToggleArchetype,
  onFormalityFloorChange,
  onFormalityCeilingChange,
  onToggleFavoriteColor,
  onToggleDislikedColor,
  onSelectFitOverall,
  onToggleOccasion,
  onSelectPaletteVibe,
  onSelectPatternComfort,
}: StyleEditorListProps) {
  return (
    <View style={{ gap: 10 }}>
      <Section
        id="archetype"
        open={openSection === 'archetype'}
        dirty={dirty.archetype}
        isPending={isPending}
        onToggle={() => onToggleSection('archetype')}
        onApply={() => onApplySection('archetype')}
        summary={
          draft.archetypes.length > 0
            ? draft.archetypes
                .map((a) => tr(`onboarding.quizV4.choice.archetypes.${a}`))
                .join(' · ')
            : undefined
        }>
        <ArchetypeEditor selected={draft.archetypes} onToggle={onToggleArchetype} />
      </Section>

      <Section
        id="formality"
        open={openSection === 'formality'}
        dirty={dirty.formality}
        isPending={isPending}
        onToggle={() => onToggleSection('formality')}
        onApply={() => onApplySection('formality')}
        summary={tr('settingsStyle.editor.formality.summaryTemplate', {
          floor: draft.formalityFloor,
          ceiling: draft.formalityCeiling,
        })}>
        <FormalityEditor
          floor={draft.formalityFloor}
          ceiling={draft.formalityCeiling}
          onFloorChange={onFormalityFloorChange}
          onCeilingChange={onFormalityCeilingChange}
        />
      </Section>

      <Section
        id="palette"
        open={openSection === 'palette'}
        dirty={dirty.palette}
        isPending={isPending}
        onToggle={() => onToggleSection('palette')}
        onApply={() => onApplySection('palette')}
        summary={
          draft.favoriteColors.length > 0
            ? tr('settingsStyle.favoritesCountTemplate', {
                count: draft.favoriteColors.length,
              })
            : undefined
        }>
        <PaletteEditor selected={draft.favoriteColors} onToggle={onToggleFavoriteColor} />
      </Section>

      <Section
        id="fits"
        open={openSection === 'fits'}
        dirty={dirty.fits}
        isPending={isPending}
        onToggle={() => onToggleSection('fits')}
        onApply={() => onApplySection('fits')}
        summary={tr(`onboarding.quizV4.choice.fitOverall.${draft.fitOverall}`)}>
        <FitsEditor selected={draft.fitOverall} onSelect={onSelectFitOverall} />
      </Section>

      <Section
        id="occasions"
        open={openSection === 'occasions'}
        dirty={dirty.occasions}
        isPending={isPending}
        onToggle={() => onToggleSection('occasions')}
        onApply={() => onApplySection('occasions')}
        summary={
          draft.occasions.length > 0
            ? draft.occasions
                .map((o) => tr(`onboarding.quizV4.choice.occasion.${o}`))
                .join(' · ')
            : undefined
        }>
        <OccasionsEditor selected={draft.occasions} onToggle={onToggleOccasion} />
      </Section>

      <Section
        id="vibes"
        open={openSection === 'vibes'}
        dirty={dirty.vibes}
        isPending={isPending}
        onToggle={() => onToggleSection('vibes')}
        onApply={() => onApplySection('vibes')}
        summary={tr(`onboarding.quizV4.choice.palette.${draft.paletteVibe}`)}>
        <VibesEditor selected={draft.paletteVibe} onSelect={onSelectPaletteVibe} />
      </Section>

      <Section
        id="pattern"
        open={openSection === 'pattern'}
        dirty={dirty.pattern}
        isPending={isPending}
        onToggle={() => onToggleSection('pattern')}
        onApply={() => onApplySection('pattern')}
        summary={tr(`settingsStyle.editor.pattern.choice.${draft.patternComfort}`)}>
        <PatternEditor selected={draft.patternComfort} onSelect={onSelectPatternComfort} />
      </Section>

      <Section
        id="disliked"
        open={openSection === 'disliked'}
        dirty={dirty.disliked}
        isPending={isPending}
        onToggle={() => onToggleSection('disliked')}
        onApply={() => onApplySection('disliked')}
        summary={
          draft.dislikedColors.length > 0
            ? tr('settingsStyle.editor.disliked.summaryTemplate', {
                count: draft.dislikedColors.length,
              })
            : undefined
        }>
        <DislikedEditor selected={draft.dislikedColors} onToggle={onToggleDislikedColor} />
      </Section>
    </View>
  );
}
