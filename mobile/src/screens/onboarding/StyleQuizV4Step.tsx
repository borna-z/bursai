// StyleQuizV4Step — full V4 quiz capture for onboarding (M25).
//
// Replaces the minimal `StyleQuizStep` with the 12-question V4 capture ported
// from web's `src/components/onboarding/StyleQuizV4.tsx`. One question per
// page, paginated with progress dots + Continue / Skip / Back. Output shape
// matches the canonical `StyleProfileV4` so it can persist verbatim into
// `profiles.preferences.style_profile_v4_jsonb`.
//
// Patterns (mobile/CLAUDE.md):
//  - Reuses Eyebrow / PageTitle / Caption / Chip / Button primitives.
//  - All copy via `t(...)` from `../../lib/i18n` — zero hardcoded strings.
//  - useTokens() for colors — no hardcoded hex.
//  - Renders inside an animated ScrollView with KeyboardAvoidingView for the
//    free-text inputs (city, style icons, cultural notes).

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Chip } from '../../components/Chip';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { CheckIcon, MinusIcon, PlusIcon } from '../../components/icons';
import { hapticLight, hapticSelection } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';
import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';

import {
  ARCHETYPE_OPTIONS,
  COLOR_SWATCHES,
  FABRIC_OPTIONS,
  FABRIC_SENSITIVITY_OPTIONS,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  OCCASION_OPTIONS,
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

// ─── Per-question option lists (mirror web vocab) ───────────────────────────

const GENDERS: readonly Gender[] = ['feminine', 'masculine', 'neutral', 'prefer_not'];
const BUILDS: readonly Build[] = ['slim', 'athletic', 'curvy', 'fuller', 'prefer_not'];
const AGE_RANGES: readonly AgeRange[] = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const CLIMATES: readonly Climate[] = [
  'nordic',
  'temperate',
  'mediterranean',
  'tropical',
  'desert',
  'varies',
];
const PALETTE_VIBES: readonly PaletteVibe[] = [
  'neutrals',
  'bold',
  'dark',
  'pastels',
  'earth',
  'mixed',
];
const PATTERN_COMFORTS: readonly PatternComfort[] = ['love', 'some', 'minimal', 'solids_only'];
const FIT_OVERALLS: readonly FitOverall[] = ['fitted', 'regular', 'relaxed', 'oversized', 'mixed'];
const FIT_TOP_VS_BOTTOMS: readonly FitTopVsBottom[] = [
  'same',
  'fitted_top_loose_bottom',
  'loose_top_fitted_bottom',
  'mixed',
];
const LAYERINGS: readonly Layering[] = ['minimal', 'some', 'love'];
const BODY_FOCUSES: readonly BodyFocus[] = ['shoulders', 'waist', 'legs', 'none'];
const CARE_PREFS: readonly CarePreference[] = ['easy_care', 'mixed', 'high_maintenance_ok'];
const SHOPPING_FREQS: readonly ShoppingFrequency[] = ['rare', 'seasonal', 'monthly', 'frequent'];
const BUDGETS: readonly Budget[] = ['budget', 'mid', 'premium', 'luxury', 'mixed'];
const SHOPPING_STYLES: readonly ShoppingStyle[] = ['planned', 'impulse', 'mixed'];
const PRIMARY_GOALS: readonly PrimaryGoal[] = [
  'reduce_decisions',
  'discover_style',
  'curate_capsule',
  'special_events',
  'professional_polish',
  'sustainability',
  'fun_experimenting',
];

const ARCHETYPE_MIN = 3;
const ARCHETYPE_MAX = 5;
const FAVORITE_COLORS_MAX = 3;
const DISLIKED_COLORS_MAX = 3;
const FABRIC_PREFERRED_MAX = 3;

interface Touched {
  gender: boolean;
  build: boolean;
  ageRange: boolean;
  goal: boolean;
}

const TOUCHED_DEFAULT: Touched = {
  gender: false,
  build: false,
  ageRange: false,
  goal: false,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function StyleQuizV4Step({
  onComplete,
}: {
  onComplete: (profile: StyleProfileV4) => void;
}) {
  const t = useTokens();
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<StyleProfileV4>(defaultStyleProfileV4());
  const [touched, setTouched] = useState<Touched>(TOUCHED_DEFAULT);

  // Animated cross-fade between questions — opacity + small slide. Mirrors
  // the M0 StyleQuizStep transition for visual continuity.
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
          animatingRef.current = false;
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

  // Per-question advance gate. Required questions block progression until the
  // user has explicitly answered; optional questions always advance.
  const canAdvance = useMemo((): boolean => {
    const q = QUIZ_QUESTIONS[qi];
    if (!q) return false;
    switch (q.id) {
      case 'identity':
        return (
          touched.gender
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
    onComplete({ ...answers, version: 4 });
  }, [canAdvance, qi, animateTo, onComplete, answers]);

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
    onComplete({ ...answers, version: 4 });
  }, [qi, animateTo, onComplete, answers]);

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

  const adjustHeight = (delta: number) => {
    const start = answers.height_cm > 0 ? answers.height_cm : 170;
    const next = Math.max(HEIGHT_CM_MIN, Math.min(HEIGHT_CM_MAX, start + delta));
    set('height_cm', next);
  };

  const currentQuestion = QUIZ_QUESTIONS[qi];
  const optional = currentQuestion?.optional ?? false;
  const isFinal = qi === QUIZ_TOTAL - 1;

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
            <QClimate answers={answers} set={set} />
          )}
          {currentQuestion?.id === 'archetypes' && (
            <QArchetypes answers={answers} toggleArray={toggleArray} set={set} />
          )}
          {currentQuestion?.id === 'colors' && (
            <QColors answers={answers} toggleArray={toggleArray} set={set} />
          )}
          {currentQuestion?.id === 'fit' && (
            <QFit answers={answers} set={set} />
          )}
          {currentQuestion?.id === 'formality' && (
            <QFormality answers={answers} set={set} />
          )}
          {currentQuestion?.id === 'fabric' && (
            <QFabric answers={answers} toggleArray={toggleArray} set={set} />
          )}
          {currentQuestion?.id === 'occasions' && (
            <QOccasions answers={answers} toggleArray={toggleArray} />
          )}
          {currentQuestion?.id === 'shopping' && (
            <QShopping answers={answers} set={set} />
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
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
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
    </KeyboardAvoidingView>
  );
}

// ─── Question wrappers ──────────────────────────────────────────────────────

function QHeader({ id }: { id: string }) {
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <PageTitle>{tr(`onboarding.quizV4.q.${id}.prompt`)}</PageTitle>
      <Caption>{tr(`onboarding.quizV4.q.${id}.help`)}</Caption>
    </View>
  );
}

