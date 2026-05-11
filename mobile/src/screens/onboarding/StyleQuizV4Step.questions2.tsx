// StyleQuizV4Step — Q7-Q12 question bodies (N13 split).
//
// Formality, Fabric, Occasions, Shopping, Goal, Cultural. State lives
// in the parent (StyleQuizV4Step).

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chip } from '../../components/Chip';
import { Eyebrow } from '../../components/Eyebrow';
import { hapticSelection } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';
import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import {
  FABRIC_OPTIONS,
  FABRIC_SENSITIVITY_OPTIONS,
  OCCASION_OPTIONS,
  type Budget,
  type CarePreference,
  type PrimaryGoal,
  type ShoppingFrequency,
  type ShoppingStyle,
  type StyleProfileV4,
} from '../../lib/styleProfileV4';

import {
  BUDGETS,
  CARE_PREFS,
  FABRIC_PREFERRED_MAX,
  PRIMARY_GOALS,
  SHOPPING_FREQS,
  SHOPPING_STYLES,
} from './StyleQuizV4Step.helpers';
import { ChipRow, FreeTextInput, PercentSlider, QHeader } from './StyleQuizV4Step.primitives';

// ─── Q7 — Formality range ──────────────────────────────────────────────────

export function QFormality({
  answers,
  setFormalityFloor,
  setFormalityCeiling,
}: {
  answers: StyleProfileV4;
  setFormalityFloor: (v: number) => void;
  setFormalityCeiling: (v: number) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="formality" />
      <PercentSlider
        label={tr('onboarding.quizV4.q.formality.floor')}
        value={answers.formalityFloor}
        onChange={setFormalityFloor}
      />
      <PercentSlider
        label={tr('onboarding.quizV4.q.formality.ceiling')}
        value={answers.formalityCeiling}
        onChange={setFormalityCeiling}
      />
    </View>
  );
}

// ─── Q8 — Fabric & feel ────────────────────────────────────────────────────

export function QFabric({
  answers,
  toggleArray,
  touchCarePreference,
}: {
  answers: StyleProfileV4;
  toggleArray: <K extends keyof StyleProfileV4>(key: K, val: string, max: number) => void;
  touchCarePreference: (value: CarePreference) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="fabric" />

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.fabric.preferred')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FABRIC_OPTIONS.map((value) => (
            <Chip
              key={value}
              label={tr(`onboarding.quizV4.choice.fabric.${value}`)}
              active={answers.fabricPreferred.includes(value)}
              onPress={() => {
                hapticSelection();
                toggleArray('fabricPreferred', value, FABRIC_PREFERRED_MAX);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('onboarding.quizV4.q.fabric.sensitivities')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FABRIC_SENSITIVITY_OPTIONS.map((value) => (
            <Chip
              key={value}
              label={tr(`onboarding.quizV4.choice.fabricSensitivity.${value}`)}
              active={answers.fabricSensitivities.includes(value)}
              onPress={() => {
                hapticSelection();
                toggleArray('fabricSensitivities', value, FABRIC_SENSITIVITY_OPTIONS.length);
              }}
            />
          ))}
        </View>
      </View>

      <ChipRow
        eyebrowKey="onboarding.quizV4.q.fabric.care"
        choiceNamespace="care"
        options={CARE_PREFS}
        active={answers.carePreference}
        onPick={touchCarePreference}
      />
    </View>
  );
}

// ─── Q9 — Occasions ────────────────────────────────────────────────────────

export function QOccasions({
  answers,
  toggleArray,
}: {
  answers: StyleProfileV4;
  toggleArray: <K extends keyof StyleProfileV4>(key: K, val: string, max: number) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="occasions" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {OCCASION_OPTIONS.map((value) => (
          <Chip
            key={value}
            label={tr(`onboarding.quizV4.choice.occasion.${value}`)}
            active={answers.occasions.includes(value)}
            onPress={() => {
              hapticSelection();
              toggleArray('occasions', value, OCCASION_OPTIONS.length);
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Q10 — Shopping ────────────────────────────────────────────────────────

export function QShopping({
  answers,
  touchShoppingFrequency,
  touchBudget,
  touchShoppingStyle,
}: {
  answers: StyleProfileV4;
  touchShoppingFrequency: (value: ShoppingFrequency) => void;
  touchBudget: (value: Budget) => void;
  touchShoppingStyle: (value: ShoppingStyle) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="shopping" />

      <ChipRow
        eyebrowKey="onboarding.quizV4.q.shopping.frequency"
        choiceNamespace="shoppingFrequency"
        options={SHOPPING_FREQS}
        active={answers.shoppingFrequency}
        onPick={touchShoppingFrequency}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.shopping.budget"
        choiceNamespace="budget"
        options={BUDGETS}
        active={answers.budget}
        onPick={touchBudget}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.shopping.style"
        choiceNamespace="shoppingStyle"
        options={SHOPPING_STYLES}
        active={answers.shoppingStyle}
        onPick={touchShoppingStyle}
      />
    </View>
  );
}

// ─── Q11 — Primary goal ────────────────────────────────────────────────────

export function QGoal({
  answers,
  touchGoal,
}: {
  answers: StyleProfileV4;
  touchGoal: (value: PrimaryGoal) => void;
}) {
  const t = useTokens();
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="goal" />
      <View style={{ gap: 10 }}>
        {PRIMARY_GOALS.map((value) => {
          const active = answers.primaryGoal === value;
          return (
            <Pressable
              key={value}
              onPress={() => {
                hapticSelection();
                touchGoal(value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: radii.lg,
                backgroundColor: active ? t.accentSoft : t.card,
                borderWidth: active ? 2 : 1,
                borderColor: active ? t.accent : t.border,
                opacity: pressed ? 0.92 : 1,
              })}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 14,
                  color: t.fg,
                  letterSpacing: -0.13,
                }}>
                {tr(`onboarding.quizV4.choice.goal.${value}.label`)}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: fonts.uiMed,
                  fontSize: 12,
                  color: t.fg2,
                  lineHeight: 16,
                }}>
                {tr(`onboarding.quizV4.choice.goal.${value}.caption`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Q12 — Cultural / accessibility ────────────────────────────────────────

export function QCultural({
  answers,
  set,
}: {
  answers: StyleProfileV4;
  set: <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="cultural" />
      <FreeTextInput
        value={answers.cultural ?? ''}
        onChangeText={(v) => set('cultural', v)}
        placeholder={tr('onboarding.quizV4.q.cultural.placeholder')}
        multiline
      />
    </View>
  );
}
