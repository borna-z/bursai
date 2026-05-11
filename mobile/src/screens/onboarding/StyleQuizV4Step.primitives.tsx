// StyleQuizV4Step — shared primitives (N13 split).
//
// QHeader — page title + caption per question.
// HeightStepper — round +/- button used inside QIdentity's height row.
// PercentSlider — adjustable percent track used by QLifestyle + QFormality.
// FreeTextInput — text input style used by QClimate / QArchetypes / QCultural.
// ChipRow — generic single-select chip row used by Q6 / Q8 / Q10.
// ColorGrid — swatch picker used by QColors.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Chip } from '../../components/Chip';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Caption } from '../../components/Caption';
import { CheckIcon } from '../../components/icons';
import { isLightSwatch } from '../../lib/color';
import { hapticSelection } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';
import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { COLOR_SWATCHES } from '../../lib/styleProfileV4';

export function QHeader({ id }: { id: string }) {
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <PageTitle>{tr(`onboarding.quizV4.q.${id}.prompt`)}</PageTitle>
      <Caption>{tr(`onboarding.quizV4.q.${id}.help`)}</Caption>
    </View>
  );
}

export function HeightStepper({
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

export function PercentSlider({
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

  // N14/F3 round 2 — split tap from drag.
  // Round 1 (`onStartShouldSetPanResponder: () => true`) regressed vertical
  // scrolling: claiming the responder on touch-start meant the parent
  // ScrollView in `StyleQuizV4Step.tsx` couldn't scroll any gesture that
  // started over a slider. Codex round 2 on PR #819 flagged this.
  //
  // Two-handler split:
  //   • PanResponder handles drags — `onStartShouldSetPanResponder: false`
  //     leaves the touch-start unclaimed, then `onMoveShouldSetPanResponder`
  //     only claims when the gesture is horizontally biased. Vertical
  //     scrolls fall through to ScrollView, horizontal drags commit
  //     position via grant + move (unchanged from pre-N14).
  //   • Pressable-overlay handles bare taps — `onPress` only fires on a
  //     clean tap (Pressability cancels on significant movement), so
  //     vertical scroll gestures that start over the slider don't trigger
  //     it. The overlay's `locationX` is relative to the absoluteFill,
  //     which matches the outer View's bounds.
  const commitFromLocationX = useCallback((locationX: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    const x = Math.max(0, Math.min(w, locationX));
    onChangeRef.current(Math.round((x / w) * 100));
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        // N14/F3 round 3 — capture-phase claim. The Pressable overlay below
        // is the deepest touch target and would otherwise hold the responder
        // for its press lifecycle, swallowing horizontal drags before the
        // parent View's bubble-phase `onMoveShouldSetPanResponder` ever
        // fires. By claiming on capture when the gesture is horizontally
        // biased, the parent wins the responder transfer mid-drag, the
        // Pressable's press is cancelled (Pressability releases on responder
        // takeover), and `onPanResponderGrant` / `onPanResponderMove`
        // commit the slider position as before.
        onMoveShouldSetPanResponderCapture: (_e, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onMoveShouldSetPanResponder: (_e, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: (e) => {
          commitFromLocationX(e.nativeEvent.locationX);
          hapticSelection();
        },
        onPanResponderMove: (e) => {
          commitFromLocationX(e.nativeEvent.locationX);
        },
      }),
    [commitFromLocationX],
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
        // VoiceOver swipe-up/down nudges by 5pp (Codex P2 — without these
        // actions, the adjustable role surfaces no AT control).
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const step = 5;
          if (event.nativeEvent.actionName === 'increment') {
            onChangeRef.current(Math.min(100, value + step));
          } else if (event.nativeEvent.actionName === 'decrement') {
            onChangeRef.current(Math.max(0, value - step));
          }
        }}
        // Visual track is 32pt tall; pad gesture surface to a 44pt minimum
        // touch target without changing the visual layout.
        hitSlop={{ top: 6, bottom: 6 }}
        style={{
          height: 32,
          justifyContent: 'center',
        }}>
        <View
          pointerEvents="none"
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
        {/* N14/F3 round 2 — Pressable overlay handles bare taps without
            claiming the responder on touch-start. Pressability cancels on
            significant movement, so vertical scroll gestures pass through
            to the parent ScrollView and horizontal drags get claimed by
            the outer View's PanResponder via onMoveShouldSetPanResponder. */}
        <Pressable
          accessible={false}
          onPress={(e) => {
            commitFromLocationX(e.nativeEvent.locationX);
            hapticSelection();
          }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

export function FreeTextInput({
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

export function ChipRow<T extends string>({
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

export function ColorGrid({
  selected,
  onToggle,
}: {
  selected: readonly string[];
  onToggle: (id: string) => void;
}) {
  const t = useTokens();
  return (
    // N14/F4 — gap 12→16 so 44 pt swatches keep ≥4 px inter-target padding
    // on the cross-axis when the row wraps.
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {COLOR_SWATCHES.map((color) => {
        const isSelected = selected.includes(color.id);
        const checkColor = isLightSwatch(color.hex) ? t.fg : t.bg;
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
