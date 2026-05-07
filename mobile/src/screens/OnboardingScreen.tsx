// OnboardingScreen — container that walks the user through 8 steps.
// Each step is a self-contained sub-screen under ./onboarding/.
//
// Header layout:
//   • Back button left (hidden on step 1)
//   • Skip button right (steps 2-5 only — value prop / quiz / accent color
//     / photo tutorial / studio; language and the post-quiz reveal /
//     achievement steps are not skippable)
//   • Progress bar (shows current step / 8)
//
// Step transitions are coordinated by `step` state. Each sub-step's onComplete
// fires with a typed payload that we accumulate into `draft`. Once the final
// step (Reveal) completes, we reset the nav stack into MainTabs.
//
// TODO(server-write): once Supabase auth is wired, persist `draft` to
// profiles.preferences.styleProfile + advance_onboarding_step before navigating.

import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { BackIcon } from '../components/icons';
import { FadeUp } from '../components/FadeUp';
import { t as tr } from '../lib/i18n';
import { hapticLight } from '../lib/haptics';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

import { LanguageStep, type LanguageCode } from './onboarding/LanguageStep';
import { ValuePropositionStep } from './onboarding/ValuePropositionStep';
import {
  StyleQuizV4Step,
  touchedToCompatTouched,
  type QuizV4Progress,
  type Touched,
} from './onboarding/StyleQuizV4Step';
import { StudioSelectionStep, type Studio } from './onboarding/StudioSelectionStep';
import { AchievementStep } from './onboarding/AchievementStep';
import { RevealStep } from './onboarding/RevealStep';
import { AccentColorStep } from './onboarding/AccentColorStep';
import { PhotoTutorialStep } from './onboarding/PhotoTutorialStep';

import { migrateV4ToV3Compat, type StyleProfileV4 } from '../lib/styleProfileV4';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type OnboardingDraft = {
  language?: LanguageCode;
  /** Final V4 style profile capture (M25), set when StyleQuizV4Step's
   * `onComplete` fires. Persisted to
   * `profiles.preferences.style_profile_v4_jsonb` in `finish()`. */
  quiz?: StyleProfileV4;
  /** Touched-flag map captured at quiz completion. Drives skip-omission in
   * the V3-compat shim — fields the user never explicitly tapped are
   * scrubbed from the V3 mirror so default scalars (`paletteVibe: 'mixed'`,
   * `patternComfort: 'some'`, …) aren't downstream-indistinguishable from
   * skip-defaults. */
  quizTouched?: Touched;
  /** Mid-quiz progress snapshot — answers + question index + per-field
   * touched flags. Persisted on every update via the existing draft
   * autopersist effect. Cleared once the user completes (then `quiz` carries
   * the final state) or backs out. Without this, force-quitting on Q5 drops
   * the user back at Q1 with empty answers (M25 Codex P1). */
  quizDraft?: QuizV4Progress;
  /** Accent color picked in M26's AccentColorStep. We carry BOTH the
   * swatch id (web-key, mirrors `src/contexts/ThemeContext.tsx`) and the
   * hex (mobile-spec). At finish time both are written:
   *   - `preferences.accentColor` = id  (web ThemeContext reads this)
   *   - `preferences.accent_color` = hex (mobile-side metadata slot)
   * so a value picked on either platform round-trips on the other.
   * Metadata only — the live UI accent stays the warm-gold token. */
  accentColor?: { id: string; hex: string };
  studio?: Studio;
};

type PersistedState = {
  step: number;
  draft: OnboardingDraft;
  // Bumped when the persisted shape changes; `loadDraft` discards mismatches.
  v: 1;
};

// Step order (0-indexed):
//   0 Language · 1 ValueProposition · 2 StyleQuizV4 · 3 AccentColor (M26)
//   4 PhotoTutorial (M27) · 5 StudioSelection · 6 Achievement · 7 Reveal
const STEP_COUNT = 8;
// Skippable: ValueProposition, StyleQuizV4, AccentColor, PhotoTutorial,
// StudioSelection. PhotoTutorial is informational so the user can dismiss
// it; the parent advance() pointer just moves on without persisting any
// draft payload (the tutorial captures nothing).
const SKIPPABLE = [1, 2, 3, 4, 5];

