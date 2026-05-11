// StyleQuizV4Step — Q1-Q6 question bodies (N13 split).
//
// Identity, Lifestyle mix, Climate, Archetypes, Colors, Fit. State lives
// in the parent (StyleQuizV4Step); these are presentational + plumb
// touch handlers back via callbacks.

import React from 'react';
import { Text, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { Eyebrow } from '../../components/Eyebrow';
import { Caption } from '../../components/Caption';
import { MinusIcon, PlusIcon } from '../../components/icons';
import { hapticSelection } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';
import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import {
  ARCHETYPE_OPTIONS,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  type AgeRange,
  type BodyFocus,
  type Build,
  type Climate,
  type FitOverall,
  type FitTopVsBottom,
  type Gender,
  type Layering,
  type LifestyleMix,
  type PaletteVibe,
  type PatternComfort,
  type StyleProfileV4,
} from '../../lib/styleProfileV4';

import {
  AGE_RANGES,
  ARCHETYPE_MAX,
  ARCHETYPE_MIN,
  BODY_FOCUSES,
  BUILDS,
  CLIMATES,
  DISLIKED_COLORS_MAX,
  FAVORITE_COLORS_MAX,
  FIT_OVERALLS,
  FIT_TOP_VS_BOTTOMS,
  GENDERS,
  LAYERINGS,
  LIFESTYLE_KEYS,
  PALETTE_VIBES,
  PATTERN_COMFORTS,
  type Touched,
} from './StyleQuizV4Step.helpers';
import {
  ChipRow,
  ColorGrid,
  FreeTextInput,
  HeightStepper,
  PercentSlider,
  QHeader,
} from './StyleQuizV4Step.primitives';

// ─── Q1 — Identity & body ──────────────────────────────────────────────────

export function QIdentity({
  answers,
  touched,
  touchGender,
  touchBuild,
  touchAge,
  adjustHeight,
}: {
  answers: StyleProfileV4;
  touched: Touched;
  touchGender: (value: Gender) => void;
  touchBuild: (value: Build) => void;
  touchAge: (value: AgeRange) => void;
  adjustHeight: (delta: number) => void;
}) {
  const t = useTokens();
  const heightDisplay = answers.height_cm > 0 ? answers.height_cm : 170;
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="identity" />

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.identity.gender')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GENDERS.map((value) => (
            <Chip
              key={value}
              label={tr(`onboarding.quizV4.choice.gender.${value}`)}
              active={touched.gender && answers.gender === value}
              onPress={() => {
                hapticSelection();
                touchGender(value);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.identity.height')}</Eyebrow>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            height: 72,
            borderRadius: radii.lg,
            backgroundColor: t.card,
            borderWidth: 1,
            borderColor: t.border,
          }}>
          <HeightStepper
            disabled={heightDisplay <= HEIGHT_CM_MIN}
            label={tr('onboarding.quizV4.q.identity.heightDecrease')}
            onPress={() => {
              hapticSelection();
              adjustHeight(-1);
            }}>
            <MinusIcon size={18} color={t.fg} />
          </HeightStepper>
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 30,
                color: t.fg,
                letterSpacing: -0.3,
                fontWeight: '500',
              }}>
              {heightDisplay}
            </Text>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 10,
                color: t.fg2,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginTop: 2,
              }}>
              {tr('onboarding.quizV4.q.identity.cm')}
            </Text>
          </View>
          <HeightStepper
            disabled={heightDisplay >= HEIGHT_CM_MAX}
            label={tr('onboarding.quizV4.q.identity.heightIncrease')}
            onPress={() => {
              hapticSelection();
              adjustHeight(1);
            }}>
            <PlusIcon size={18} color={t.fg} />
          </HeightStepper>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.identity.build')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {BUILDS.map((value) => (
            <Chip
              key={value}
              label={tr(`onboarding.quizV4.choice.build.${value}`)}
              active={touched.build && answers.build === value}
              onPress={() => {
                hapticSelection();
                touchBuild(value);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.identity.ageRange')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AGE_RANGES.map((value) => (
            <Chip
              key={value}
              label={tr(`onboarding.quizV4.choice.ageRange.${value}`)}
              active={touched.ageRange && answers.ageRange === value}
              onPress={() => {
                hapticSelection();
                touchAge(value);
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Q2 — Lifestyle mix ────────────────────────────────────────────────────

export function QLifestyle({
  answers,
  setLifestyle,
}: {
  answers: StyleProfileV4;
  setLifestyle: (field: keyof LifestyleMix, val: number) => void;
}) {
  const total =
    answers.lifestyle.work
    + answers.lifestyle.social
    + answers.lifestyle.casual
    + answers.lifestyle.sport
    + answers.lifestyle.evening;
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="lifestyle" />
      <View style={{ gap: 14 }}>
        {LIFESTYLE_KEYS.map((key) => (
          <PercentSlider
            key={key}
            label={tr(`onboarding.quizV4.choice.lifestyle.${key}`)}
            value={answers.lifestyle[key]}
            onChange={(v) => setLifestyle(key, v)}
          />
        ))}
      </View>
      <Caption>
        {tr('onboarding.quizV4.q.lifestyle.total', { total: Math.round(total) })}
      </Caption>
    </View>
  );
}

// ─── Q3 — Climate & location ───────────────────────────────────────────────

export function QClimate({
  answers,
  set,
  touchClimate,
}: {
  answers: StyleProfileV4;
  set: <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => void;
  touchClimate: (value: Climate) => void;
}) {
  const t = useTokens();
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="climate" />

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.climate.homeCity')}</Eyebrow>
        <FreeTextInput
          value={answers.homeCity ?? ''}
          onChangeText={(v) => set('homeCity', v)}
          placeholder={tr('onboarding.quizV4.q.climate.homeCityPlaceholder')}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.climate.climate')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CLIMATES.map((value) => (
            <Chip
              key={value}
              label={tr(`onboarding.quizV4.choice.climate.${value}`)}
              active={answers.climate === value}
              onPress={() => {
                hapticSelection();
                touchClimate(value);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.climate.secondaryCity')}</Eyebrow>
        <FreeTextInput
          value={answers.secondaryCity ?? ''}
          onChangeText={(v) => set('secondaryCity', v)}
          placeholder={tr('onboarding.quizV4.q.climate.secondaryCityPlaceholder')}
          textColor={t.fg}
        />
      </View>
    </View>
  );
}

// ─── Q4 — Archetypes + style icons ─────────────────────────────────────────

export function QArchetypes({
  answers,
  toggleArray,
  set,
}: {
  answers: StyleProfileV4;
  toggleArray: <K extends keyof StyleProfileV4>(key: K, val: string, max: number) => void;
  set: <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => void;
}) {
  const t = useTokens();
  const count = answers.archetypes.length;
  const eyebrowKey =
    count >= ARCHETYPE_MIN
      ? 'onboarding.quizV4.q.archetypes.selected'
      : 'onboarding.quizV4.q.archetypes.range';
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="archetypes" />

      <View style={{ gap: 10 }}>
        <Eyebrow style={{ color: count >= ARCHETYPE_MIN ? t.accent : t.fg2 }}>
          {tr(eyebrowKey, { count, min: ARCHETYPE_MIN, max: ARCHETYPE_MAX })}
        </Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ARCHETYPE_OPTIONS.map((value) => (
            <Chip
              key={value}
              label={tr(`onboarding.quizV4.choice.archetypes.${value}`)}
              active={answers.archetypes.includes(value)}
              onPress={() => {
                hapticSelection();
                toggleArray('archetypes', value, ARCHETYPE_MAX);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.archetypes.icons')}</Eyebrow>
        <FreeTextInput
          value={answers.styleIcons ?? ''}
          onChangeText={(v) => set('styleIcons', v)}
          placeholder={tr('onboarding.quizV4.q.archetypes.iconsPlaceholder')}
        />
      </View>
    </View>
  );
}

// ─── Q5 — Colors ───────────────────────────────────────────────────────────

export function QColors({
  answers,
  toggleArray,
  touchPaletteVibe,
  touchPatternComfort,
}: {
  answers: StyleProfileV4;
  toggleArray: <K extends keyof StyleProfileV4>(key: K, val: string, max: number) => void;
  touchPaletteVibe: (value: PaletteVibe) => void;
  touchPatternComfort: (value: PatternComfort) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="colors" />

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.colors.favorites')}</Eyebrow>
        <ColorGrid
          selected={answers.favoriteColors}
          onToggle={(id) => toggleArray('favoriteColors', id, FAVORITE_COLORS_MAX)}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.colors.disliked')}</Eyebrow>
        <ColorGrid
          selected={answers.dislikedColors}
          onToggle={(id) => toggleArray('dislikedColors', id, DISLIKED_COLORS_MAX)}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.colors.palette')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PALETTE_VIBES.map((value) => (
            <Chip
              key={value}
              label={tr(`onboarding.quizV4.choice.palette.${value}`)}
              active={answers.paletteVibe === value}
              onPress={() => {
                hapticSelection();
                touchPaletteVibe(value);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.colors.pattern')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PATTERN_COMFORTS.map((value) => (
            <Chip
              key={value}
              label={tr(`onboarding.quizV4.choice.pattern.${value}`)}
              active={answers.patternComfort === value}
              onPress={() => {
                hapticSelection();
                touchPatternComfort(value);
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Q6 — Fit & silhouette ─────────────────────────────────────────────────

export function QFit({
  answers,
  touchFitOverall,
  touchFitTopVsBottom,
  touchLayering,
  touchBodyFocus,
}: {
  answers: StyleProfileV4;
  touchFitOverall: (value: FitOverall) => void;
  touchFitTopVsBottom: (value: FitTopVsBottom) => void;
  touchLayering: (value: Layering) => void;
  touchBodyFocus: (value: BodyFocus) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="fit" />

      <ChipRow
        eyebrowKey="onboarding.quizV4.q.fit.overall"
        choiceNamespace="fitOverall"
        options={FIT_OVERALLS}
        active={answers.fitOverall}
        onPick={touchFitOverall}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.fit.topVsBottom"
        choiceNamespace="fitTopVsBottom"
        options={FIT_TOP_VS_BOTTOMS}
        active={answers.fitTopVsBottom}
        onPick={touchFitTopVsBottom}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.fit.layering"
        choiceNamespace="layering"
        options={LAYERINGS}
        active={answers.layering}
        onPick={touchLayering}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.fit.bodyFocus"
        choiceNamespace="bodyFocus"
        options={BODY_FOCUSES}
        active={answers.bodyFocus}
        onPick={touchBodyFocus}
      />
    </View>
  );
}
