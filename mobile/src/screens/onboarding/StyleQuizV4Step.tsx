// StyleQuizV4Step — full V4 quiz capture for onboarding (M25).
//
// Replaces the minimal `StyleQuizStep` with the 12-question V4 capture
// ported from web's `src/components/onboarding/StyleQuizV4.tsx`. One
// question per page, paginated with progress dots + Continue / Skip /
// Back. Output shape matches the canonical `StyleProfileV4` so it can
// persist verbatim into `profiles.preferences.style_profile_v4_jsonb`.
//
// N13 split — pure helpers, primitives, and per-question bodies live in
// sibling files. This file is the orchestrator: state + animation +
// canAdvance gate + action bar.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';

import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Eyebrow } from '../../components/Eyebrow';
import { hapticLight } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';
import { useTokens } from '../../theme/ThemeProvider';
import { radii } from '../../theme/tokens';

import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  QUIZ_QUESTIONS,
  QUIZ_TOTAL,
  defaultStyleProfileV4,
  type AgeRange,
  type BodyFocus,
  type Budget,
  type Build,
  type CarePreference,
  type Climate,
  type FitOverall,
  type FitTopVsBottom,
  type Gender,
  type Layering,
  type LifestyleMix,
  type PaletteVibe,
  type PatternComfort,
  type PrimaryGoal,
  type ShoppingFrequency,
  type ShoppingStyle,
  type StyleProfileV4,
} from '../../lib/styleProfileV4';

import {
  ARCHETYPE_MAX,
  ARCHETYPE_MIN,
  TOUCHED_DEFAULT,
  type QuizV4Progress,
  type Touched,
} from './StyleQuizV4Step.helpers';
import {
  QArchetypes,
  QClimate,
  QColors,
  QFit,
  QIdentity,
  QLifestyle,
} from './StyleQuizV4Step.questions1';
import {
  QCultural,
  QFabric,
  QFormality,
  QGoal,
  QOccasions,
  QShopping,
} from './StyleQuizV4Step.questions2';

// Re-export shared types so existing imports (`Touched`, `QuizV4Progress`,
// `touchedToCompatTouched`) from this module path keep working.
export type { Touched, QuizV4Progress } from './StyleQuizV4Step.helpers';
export { touchedToCompatTouched } from './StyleQuizV4Step.helpers';

