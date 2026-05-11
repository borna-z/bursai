// SettingsStyleScreen — the 8 per-section editor bodies (N13 split).
//
// Each editor owns its caption + input grid, wrapped in the shared
// Section shell. The parent provides the draft slice + the toggle/set
// callback for each editor — no editor reads/writes draft state directly.

import React from 'react';
import { View } from 'react-native';

import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { t as tr } from '../lib/i18n';
import {
  ARCHETYPE_OPTIONS,
  OCCASION_OPTIONS,
  type ArchetypeId,
  type ColorSwatchId,
  type FitOverall,
  type OccasionId,
  type PaletteVibe,
  type PatternComfort,
} from '../lib/styleProfileV4';

import {
  ARCHETYPE_MAX,
  ARCHETYPE_MIN,
  DISLIKED_COLORS_MAX,
  FAVORITE_COLORS_MAX,
  FIT_OVERALLS,
  PALETTE_VIBES,
  PATTERN_COMFORTS,
} from './SettingsStyleScreen.helpers';
import { ColorGrid, PercentSlider } from './SettingsStyleScreen.primitives';

const CHIP_GRID_STYLE = {
  flexDirection: 'row' as const,
  flexWrap: 'wrap' as const,
  gap: 8,
  marginTop: 12,
};

// ─── Archetype (multi-select 3-5) ───────────────────────────────────────────

export function ArchetypeEditor({
  selected,
  onToggle,
}: {
  selected: readonly string[];
  onToggle: (value: ArchetypeId) => void;
}) {
  return (
    <>
      <Caption>
        {tr('settingsStyle.editor.archetype.help', {
          min: ARCHETYPE_MIN,
          max: ARCHETYPE_MAX,
        })}
      </Caption>
      <View style={CHIP_GRID_STYLE}>
        {ARCHETYPE_OPTIONS.map((value) => (
          <Chip
            key={value}
            label={tr(`onboarding.quizV4.choice.archetypes.${value}`)}
            active={selected.includes(value)}
            onPress={() => onToggle(value)}
          />
        ))}
      </View>
    </>
  );
}

// ─── Formality range (floor + ceiling sliders) ─────────────────────────────

export function FormalityEditor({
  floor,
  ceiling,
  onFloorChange,
  onCeilingChange,
}: {
  floor: number;
  ceiling: number;
  onFloorChange: (v: number) => void;
  onCeilingChange: (v: number) => void;
}) {
  return (
    <>
      <Caption>{tr('settingsStyle.editor.formality.help')}</Caption>
      <View style={{ gap: 14, marginTop: 12 }}>
        <PercentSlider
          label={tr('settingsStyle.editor.formality.floor')}
          value={floor}
          onChange={onFloorChange}
        />
        <PercentSlider
          label={tr('settingsStyle.editor.formality.ceiling')}
          value={ceiling}
          onChange={onCeilingChange}
        />
      </View>
    </>
  );
}

// ─── Favorite colors (multi-select swatches, max 3) ────────────────────────

export function PaletteEditor({
  selected,
  onToggle,
}: {
  selected: readonly string[];
  onToggle: (id: ColorSwatchId) => void;
}) {
  return (
    <>
      <Caption>
        {tr('settingsStyle.editor.palette.help', { max: FAVORITE_COLORS_MAX })}
      </Caption>
      <ColorGrid selected={selected} onToggle={(id) => onToggle(id as ColorSwatchId)} />
    </>
  );
}

// ─── Fits (single-select) ──────────────────────────────────────────────────

export function FitsEditor({
  selected,
  onSelect,
}: {
  selected: FitOverall;
  onSelect: (value: FitOverall) => void;
}) {
  return (
    <>
      <Caption>{tr('settingsStyle.editor.fits.help')}</Caption>
      <View style={CHIP_GRID_STYLE}>
        {FIT_OVERALLS.map((value) => (
          <Chip
            key={value}
            label={tr(`onboarding.quizV4.choice.fitOverall.${value}`)}
            active={selected === value}
            onPress={() => onSelect(value)}
          />
        ))}
      </View>
    </>
  );
}

// ─── Occasions (multi-select) ──────────────────────────────────────────────

export function OccasionsEditor({
  selected,
  onToggle,
}: {
  selected: readonly string[];
  onToggle: (value: OccasionId) => void;
}) {
  return (
    <>
      <Caption>{tr('settingsStyle.editor.occasions.help')}</Caption>
      <View style={CHIP_GRID_STYLE}>
        {OCCASION_OPTIONS.map((value) => (
          <Chip
            key={value}
            label={tr(`onboarding.quizV4.choice.occasion.${value}`)}
            active={selected.includes(value)}
            onPress={() => onToggle(value)}
          />
        ))}
      </View>
    </>
  );
}

// ─── Vibes (single-select palette tone) ────────────────────────────────────

export function VibesEditor({
  selected,
  onSelect,
}: {
  selected: PaletteVibe;
  onSelect: (value: PaletteVibe) => void;
}) {
  return (
    <>
      <Caption>{tr('settingsStyle.editor.vibes.help')}</Caption>
      <View style={CHIP_GRID_STYLE}>
        {PALETTE_VIBES.map((value) => (
          <Chip
            key={value}
            label={tr(`onboarding.quizV4.choice.palette.${value}`)}
            active={selected === value}
            onPress={() => onSelect(value)}
          />
        ))}
      </View>
    </>
  );
}

// ─── Pattern comfort (single-select) ───────────────────────────────────────

export function PatternEditor({
  selected,
  onSelect,
}: {
  selected: PatternComfort;
  onSelect: (value: PatternComfort) => void;
}) {
  return (
    <>
      <Caption>{tr('settingsStyle.editor.pattern.help')}</Caption>
      <View style={CHIP_GRID_STYLE}>
        {PATTERN_COMFORTS.map((value) => (
          <Chip
            key={value}
            label={tr(`settingsStyle.editor.pattern.choice.${value}`)}
            active={selected === value}
            onPress={() => onSelect(value)}
          />
        ))}
      </View>
    </>
  );
}

// ─── Disliked colors (multi-select swatches, max 3) ────────────────────────

export function DislikedEditor({
  selected,
  onToggle,
}: {
  selected: readonly string[];
  onToggle: (id: ColorSwatchId) => void;
}) {
  return (
    <>
      <Caption>
        {tr('settingsStyle.editor.disliked.help', { max: DISLIKED_COLORS_MAX })}
      </Caption>
      <ColorGrid selected={selected} onToggle={(id) => onToggle(id as ColorSwatchId)} />
    </>
  );
}
