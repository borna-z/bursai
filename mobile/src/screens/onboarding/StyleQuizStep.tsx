// StyleQuizStep — onboarding step 3.
// 5 questions, one per "page", animated transition between pages.
// KeyboardAvoidingView wraps the screen for Q3's city input.
//
// State shape mirrors a flat-ish version of the V4 styleProfile schema in the web
// app — keeping the field names aligned makes the future server-write trivial.

import React, { useMemo, useRef, useState } from 'react';
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

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Caption } from '../../components/Caption';
import { Button } from '../../components/Button';
import { CheckIcon, MinusIcon, PlusIcon, SparklesIcon } from '../../components/icons';
import { t as tr } from '../../lib/i18n';
import { hapticLight, hapticSelection } from '../../lib/haptics';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Gender = 'woman' | 'man' | 'nonbinary' | 'undisclosed';
export type Climate = 'hot' | 'warm' | 'mild' | 'cold' | 'variable';
export type Archetype =
  | 'minimal' | 'classic' | 'romantic' | 'street' | 'bohemian' | 'preppy'
  | 'elegant' | 'edgy' | 'coastal' | 'sporty' | 'avantgarde' | 'workwear';
export type Goal = 'fasterDressing' | 'discoverCombos' | 'shopSmarter' | 'capsuleWardrobe';

export type LifestyleMix = {
  work: number;
  social: number;
  active: number;
  home: number;
  travel: number;
};

export type StyleQuizAnswers = {
  gender: Gender;
  heightCm: number;
  lifestyle: LifestyleMix;
  climates: Climate[];
  city: string;
  archetypes: Archetype[];
  goal: Goal;
};

const HEIGHT_MIN = 140;
const HEIGHT_MAX = 210;
const HEIGHT_STEP = 1;
const HEIGHT_DEFAULT = 170;

const ARCHETYPE_MIN = 3;
const ARCHETYPE_MAX = 5;

const DEFAULT_ANSWERS: StyleQuizAnswers = {
  gender: 'undisclosed',
  heightCm: HEIGHT_DEFAULT,
  lifestyle: { work: 30, social: 20, active: 15, home: 25, travel: 10 },
  climates: [],
  city: '',
  archetypes: [],
  goal: 'fasterDressing',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function StyleQuizStep({
  onComplete,
}: {
  onComplete: (answers: StyleQuizAnswers) => void;
}) {
  const [q, setQ] = useState(0);
  const [answers, setAnswers] = useState<StyleQuizAnswers>(DEFAULT_ANSWERS);
  const [genderTouched, setGenderTouched] = useState(false);
  // Q5 needs an explicit-tap gate symmetric with Q1's `genderTouched` so a
  // user can't accidentally Finish on the pre-selected default goal. (P1-5.)
  const [goalTouched, setGoalTouched] = useState(false);

  // Animated transition between questions — opacity + small slide.
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  // Concurrency guard — rapid Next/Back taps would otherwise interleave the
  // two-phase animation chains and leave fade stuck at 0 (P0-1 from review).
  const animatingRef = useRef(false);

  const animateTo = (next: number, direction: 'fwd' | 'back') => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    Keyboard.dismiss();
    const offset = direction === 'fwd' ? -16 : 16;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slide, { toValue: offset, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) {
        animatingRef.current = false;
        return;
      }
      setQ(next);
      slide.setValue(-offset);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(() => { animatingRef.current = false; });
    });
  };

  const next = () => {
    hapticLight();
    if (q < 4) animateTo(q + 1, 'fwd');
    else onComplete(answers);
  };
  const back = () => {
    if (q > 0) {
      hapticLight();
      animateTo(q - 1, 'back');
    }
  };

  const canAdvance = useMemo(() => {
    switch (q) {
      case 0: return genderTouched && answers.heightCm >= HEIGHT_MIN && answers.heightCm <= HEIGHT_MAX;
      case 1: return Math.abs(sumLifestyle(answers.lifestyle) - 100) < 0.5;
      case 2: return answers.climates.length > 0 && answers.city.trim().length > 0;
      case 3: return answers.archetypes.length >= ARCHETYPE_MIN && answers.archetypes.length <= ARCHETYPE_MAX;
      case 4: return goalTouched;
      default: return false;
    }
  }, [q, genderTouched, goalTouched, answers]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <Eyebrow>{tr('quiz.questionCounter', { q: q + 1, total: 5 })}</Eyebrow>
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
          {q === 0 && (
            <Q1
              answers={answers}
              setAnswers={setAnswers}
              onGenderPick={() => setGenderTouched(true)}
            />
          )}
          {q === 1 && <Q2 answers={answers} setAnswers={setAnswers} />}
          {q === 2 && <Q3 answers={answers} setAnswers={setAnswers} />}
          {q === 3 && <Q4 answers={answers} setAnswers={setAnswers} />}
          {q === 4 && (
            <Q5
              answers={answers}
              setAnswers={setAnswers}
              onGoalPick={() => setGoalTouched(true)}
            />
          )}
        </ScrollView>
      </Animated.View>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
        }}>
        {/* Hide Back entirely at q=0 instead of showing a disabled control. (P2-22) */}
        {q > 0 && (
          <Button
            label={tr('quiz.cta.back')}
            variant="outline"
            size="md"
            onPress={back}
          />
        )}
        <View style={{ flex: 1 }}>
          <Button
            label={q < 4 ? tr('quiz.cta.next') : tr('quiz.cta.finish')}
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