export function StyleQuizV4Step({
  onComplete,
  initial,
  onProgress,
}: {
  onComplete: (profile: StyleProfileV4, touched: Touched) => void;
  /** Resume snapshot — provided by OnboardingScreen when its AsyncStorage
   * draft contains a `quizDraft`. Hydrates qi + answers + touched on mount. */
  initial?: QuizV4Progress;
  /** Fires on every meaningful state change so the parent can persist
   * the mid-quiz progress to its onboarding draft. */
  onProgress?: (state: QuizV4Progress) => void;
}) {
  const t = useTokens();
  const [qi, setQi] = useState<number>(initial?.qi ?? 0);
  const [answers, setAnswers] = useState<StyleProfileV4>(
    initial?.answers ?? defaultStyleProfileV4(),
  );
  const [touched, setTouched] = useState<Touched>(initial?.touched ?? TOUCHED_DEFAULT);

  // Per-update progress emit so OnboardingScreen's draft autopersist
  // captures mid-quiz state. Skipped on the first render when `initial`
  // is the source of truth.
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const progressEmittedRef = useRef(false);
  useEffect(() => {
    if (!progressEmittedRef.current && initial) {
      progressEmittedRef.current = true;
      return;
    }
    progressEmittedRef.current = true;
    onProgressRef.current?.({ qi, answers, touched });
  }, [qi, answers, touched, initial]);

  // Animated cross-fade between questions — opacity + small slide.
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);

  const animateTo = useCallback(
    (next: number, direction: 'fwd' | 'back') => {
      if (animatingRef.current) return;
      animatingRef.current = true;
      Keyboard.dismiss();
      const offset = direction === 'fwd' ? -16 : 16;
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: offset,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          // Animation interrupted — snap values back to identity and bail.
          animatingRef.current = false;
          fade.setValue(1);
          slide.setValue(0);
          return;
        }
        setQi(next);
        slide.setValue(-offset);
        Animated.parallel([
          Animated.timing(fade, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(slide, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(() => {
          animatingRef.current = false;
        });
      });
    },
    [fade, slide],
  );

  const set = useCallback(
    <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => {
      setAnswers((prev) => ({ ...prev, [key]: val }));
    },
    [],
  );

  const setLifestyle = useCallback((field: keyof LifestyleMix, val: number) => {
    setAnswers((prev) => ({
      ...prev,
      lifestyle: { ...prev.lifestyle, [field]: val },
    }));
  }, []);

  // Multi-select toggle helper. `max` caps the array length on add.
  const toggleArray = useCallback(
    <K extends keyof StyleProfileV4>(
      key: K,
      val: string,
      max: number,
    ) => {
      setAnswers((prev) => {
        const list = prev[key];
        if (!Array.isArray(list)) return prev;
        const arr = list as string[];
        if (arr.includes(val)) {
          return { ...prev, [key]: arr.filter((entry) => entry !== val) };
        }
        if (arr.length >= max) return prev;
        return { ...prev, [key]: [...arr, val] };
      });
    },
    [],
  );

  // Per-question advance gate.
  const canAdvance = useMemo((): boolean => {
    const q = QUIZ_QUESTIONS[qi];
    if (!q) return false;
    switch (q.id) {
      case 'identity':
        return (
          touched.gender
          && touched.height_cm
          && answers.height_cm >= HEIGHT_CM_MIN
          && answers.height_cm <= HEIGHT_CM_MAX
          && touched.build
          && touched.ageRange
        );
      case 'archetypes':
        return (
          answers.archetypes.length >= ARCHETYPE_MIN
          && answers.archetypes.length <= ARCHETYPE_MAX
        );
      case 'goal':
        return touched.goal;
      default:
        return true;
    }
  }, [qi, touched, answers]);

  const next = useCallback(() => {
    if (!canAdvance) return;
    hapticLight();
    if (qi < QUIZ_TOTAL - 1) {
      animateTo(qi + 1, 'fwd');
      return;
    }
    onComplete({ ...answers, version: 4 }, touched);
  }, [canAdvance, qi, animateTo, onComplete, answers, touched]);

  const back = useCallback(() => {
    if (qi > 0) {
      hapticLight();
      animateTo(qi - 1, 'back');
    }
  }, [qi, animateTo]);

  const skip = useCallback(() => {
    const q = QUIZ_QUESTIONS[qi];
    if (!q || !q.optional) return;
    hapticLight();
    if (qi < QUIZ_TOTAL - 1) {
      animateTo(qi + 1, 'fwd');
      return;
    }
    onComplete({ ...answers, version: 4 }, touched);
  }, [qi, animateTo, onComplete, answers, touched]);

  // Touch setters keep the canAdvance gate distinct from raw answer mutation.
  const touchGender = (value: Gender) => {
    setTouched((prev) => ({ ...prev, gender: true }));
    set('gender', value);
  };
  const touchBuild = (value: Build) => {
    setTouched((prev) => ({ ...prev, build: true }));
    set('build', value);
  };
  const touchAge = (value: AgeRange) => {
    setTouched((prev) => ({ ...prev, ageRange: true }));
    set('ageRange', value);
  };
  const touchGoal = (value: PrimaryGoal) => {
    setTouched((prev) => ({ ...prev, goal: true }));
    set('primaryGoal', value);
  };
  const touchClimate = (value: Climate) => {
    setTouched((prev) => ({ ...prev, climate: true }));
    set('climate', value);
  };
  const touchPaletteVibe = (value: PaletteVibe) => {
    setTouched((prev) => ({ ...prev, paletteVibe: true }));
    set('paletteVibe', value);
  };
  const touchPatternComfort = (value: PatternComfort) => {
    setTouched((prev) => ({ ...prev, patternComfort: true }));
    set('patternComfort', value);
  };
  const touchFitOverall = (value: FitOverall) => {
    setTouched((prev) => ({ ...prev, fitOverall: true }));
    set('fitOverall', value);
  };
  const touchFitTopVsBottom = (value: FitTopVsBottom) => {
    setTouched((prev) => ({ ...prev, fitTopVsBottom: true }));
    set('fitTopVsBottom', value);
  };
  const touchLayering = (value: Layering) => {
    setTouched((prev) => ({ ...prev, layering: true }));
    set('layering', value);
  };
  const touchBodyFocus = (value: BodyFocus) => {
    setTouched((prev) => ({ ...prev, bodyFocus: true }));
    set('bodyFocus', value);
  };
  const touchCarePreference = (value: CarePreference) => {
    setTouched((prev) => ({ ...prev, carePreference: true }));
    set('carePreference', value);
  };
  const touchShoppingFrequency = (value: ShoppingFrequency) => {
    setTouched((prev) => ({ ...prev, shoppingFrequency: true }));
    set('shoppingFrequency', value);
  };
  const touchBudget = (value: Budget) => {
    setTouched((prev) => ({ ...prev, budget: true }));
    set('budget', value);
  };
  const touchShoppingStyle = (value: ShoppingStyle) => {
    setTouched((prev) => ({ ...prev, shoppingStyle: true }));
    set('shoppingStyle', value);
  };

  // Formality is a slider pair — one touched flag covers both.
  const setFormalityFloor = useCallback(
    (v: number) => {
      setTouched((prev) => ({ ...prev, formality: true }));
      setAnswers((prev) => {
        const clamped = Math.min(v, prev.formalityCeiling);
        return { ...prev, formalityFloor: clamped };
      });
    },
    [],
  );
  const setFormalityCeiling = useCallback(
    (v: number) => {
      setTouched((prev) => ({ ...prev, formality: true }));
      setAnswers((prev) => {
        const clamped = Math.max(v, prev.formalityFloor);
        return { ...prev, formalityCeiling: clamped };
      });
    },
    [],
  );

  const adjustHeight = (delta: number) => {
    setTouched((prev) => ({ ...prev, height_cm: true }));
    const start = answers.height_cm > 0 ? answers.height_cm : 170;
    const nextHeight = Math.max(HEIGHT_CM_MIN, Math.min(HEIGHT_CM_MAX, start + delta));
    set('height_cm', nextHeight);
  };

  const currentQuestion = QUIZ_QUESTIONS[qi];
  const optional = currentQuestion?.optional ?? false;
  const isFinal = qi === QUIZ_TOTAL - 1;
  // Inline hint shown under the Continue button when the gate is failing
  // on a required question (Codex P2).
  const showRequiredHint = !optional && !canAdvance;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Progress + counter */}
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
          {Array.from({ length: QUIZ_TOTAL }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: radii.pill,
                backgroundColor: i <= qi ? t.accent : t.bg2,
              }}
            />
          ))}
        </View>
        <Eyebrow>
          {tr('onboarding.quizV4.progressTemplate', {
            current: qi + 1,
            total: QUIZ_TOTAL,
          })}
        </Eyebrow>
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: fade,
          transform: [{ translateX: slide }],
        }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {currentQuestion?.id === 'identity' && (
            <QIdentity
              answers={answers}
              touched={touched}
              touchGender={touchGender}
              touchBuild={touchBuild}
              touchAge={touchAge}
              adjustHeight={adjustHeight}
            />
          )}
          {currentQuestion?.id === 'lifestyle' && (
            <QLifestyle answers={answers} setLifestyle={setLifestyle} />
          )}
          {currentQuestion?.id === 'climate' && (
            <QClimate answers={answers} set={set} touchClimate={touchClimate} />
          )}
          {currentQuestion?.id === 'archetypes' && (
            <QArchetypes answers={answers} toggleArray={toggleArray} set={set} />
          )}
          {currentQuestion?.id === 'colors' && (
            <QColors
              answers={answers}
              toggleArray={toggleArray}
              touchPaletteVibe={touchPaletteVibe}
              touchPatternComfort={touchPatternComfort}
            />
          )}
          {currentQuestion?.id === 'fit' && (
            <QFit
              answers={answers}
              touchFitOverall={touchFitOverall}
              touchFitTopVsBottom={touchFitTopVsBottom}
              touchLayering={touchLayering}
              touchBodyFocus={touchBodyFocus}
            />
          )}
          {currentQuestion?.id === 'formality' && (
            <QFormality
              answers={answers}
              setFormalityFloor={setFormalityFloor}
              setFormalityCeiling={setFormalityCeiling}
            />
          )}
          {currentQuestion?.id === 'fabric' && (
            <QFabric
              answers={answers}
              toggleArray={toggleArray}
              touchCarePreference={touchCarePreference}
            />
          )}
          {currentQuestion?.id === 'occasions' && (
            <QOccasions answers={answers} toggleArray={toggleArray} />
          )}
          {currentQuestion?.id === 'shopping' && (
            <QShopping
              answers={answers}
              touchShoppingFrequency={touchShoppingFrequency}
              touchBudget={touchBudget}
              touchShoppingStyle={touchShoppingStyle}
            />
          )}
          {currentQuestion?.id === 'goal' && (
            <QGoal answers={answers} touchGoal={touchGoal} />
          )}
          {currentQuestion?.id === 'cultural' && (
            <QCultural answers={answers} set={set} />
          )}
        </ScrollView>
      </Animated.View>

      {/* Action bar */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
          }}>
          {qi > 0 && (
            <Button
              label={tr('onboarding.quizV4.back')}
              variant="outline"
              size="md"
              onPress={back}
            />
          )}
          {optional && (
            <Button
              label={tr('onboarding.quizV4.skip')}
              variant="quiet"
              size="md"
              onPress={skip}
            />
          )}
          <View style={{ flex: 1 }}>
            <Button
              label={
                isFinal
                  ? tr('onboarding.quizV4.complete.cta')
                  : tr('onboarding.quizV4.continue')
              }
              variant="accent"
              block
              onPress={next}
              disabled={!canAdvance}
            />
          </View>
        </View>
        {showRequiredHint && (
          <View style={{ marginTop: 8 }}>
            <Caption>{tr('onboarding.quizV4.requiredHint')}</Caption>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
