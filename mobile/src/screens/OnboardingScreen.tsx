// OnboardingScreen — container that walks the user through 6 steps.
// Each step is a self-contained sub-screen under ./onboarding/.
//
// Header layout:
//   • Back button left (hidden on step 1)
//   • Skip button right (steps 2-4 only — value prop / quiz / studio)
//   • Progress bar (shows current step / 6)
//
// Step transitions are coordinated by `step` state. Each sub-step's onComplete
// fires with a typed payload that we accumulate into `draft`. Once the final
// step (Reveal) completes, we reset the nav stack into MainTabs.
//
// TODO(server-write): once Supabase auth is wired, persist `draft` to
// profiles.preferences.styleProfile + advance_onboarding_step before navigating.

import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { BackIcon } from '../components/icons';
import { FadeUp } from '../components/FadeUp';

import { LanguageStep, type LanguageCode } from './onboarding/LanguageStep';
import { ValuePropositionStep } from './onboarding/ValuePropositionStep';
import { StyleQuizStep, type StyleQuizAnswers } from './onboarding/StyleQuizStep';
import { StudioSelectionStep, type Studio } from './onboarding/StudioSelectionStep';
import { AchievementStep } from './onboarding/AchievementStep';
import { RevealStep } from './onboarding/RevealStep';

import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type OnboardingDraft = {
  language?: LanguageCode;
  quiz?: StyleQuizAnswers;
  studio?: Studio;
};

const STEP_COUNT = 6;
// Steps 2, 3, 4 (1-indexed) are skippable per spec — that's 0-indexed 1, 2, 3.
const SKIPPABLE = new Set([1, 2, 3]);

export function OnboardingScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>({});

  const finish = () => {
    // TODO(server-write): persist `draft` to Supabase before resetting.
    nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const advance = () => {
    if (step < STEP_COUNT - 1) setStep(step + 1);
    else finish();
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  const skip = () => {
    if (SKIPPABLE.has(step)) advance();
  };

  const showBack = step > 0;
  const showSkip = SKIPPABLE.has(step);
  const progress = (step + 1) / STEP_COUNT;

  // Android hardware back: walk back through the steps instead of exiting the
  // app and discarding all answers (P0-3 from review). Returning `true` from
  // the listener absorbs the event; `false` lets the navigator/RN handle it
  // normally (which on step 0 falls back to default exit).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      {/* Header: back · progress · skip */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 12,
        }}>
        <View style={{ width: 40, alignItems: 'flex-start' }}>
          {showBack && (
            <Pressable
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: t.card,
                borderWidth: 1,
                borderColor: t.border,
                opacity: pressed ? 0.85 : 1,
              })}>
              <BackIcon color={t.fg} />
            </Pressable>
          )}
        </View>

        <View
          style={{
            flex: 1,
            height: 4,
            borderRadius: radii.pill,
            backgroundColor: t.bg2,
            overflow: 'hidden',
          }}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: STEP_COUNT, now: step + 1 }}>
          <View
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: t.accent,
            }}
          />
        </View>

        <View style={{ width: 56, alignItems: 'flex-end' }}>
          {showSkip && (
            <Pressable
              onPress={skip}
              accessibilityRole="button"
              accessibilityLabel="Skip"
              hitSlop={8}
              style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 12.5,
                  color: t.fg2,
                  letterSpacing: -0.1,
                }}>
                Skip
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <FadeUp key={step} style={{ flex: 1, paddingTop: 8 }}>
        {step === 0 && (
          <LanguageStep
            initial={draft.language}
            onComplete={(language) => {
              setDraft((d) => ({ ...d, language }));
              advance();
            }}
          />
        )}
        {step === 1 && <ValuePropositionStep onComplete={advance} />}
        {step === 2 && (
          <StyleQuizStep
            onComplete={(quiz) => {
              setDraft((d) => ({ ...d, quiz }));
              advance();
            }}
          />
        )}
        {step === 3 && (
          <StudioSelectionStep
            initial={draft.studio}
            onComplete={(studio) => {
              setDraft((d) => ({ ...d, studio }));
              advance();
            }}
          />
        )}
        {step === 4 && <AchievementStep onComplete={advance} />}
        {step === 5 && <RevealStep onComplete={finish} />}
      </FadeUp>
    </SafeAreaView>
  );
}