// ─── Q1 — Identity & body ──────────────────────────────────────────────────

function QIdentity({
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

function HeightStepper({
  children,
  onPress,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: radii.pill,
        backgroundColor: t.bg2,
        borderWidth: 1,
        borderColor: t.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}>
      {children}
    </Pressable>
  );
}

// ─── Q2 — Lifestyle mix ────────────────────────────────────────────────────

const LIFESTYLE_KEYS: readonly (keyof LifestyleMix)[] = [
  'work',
  'social',
  'casual',
  'sport',
  'evening',
] as const;

function QLifestyle({
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
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
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

// ─── Q3 — Climate & location ───────────────────────────────────────────────

function QClimate({
  answers,
  set,
}: {
  answers: StyleProfileV4;
  set: <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => void;
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
                set('climate', value);
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

function FreeTextInput({
  value,
  onChangeText,
  placeholder,
  multiline,
  textColor,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  textColor?: string;
}) {
  const t = useTokens();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.fg3}
      multiline={multiline}
      autoCapitalize={multiline ? 'sentences' : 'words'}
      autoCorrect={!!multiline}
      returnKeyType={multiline ? 'default' : 'done'}
      onSubmitEditing={() => {
        if (!multiline) Keyboard.dismiss();
      }}
      style={{
        minHeight: multiline ? 120 : 48,
        paddingHorizontal: 16,
        paddingVertical: multiline ? 12 : 0,
        borderRadius: radii.lg,
        backgroundColor: t.card,
        borderWidth: 1,
        borderColor: t.border,
        fontFamily: fonts.uiMed,
        fontSize: 14.5,
        color: textColor ?? t.fg,
        letterSpacing: -0.15,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

// ─── Q4 — Archetypes + style icons ─────────────────────────────────────────

function QArchetypes({
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

function QColors({
  answers,
  toggleArray,
  set,
}: {
  answers: StyleProfileV4;
  toggleArray: <K extends keyof StyleProfileV4>(key: K, val: string, max: number) => void;
  set: <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => void;
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
                set('paletteVibe', value);
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
                set('patternComfort', value);
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function ColorGrid({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {COLOR_SWATCHES.map((color) => {
        const isSelected = selected.includes(color.id);
        const lightSwatch = color.id === 'white' || color.id === 'cream' || color.id === 'beige';
        const checkColor = lightSwatch ? t.fg : t.bg;
        return (
          <Pressable
            key={color.id}
            onPress={() => {
              hapticSelection();
              onToggle(color.id);
            }}
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

// ─── Q6 — Fit & silhouette ─────────────────────────────────────────────────

function QFit({
  answers,
  set,
}: {
  answers: StyleProfileV4;
  set: <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="fit" />

      <ChipRow
        eyebrowKey="onboarding.quizV4.q.fit.overall"
        choiceNamespace="fitOverall"
        options={FIT_OVERALLS}
        active={answers.fitOverall}
        onPick={(v) => set('fitOverall', v)}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.fit.topVsBottom"
        choiceNamespace="fitTopVsBottom"
        options={FIT_TOP_VS_BOTTOMS}
        active={answers.fitTopVsBottom}
        onPick={(v) => set('fitTopVsBottom', v)}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.fit.layering"
        choiceNamespace="layering"
        options={LAYERINGS}
        active={answers.layering}
        onPick={(v) => set('layering', v)}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.fit.bodyFocus"
        choiceNamespace="bodyFocus"
        options={BODY_FOCUSES}
        active={answers.bodyFocus}
        onPick={(v) => set('bodyFocus', v)}
      />
    </View>
  );
}

// Generic single-select chip row used by Q6 / Q8 / Q10.
function ChipRow<T extends string>({
  eyebrowKey,
  choiceNamespace,
  options,
  active,
  onPick,
}: {
  eyebrowKey: string;
  choiceNamespace: string;
  options: readonly T[];
  active: T;
  onPick: (value: T) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Eyebrow>{tr(eyebrowKey)}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((value) => (
          <Chip
            key={value}
            label={tr(`onboarding.quizV4.choice.${choiceNamespace}.${value}`)}
            active={active === value}
            onPress={() => {
              hapticSelection();
              onPick(value);
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Q7 — Formality range ──────────────────────────────────────────────────

function QFormality({
  answers,
  set,
}: {
  answers: StyleProfileV4;
  set: <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="formality" />
      <PercentSlider
        label={tr('onboarding.quizV4.q.formality.floor')}
        value={answers.formalityFloor}
        onChange={(v) => set('formalityFloor', v)}
      />
      <PercentSlider
        label={tr('onboarding.quizV4.q.formality.ceiling')}
        value={answers.formalityCeiling}
        onChange={(v) => set('formalityCeiling', v)}
      />
    </View>
  );
}

// ─── Q8 — Fabric & feel ────────────────────────────────────────────────────

function QFabric({
  answers,
  toggleArray,
  set,
}: {
  answers: StyleProfileV4;
  toggleArray: <K extends keyof StyleProfileV4>(key: K, val: string, max: number) => void;
  set: <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => void;
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
        onPick={(v) => set('carePreference', v)}
      />
    </View>
  );
}

// ─── Q9 — Occasions ────────────────────────────────────────────────────────

function QOccasions({
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

function QShopping({
  answers,
  set,
}: {
  answers: StyleProfileV4;
  set: <K extends keyof StyleProfileV4>(key: K, val: StyleProfileV4[K]) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <QHeader id="shopping" />

      <ChipRow
        eyebrowKey="onboarding.quizV4.q.shopping.frequency"
        choiceNamespace="shoppingFrequency"
        options={SHOPPING_FREQS}
        active={answers.shoppingFrequency}
        onPick={(v) => set('shoppingFrequency', v)}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.shopping.budget"
        choiceNamespace="budget"
        options={BUDGETS}
        active={answers.budget}
        onPick={(v) => set('budget', v)}
      />
      <ChipRow
        eyebrowKey="onboarding.quizV4.q.shopping.style"
        choiceNamespace="shoppingStyle"
        options={SHOPPING_STYLES}
        active={answers.shoppingStyle}
        onPick={(v) => set('shoppingStyle', v)}
      />
    </View>
  );
}

// ─── Q11 — Primary goal ────────────────────────────────────────────────────

function QGoal({
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

function QCultural({
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