function sumLifestyle(l: LifestyleMix): number {
  return l.work + l.social + l.active + l.home + l.travel;
}

// ─── Q1 — Gender + height ───────────────────────────────────────────────────

const GENDERS: readonly { id: Gender; labelKey: string }[] = [
  { id: 'woman',       labelKey: 'quiz.q1.gender.woman' },
  { id: 'man',         labelKey: 'quiz.q1.gender.man' },
  { id: 'nonbinary',   labelKey: 'quiz.q1.gender.nonbinary' },
  { id: 'undisclosed', labelKey: 'quiz.q1.gender.undisclosed' },
];

function Q1({
  answers,
  setAnswers,
  onGenderPick,
}: {
  answers: StyleQuizAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<StyleQuizAnswers>>;
  onGenderPick: () => void;
}) {
  const t = useTokens();
  const adjust = (delta: number) =>
    setAnswers((a) => ({
      ...a,
      heightCm: Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, a.heightCm + delta)),
    }));

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <PageTitle>{tr('quiz.q1.title')}</PageTitle>
        <Caption>{tr('quiz.q1.body')}</Caption>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('quiz.q1.gender.label')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GENDERS.map((g) => {
            const active = answers.gender === g.id;
            return (
              <Pressable
                key={g.id}
                onPress={() => {
                  hapticSelection();
                  setAnswers((a) => ({ ...a, gender: g.id }));
                  onGenderPick();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  flexBasis: '48%',
                  flexGrow: 1,
                  height: 64,
                  paddingHorizontal: 16,
                  borderRadius: radii.lg,
                  backgroundColor: active ? t.accentSoft : t.card,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? t.accent : t.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.92 : 1,
                })}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 13.5,
                    color: t.fg,
                    letterSpacing: -0.13,
                    textAlign: 'center',
                  }}>
                  {tr(g.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('quiz.q1.height.label')}</Eyebrow>
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
          <Stepper
            label={tr('quiz.q1.height.decrease')}
            disabled={answers.heightCm <= HEIGHT_MIN}
            onPress={() => { hapticSelection(); adjust(-HEIGHT_STEP); }}>
            <MinusIcon size={18} color={t.fg} />
          </Stepper>
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
              {answers.heightCm}
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
              {tr('quiz.q1.height.cm')}
            </Text>
          </View>
          <Stepper
            label={tr('quiz.q1.height.increase')}
            disabled={answers.heightCm >= HEIGHT_MAX}
            onPress={() => { hapticSelection(); adjust(HEIGHT_STEP); }}>
            <PlusIcon size={18} color={t.fg} />
          </Stepper>
        </View>
      </View>
    </View>
  );
}