// AsyncStorage key — namespaced so it can't collide with future onboarding
// flavors. (P1-23.) Cleared once the user reaches MainTabs.
const DRAFT_KEY = 'burs.onboarding.draft.v1';

async function loadDraft(): Promise<PersistedState | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.v !== 1 || typeof parsed.step !== 'number') return null;
    // M26 review fix: pre-fix drafts stored `accentColor` as a hex string;
    // the new shape is `{ id, hex }`. If we see the old shape, drop it
    // rather than pass a string where AccentColorStep expects an object —
    // the user re-picks (the default 'amber' pre-selection makes that a
    // single-tap action) instead of crashing.
    if (parsed.draft && typeof parsed.draft.accentColor === 'string') {
      parsed.draft = { ...parsed.draft, accentColor: undefined };
    }
    return parsed;
  } catch {
    return null;
  }
}

async function saveDraft(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    // Best-effort: persistence failure isn't user-blocking.
  }
}

async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// Exported so callers that route into Onboarding from a "start fresh" entry
// point (e.g. Settings → Retake style quiz) can purge the persisted draft
// before navigating, otherwise `loadDraft` would resume from the previous
// step on mount.
export async function clearOnboardingDraft(): Promise<void> {
  await clearDraft();
}

export function OnboardingScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { user, profile, refreshProfile } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>({});
  // Tracks consecutive `finish()` failures so the Retry alert can escalate
  // to a "give up gracefully" message after a couple of failed attempts
  // instead of looping the user through the same dialog forever.
  const finishRetryRef = useRef(0);
  const FINISH_RETRY_LIMIT = 2;

  // Hydrate persisted draft on first mount so a user who backgrounded the app
  // mid-quiz lands back on the same step with their answers intact. (P1-23.)
  useEffect(() => {
    let cancelled = false;
    loadDraft().then((persisted) => {
      if (cancelled) return;
      if (persisted) {
        setStep(Math.min(STEP_COUNT - 1, Math.max(0, persisted.step)));
        setDraft(persisted.draft ?? {});
      }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Persist on every step / draft change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ v: 1, step, draft });
  }, [hydrated, step, draft]);

  const finish = async () => {
    // Persist onboarding completion to BOTH the canonical column gate
    // (`profiles.onboarding_step = 'completed'` via the
    // `advance_onboarding_step` RPC — same path the web takes) and the
    // legacy `preferences.onboarding.*` flag (deploy-window fallback +
    // legacy consumers like web's useFirstRunCoach).
    //
    // Cross-app correctness: writing only the legacy flag would leave
    // mobile-finished users bouncing through web's onboarding because
    // `ProtectedRoute` reads the column. Mirror web's order: column write
    // first, legacy preferences second. A column-write failure surfaces an
    // alert the user can act on; the preferences merge is best-effort.
    //
    // Preferences write is read-modify-write so we don't clobber sibling
    // keys (notifications, locale, etc.) that the web app may have stored
    // — UPDATE on a JSONB column with a fresh object replaces the entire
    // value, not merges.
    let columnWriteFailed = false;
    if (user) {
      try {
        const { error: rpcError } = await supabase.rpc('advance_onboarding_step', {
          p_user_id: user.id,
          p_to_step: 'completed',
        });
        if (rpcError) {
          // Pre-Wave-7 deploy windows (RPC missing) surface as 42883/PGRST202
          // and are tolerated by the web — fall through to the legacy write
          // and let the preferences flag carry the gate. Any other error
          // means the canonical column write didn't land; surface it so the
          // user can retry instead of getting stuck in a redirect loop later.
          const code = (rpcError as { code?: string }).code;
          const isDeployWindow = code === '42883' || code === 'PGRST202';
          if (!isDeployWindow) {
            console.warn('[OnboardingScreen] advance_onboarding_step failed:', rpcError);
            columnWriteFailed = true;
          } else {
            console.warn(
              '[OnboardingScreen] advance_onboarding_step RPC missing (deploy window) — using legacy flag:',
              rpcError,
            );
          }
        }
      } catch (err) {
        console.warn('[OnboardingScreen] advance_onboarding_step threw:', err);
        columnWriteFailed = true;
      }

      // Read-modify-write merge of preferences. Existing keys (web-side
      // notifications, locale, anything we don't know about) are preserved.
      const existingPrefs = (profile?.preferences ?? {}) as Record<string, unknown>;
      const existingOnboarding = (existingPrefs.onboarding ?? {}) as Record<string, unknown>;
      // M25 (Codex P0): persist the full V4 capture into:
      //   1. `style_profile_v4_jsonb` — canonical V4 slot (web parity).
      //   2. `styleProfile` — V3-shaped mirror so the AI engine consumers
      //      (`burs_style_engine`, `_shared/outfit-scoring*`,
      //      `_shared/style-summary-builder`, `suggest_outfit_combinations`,
      //      `shopping_chat`, `style_chat`) keep emitting populated prompt
      //      lines until they migrate to V4-native reads. Without the
      //      mirror, mobile-V4 users get silent AI-quality regression on
      //      every outfit / chat / score path that reads `preferences.styleProfile`.
      // The legacy `onboarding.quiz` mirror is DROPPED — no live consumer
      // reads it; readers consume `styleProfile` (M25 review).
      const mergedPrefs: Record<string, unknown> = {
        ...existingPrefs,
        onboarding: {
          ...existingOnboarding,
          completed: true,
          // Audit follow-up (M27): write a precise `completed_at` timestamp
          // so the first-run coach retro gate can distinguish "user finished
          // onboarding ≥1 hour ago and never saw the tour" from "user is
          // mid-flow right now". Pre-existing `completed: true` boolean is
          // preserved for legacy readers; the new timestamp is additive.
          completed_at: existingOnboarding.completed_at ?? new Date().toISOString(),
          step: STEP_COUNT,
          language: draft.language,
          studio: draft.studio,
        },
      };
      if (draft.quiz) {
        mergedPrefs.style_profile_v4_jsonb = draft.quiz;
        // Build the V3-compat shape using the touched-flag map so default
        // scalars the user never tapped (e.g. `paletteVibe: 'mixed'`) are
        // omitted from the V3 mirror rather than written as definitive
        // answers. Web parity: `src/pages/Onboarding.tsx` `handleQuizComplete`.
        const compatTouched = draft.quizTouched
          ? touchedToCompatTouched(draft.quizTouched)
          : undefined;
        mergedPrefs.styleProfile = migrateV4ToV3Compat(draft.quiz, compatTouched);
      }
      // M26 — AccentColorStep. Metadata only (memory + future
      // personalization); the live UI accent stays the warm-gold token.
      // Dual-write so values round-trip across platforms:
      //   - `accentColor` (camelCase, swatch id) is the shape web's
      //     `src/contexts/ThemeContext.tsx` reads on sign-in to restore the
      //     stored accent. Mobile-saved values must use this shape so a
      //     mobile-onboarded user's pick shows up when they open the web app.
      //   - `accent_color` (snake_case, hex) is the mobile-spec literal
      //     kept for any future mobile-only consumer that wants raw hex
      //     without re-resolving the id.
      // Skipped steps OMIT both keys (read-modify-write merge preserves any
      // previously-stored value, including ones written by the web).
      if (draft.accentColor) {
        mergedPrefs.accent_color = draft.accentColor.hex;
        mergedPrefs.accentColor = draft.accentColor.id;
      }
      try {
        const { error: prefsError } = await supabase
          .from('profiles')
          .update({ preferences: mergedPrefs })
          .eq('id', user.id);
        if (prefsError) {
          // Legacy flag is the secondary signal; column gate (above) is the
          // canonical one. If the column write succeeded but this didn't,
          // the next profile refetch resolves any inconsistency. Log only.
          console.warn('[OnboardingScreen] preferences merge failed (non-blocking):', prefsError.message);
        }
      } catch (err) {
        console.warn('[OnboardingScreen] preferences merge threw:', err);
      }

      // Refresh AuthContext's cached profile so `isOnboarded` flips
      // immediately and the post-sign-in routing effect routes the user to
      // MainTabs without an additional round-trip.
      await refreshProfile();
    }

    if (columnWriteFailed) {
      // User-visible failure surface. Non-blocking — they can choose to
      // continue (legacy flag carries them through this session, with a
      // warning) or retry (rare; means a network hiccup at the very end).
      // After FINISH_RETRY_LIMIT consecutive failures, swap the dialog so
      // the user isn't stuck in a "Retry → same alert → Retry" loop.
      finishRetryRef.current += 1;
      const exhausted = finishRetryRef.current > FINISH_RETRY_LIMIT;
      const title = exhausted ? 'Trouble saving' : 'Save failed';
      const body = exhausted
        ? 'We are having trouble saving your onboarding progress. You can continue without saving and we will try again later.'
        : 'We could not save your onboarding progress. You can continue and we will try again later, or retry now.';
      Alert.alert(
        title,
        body,
        [
          {
            text: 'Retry',
            onPress: () => {
              void finish();
            },
          },
          {
            text: 'Continue anyway',
            style: 'cancel',
            onPress: () => {
              finishRetryRef.current = 0;
              void clearDraft();
              nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            },
          },
        ],
      );
      return;
    }

    finishRetryRef.current = 0;
    void clearDraft();
    nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const advance = () => {
    if (step < STEP_COUNT - 1) setStep(step + 1);
    else finish();
  };

  const back = () => {
    if (step > 0) {
      hapticLight();
      setStep(step - 1);
    }
  };

  const skip = () => {
    if (SKIPPABLE.includes(step)) {
      hapticLight();
      advance();
    }
  };

  const showBack = step > 0;
  const showSkip = SKIPPABLE.includes(step);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom', 'left', 'right']}>
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
              accessibilityLabel={tr('onboarding.back')}
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
              accessibilityLabel={tr('onboarding.skip')}
              hitSlop={8}
              style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 12.5,
                  color: t.fg2,
                  letterSpacing: -0.1,
                }}>
                {tr('onboarding.skip')}
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
          <StyleQuizV4Step
            initial={draft.quizDraft}
            onProgress={(progress) => {
              // Per-update mid-quiz snapshot. The outer draft autopersist
              // effect (depends on `draft`) writes it to AsyncStorage, so a
              // user who force-quits on Q5 and re-launches resumes there.
              setDraft((d) => ({ ...d, quizDraft: progress }));
            }}
            onComplete={(quiz, quizTouched) => {
              // Drop quizDraft once the final answer is captured — the
              // canonical `quiz` carries it from here.
              setDraft((d) => ({
                ...d,
                quiz,
                quizTouched,
                quizDraft: undefined,
              }));
              advance();
            }}
          />
        )}
        {step === 3 && (
          <AccentColorStep
            initial={draft.accentColor}
            onComplete={({ id, hex }) => {
              setDraft((d) => ({ ...d, accentColor: { id, hex } }));
              advance();
            }}
          />
        )}
        {step === 4 && <PhotoTutorialStep onComplete={advance} />}
        {step === 5 && (
          <StudioSelectionStep
            initial={draft.studio}
            onComplete={(studio) => {
              setDraft((d) => ({ ...d, studio }));
              advance();
            }}
          />
        )}
        {step === 6 && <AchievementStep onComplete={advance} />}
        {step === 7 && <RevealStep onComplete={finish} />}
      </FadeUp>
    </SafeAreaView>
  );
}