function Stepper({
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

// ─── Q2 — Lifestyle mix ──────────────────────────────────────────────────────

const LIFESTYLE_KEYS = ['work', 'social', 'active', 'home', 'travel'] as const;
const LIFESTYLE_LABEL_KEYS: Record<keyof LifestyleMix, string> = {
  work:   'quiz.q2.label.work',
  social: 'quiz.q2.label.social',
  active: 'quiz.q2.label.active',
  home:   'quiz.q2.label.home',
  travel: 'quiz.q2.label.travel',
};

function Q2({
  answers,
  setAnswers,
}: {
  answers: StyleQuizAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<StyleQuizAnswers>>;
}) {
  const t = useTokens();
  const total = sumLifestyle(answers.lifestyle);
  const totalOk = Math.abs(total - 100) < 0.5;

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <PageTitle>{tr('quiz.q2.title')}</PageTitle>
        <Caption>{tr('quiz.q2.body')}</Caption>
      </View>

      <View style={{ gap: 14 }}>
        {LIFESTYLE_KEYS.map((key) => (
          <LifestyleRow
            key={key}
            label={tr(LIFESTYLE_LABEL_KEYS[key])}
            value={answers.lifestyle[key]}
            onChange={(v) =>
              setAnswers((a) => ({ ...a, lifestyle: rebalance(a.lifestyle, key, v) }))
            }
          />
        ))}
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 4,
          marginTop: 4,
        }}>
        <Eyebrow>{tr('quiz.q2.total')}</Eyebrow>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 22,
            color: totalOk ? t.accent : t.fg2,
            letterSpacing: -0.2,
            fontVariant: ['tabular-nums'],
          }}>
          {Math.round(total)}%
        </Text>
      </View>
    </View>
  );
}

// rebalance — clamp the new value, then scale the OTHER 4 buckets so total stays 100.
function rebalance(mix: LifestyleMix, key: keyof LifestyleMix, raw: number): LifestyleMix {
  const v = Math.max(0, Math.min(100, raw));
  const others = LIFESTYLE_KEYS.filter((k) => k !== key) as (keyof LifestyleMix)[];
  const otherSum = others.reduce((acc, k) => acc + mix[k], 0);
  const target = 100 - v;
  const next: LifestyleMix = { ...mix, [key]: v };
  if (otherSum <= 0) {
    // Distribute equally across the 4 others.
    const each = target / others.length;
    others.forEach((k) => { next[k] = each; });
  } else {
    others.forEach((k) => { next[k] = (mix[k] / otherSum) * target; });
  }
  // Round to integers and absorb rounding error into the largest bucket so total === 100.
  let total = 0;
  let largestKey: keyof LifestyleMix = others[0];
  let largestVal = -Infinity;
  for (const k of LIFESTYLE_KEYS) {
    next[k] = Math.round(next[k]);
    total += next[k];
    if (k !== key && next[k] > largestVal) {
      largestVal = next[k];
      largestKey = k;
    }
  }
  next[largestKey] = Math.max(0, next[largestKey] + (100 - total));
  return next;
}

function LifestyleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTokens();
  // Width as STATE (not ref) so a re-render fires once layout measures —
  // pre-fix the slider was dead until first re-render. (P1-3 + P2-19.)
  const [trackWidth, setTrackWidth] = useState(0);
  // Latest values mirrored into refs so the PanResponder closure (created once)
  // always sees fresh `trackWidth` + `onChange` without re-creating the handler.
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  widthRef.current = trackWidth;
  onChangeRef.current = onChange;

  // Drag-to-set slider — proper PanResponder so the user can fine-tune by
  // sliding instead of tapping pixel-precise positions. (P1-4.)
  //
  // Direction-gated capture so the parent ScrollView keeps vertical scroll:
  // - onStartShouldSetPanResponder returns false so a touch-start never
  //   blocks the ScrollView from beginning a vertical drag.
  // - onMoveShouldSetPanResponder claims the responder only when the gesture
  //   is horizontal-dominant (|dx| > |dy|), which is the slider's axis.
  //   Vertical-dominant gestures fall through to the ScrollView untouched.
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
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
        accessibilityLabel={tr('quiz.q2.percentLabel', { label })}
        accessibilityValue={{ min: 0, max: 100, now: value }}
        accessibilityActions={[
          { name: 'increment', label: tr('quiz.q2.action.increase') },
          { name: 'decrement', label: tr('quiz.q2.action.decrease') },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(100, value + 5));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(0, value - 5));
        }}
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

// ─── Q3 — Climate + city ─────────────────────────────────────────────────────

const CLIMATES: readonly { id: Climate; labelKey: string }[] = [
  { id: 'hot',      labelKey: 'quiz.q3.climate.hot' },
  { id: 'warm',     labelKey: 'quiz.q3.climate.warm' },
  { id: 'mild',     labelKey: 'quiz.q3.climate.mild' },
  { id: 'cold',     labelKey: 'quiz.q3.climate.cold' },
  { id: 'variable', labelKey: 'quiz.q3.climate.variable' },
];

function Q3({
  answers,
  setAnswers,
}: {
  answers: StyleQuizAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<StyleQuizAnswers>>;
}) {
  const t = useTokens();
  const toggle = (id: Climate) =>
    setAnswers((a) => ({
      ...a,
      climates: a.climates.includes(id)
        ? a.climates.filter((x) => x !== id)
        : [...a.climates, id],
    }));

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <PageTitle>{tr('quiz.q3.title')}</PageTitle>
        <Caption>{tr('quiz.q3.body')}</Caption>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('quiz.q3.climate.label')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CLIMATES.map((c) => {
            const active = answers.climates.includes(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => { hapticSelection(); toggle(c.id); }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                style={({ pressed }) => ({
                  height: 36,
                  paddingHorizontal: 16,
                  borderRadius: radii.pill,
                  backgroundColor: active ? t.fg : t.card,
                  borderWidth: 1,
                  borderColor: active ? 'transparent' : t.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.9 : 1,
                })}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 11,
                    color: active ? t.bg : t.fg2,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                  }}>
                  {tr(c.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('quiz.q3.city.label')}</Eyebrow>
        <TextInput
          value={answers.city}
          onChangeText={(v) => setAnswers((a) => ({ ...a, city: v }))}
          placeholder={tr('quiz.q3.city.placeholder')}
          placeholderTextColor={t.fg3}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="postal-address-locality"
          textContentType="addressCity"
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          style={{
            height: 48,
            paddingHorizontal: 16,
            borderRadius: radii.lg,
            backgroundColor: t.card,
            borderWidth: 1,
            borderColor: t.border,
            fontFamily: fonts.uiMed,
            fontSize: 14.5,
            color: t.fg,
            letterSpacing: -0.15,
          }}
        />
      </View>
    </View>
  );
}

// ─── Q4 — Archetypes ─────────────────────────────────────────────────────────

// IDs match the web's V4 ARCHETYPE_OPTIONS (src/types/styleProfile.ts:70) so
// the eventual server-write doesn't fail the CHECK constraint. Verified
// 2026-05-02. (P2-9.)
const ARCHETYPES: readonly { id: Archetype; labelKey: string }[] = [
  { id: 'minimal',    labelKey: 'quiz.q4.archetype.minimal' },
  { id: 'classic',    labelKey: 'quiz.q4.archetype.classic' },
  { id: 'romantic',   labelKey: 'quiz.q4.archetype.romantic' },
  { id: 'street',     labelKey: 'quiz.q4.archetype.street' },
  { id: 'bohemian',   labelKey: 'quiz.q4.archetype.bohemian' },
  { id: 'preppy',     labelKey: 'quiz.q4.archetype.preppy' },
  { id: 'elegant',    labelKey: 'quiz.q4.archetype.elegant' },
  { id: 'edgy',       labelKey: 'quiz.q4.archetype.edgy' },
  { id: 'coastal',    labelKey: 'quiz.q4.archetype.coastal' },
  { id: 'sporty',     labelKey: 'quiz.q4.archetype.sporty' },
  { id: 'avantgarde', labelKey: 'quiz.q4.archetype.avantgarde' },
  { id: 'workwear',   labelKey: 'quiz.q4.archetype.workwear' },
];

function Q4({
  answers,
  setAnswers,
}: {
  answers: StyleQuizAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<StyleQuizAnswers>>;
}) {
  const t = useTokens();
  const count = answers.archetypes.length;
  const tooMany = count >= ARCHETYPE_MAX;
  const eyebrow =
    count >= ARCHETYPE_MIN
      ? tr('quiz.q4.eyebrow.count', { count })
      : tr('quiz.q4.eyebrow.range', { min: ARCHETYPE_MIN, max: ARCHETYPE_MAX });

  const toggle = (id: Archetype) =>
    setAnswers((a) => {
      const has = a.archetypes.includes(id);
      if (has) return { ...a, archetypes: a.archetypes.filter((x) => x !== id) };
      if (a.archetypes.length >= ARCHETYPE_MAX) return a; // hard cap
      return { ...a, archetypes: [...a.archetypes, id] };
    });

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <PageTitle>{tr('quiz.q4.title')}</PageTitle>
        <Eyebrow style={{ color: count >= ARCHETYPE_MIN ? t.accent : t.fg2 }}>
          {eyebrow}
        </Eyebrow>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ARCHETYPES.map((a) => {
          const active = answers.archetypes.includes(a.id);
          const disabled = !active && tooMany;
          return (
            <Pressable
              key={a.id}
              onPress={() => { hapticSelection(); toggle(a.id); }}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active, disabled }}
              style={({ pressed }) => ({
                height: 36,
                paddingHorizontal: 14,
                borderRadius: radii.pill,
                backgroundColor: active ? t.accentSoft : t.card,
                borderWidth: active ? 1.5 : 1,
                borderColor: active ? t.accent : t.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled ? 0.4 : pressed ? 0.9 : 1,
              })}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 11,
                  color: active ? t.accent : t.fg2,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}>
                {tr(a.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Q5 — Goal ───────────────────────────────────────────────────────────────

const GOALS: readonly { id: Goal; labelKey: string; captionKey: string }[] = [
  { id: 'fasterDressing',  labelKey: 'quiz.q5.goal.fasterDressing.label',  captionKey: 'quiz.q5.goal.fasterDressing.caption' },
  { id: 'discoverCombos',  labelKey: 'quiz.q5.goal.discoverCombos.label',  captionKey: 'quiz.q5.goal.discoverCombos.caption' },
  { id: 'shopSmarter',     labelKey: 'quiz.q5.goal.shopSmarter.label',     captionKey: 'quiz.q5.goal.shopSmarter.caption' },
  { id: 'capsuleWardrobe', labelKey: 'quiz.q5.goal.capsuleWardrobe.label', captionKey: 'quiz.q5.goal.capsuleWardrobe.caption' },
];

function Q5({
  answers,
  setAnswers,
  onGoalPick,
}: {
  answers: StyleQuizAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<StyleQuizAnswers>>;
  onGoalPick: () => void;
}) {
  const t = useTokens();
  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <PageTitle>{tr('quiz.q5.title')}</PageTitle>
      </View>
      <View style={{ gap: 10 }}>
        {GOALS.map((g) => {
          const active = answers.goal === g.id;
          return (
            <Pressable
              key={g.id}
              onPress={() => {
                hapticSelection();
                setAnswers((a) => ({ ...a, goal: g.id }));
                onGoalPick();
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
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed ? 0.92 : 1,
              })}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radii.md,
                  backgroundColor: t.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <SparklesIcon size={18} color={t.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 14,
                    color: t.fg,
                    letterSpacing: -0.13,
                  }}>
                  {tr(g.labelKey)}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: fonts.uiMed,
                    fontSize: 12,
                    color: t.fg2,
                    lineHeight: 16,
                  }}>
                  {tr(g.captionKey)}
                </Text>
              </View>
              {active ? <CheckIcon size={18} color={t.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
