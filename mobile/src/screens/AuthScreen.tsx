// AuthScreen — sign-in / sign-up toggle. Single screen, two modes.
// KeyboardAvoidingView wraps the form so the keyboard doesn't obscure inputs on iOS.
//
// Wave 1 (feat/mobile-w1-auth): wired to real Supabase auth via useAuth().
// Sign-in / sign-up / Google OAuth all dispatch through AuthContext; the
// auth-state listener in AuthContext + SplashScreen owns post-auth routing
// (no manual nav.reset on success — listener decides Onboarding vs MainTabs).

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { t as tr } from '../lib/i18n';
import { hapticLight, hapticSelection } from '../lib/haptics';
import { useAuth } from '../hooks/useAuth';
import { useResetPassword } from '../hooks/useResetPassword';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Mode = 'signIn' | 'signUp';

// Google brand glyph — stays inline because the four colors are Google's brand
// palette, not theme tokens. They're declared as a local constant so the lint
// rule "no hardcoded hex outside color data constants" is satisfied.
const GOOGLE_BRAND = {
  blue: '#4285F4',
  red: '#EA4335',
  yellow: '#FBBC05',
  green: '#34A853',
} as const;

// Lightweight email shape check — Supabase will return a definitive error on
// truly malformed addresses; this is just to gate the submit button + the
// inline error message before the network round-trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill={GOOGLE_BRAND.blue}
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 8.5-20.5l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
      <Path
        fill={GOOGLE_BRAND.red}
        d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <Path
        fill={GOOGLE_BRAND.green}
        d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.3A12 12 0 0 1 12.7 28l-6.6 5.1A20 20 0 0 0 24 44z"
      />
      <Path
        fill={GOOGLE_BRAND.yellow}
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.4l6.3 5.3C41.4 35.4 44 30.1 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </Svg>
  );
}

export function AuthScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { signIn, signUp, user, isLoading, isOnboarded } = useAuth();
  const { requestReset } = useResetPassword();
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // "Touched" semantics: only show inline errors after the user has either
  // blurred a field or attempted submit. Keeps the empty form quiet on entry.
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; password?: boolean }>({});

  // Ref chain for keyboard "Next" focus advancement (P1-9).
  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);

  // Guards setState calls in async finally blocks: AuthContext routes the user
  // away as soon as SIGNED_IN fires, so the component can unmount before the
  // signIn/signUp/OAuth promise resolves. Without this, RN logs a "state update
  // on unmounted component" warning and the spinner state leaks.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Post-sign-in routing. SplashScreen owns the cold-start fork; once the user
  // has reached AuthScreen, Splash is unmounted, so a successful sign-in needs
  // a local effect to push them onward. Gates on isLoading=false so we wait
  // for the profile fetch to settle before deciding Onboarding vs MainTabs —
  // otherwise a brief profile=null window would route a returning user back
  // to Onboarding. (Concurrency review I2.)
  const navigatedRef = useRef(false);
  useEffect(() => {
    if (isLoading || !user || navigatedRef.current) return;
    navigatedRef.current = true;
    if (isOnboarded) {
      nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } else {
      nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
    }
  }, [isLoading, user, isOnboarded, nav]);

  const isSignUp = mode === 'signUp';

  const trimmedEmail = email.trim();
  const emailValid = EMAIL_RE.test(trimmedEmail);
  const passwordValid = password.length >= MIN_PASSWORD;
  const nameValid = !isSignUp || name.trim().length > 0;
  const canSubmit = emailValid && passwordValid && nameValid && !submitting;

  // Inline-error gates only depend on `touched` so an attempted submit (which
  // sets every field touched) reveals "Enter a valid email" / "Password too
  // short" even when the field is empty. Keeping the gate purely on touched
  // means a fresh field never shows an error before the user interacts —
  // empty + untouched stays quiet. (UX review #1.)
  const showNameError = isSignUp && Boolean(touched.name) && name.trim().length === 0;
  const showEmailError = Boolean(touched.email) && !emailValid;
  const showPasswordError = Boolean(touched.password) && !passwordValid;

  const handleSubmit = async () => {
    setTouched({ name: true, email: true, password: true });
    if (!canSubmit) return;
    hapticLight();
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(trimmedEmail, password, name);
        if (error) {
          Alert.alert(tr('auth.signUp.errorTitle'), error.message);
          return;
        }
      } else {
        const { error } = await signIn(trimmedEmail, password);
        if (error) {
          Alert.alert(tr('auth.signIn.errorTitle'), error.message);
          return;
        }
      }
      // Success: the post-sign-in routing effect above (gated on user +
      // !isLoading) reset-navigates to Onboarding or MainTabs as soon as
      // AuthContext finishes loading the profile.
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  // Forgot password — fires `supabase.auth.resetPasswordForEmail` with the
  // current email field's value. Validates email locally first (Supabase
  // returns success even for unknown emails to prevent enumeration, so the
  // local gate is the user's actual feedback that the email shape is wrong).
  const handleForgotPassword = async () => {
    if (resetSubmitting || submitting) return;
    hapticLight();
    setTouched((s) => ({ ...s, email: true }));
    if (!emailValid) {
      Alert.alert(
        tr('auth.resetPassword.emailRequiredTitle'),
        tr('auth.resetPassword.emailRequiredBody'),
      );
      return;
    }
    setResetSubmitting(true);
    try {
      const { error } = await requestReset(trimmedEmail);
      if (!isMountedRef.current) return;
      if (error) {
        Alert.alert(tr('auth.resetPassword.errorTitle'), error.message);
        return;
      }
      Alert.alert(
        tr('auth.resetPassword.successTitle'),
        tr('auth.resetPassword.successBody', { email: trimmedEmail }),
      );
    } finally {
      if (isMountedRef.current) setResetSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting) return;
    hapticLight();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'burs://auth/callback',
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        Alert.alert(tr('auth.google.errorTitle'), error.message);
      }
      // Deep link callback handled by RootNavigator; auth listener + the
      // post-sign-in routing effect above complete the flow.
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const inputsDisabled = submitting;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 40,
          }}>
          {/* Wordmark */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 32,
                color: t.fg,
                letterSpacing: -0.4,
              }}
              accessibilityRole="header">
              {tr('auth.wordmark')}
            </Text>
          </View>

          {/* Eyebrow */}
          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <Eyebrow>{isSignUp ? tr('auth.signUp.eyebrow') : tr('auth.signIn.eyebrow')}</Eyebrow>
          </View>

          {/* Form fields */}
          <View style={{ gap: 12 }}>
            {isSignUp && (
              <View>
                <Field
                  label={tr('auth.field.name')}
                  value={name}
                  onChangeText={setName}
                  onBlur={() => setTouched((s) => ({ ...s, name: true }))}
                  editable={!inputsDisabled}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
                {showNameError ? <FieldError>{tr('auth.error.nameRequired')}</FieldError> : null}
              </View>
            )}
            <View>
              <Field
                ref={emailRef}
                label={tr('auth.field.email')}
                value={email}
                onChangeText={setEmail}
                onBlur={() => setTouched((s) => ({ ...s, email: true }))}
                editable={!inputsDisabled}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              {showEmailError ? <FieldError>{tr('auth.error.emailInvalid')}</FieldError> : null}
            </View>
            <View>
              <Field
                ref={passwordRef}
                label={tr('auth.field.password')}
                value={password}
                onChangeText={setPassword}
                onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                editable={!inputsDisabled}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={isSignUp ? 'new-password' : 'password'}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              {showPasswordError ? <FieldError>{tr('auth.error.passwordShort')}</FieldError> : null}
            </View>
          </View>

          {/* Forgot password — sign-in only. Triggers requestReset directly
              against the email field above; ResetPasswordScreen is reserved
              for the deep-link confirm flow + signed-in password change. */}
          {!isSignUp && (
            <Pressable
              onPress={handleForgotPassword}
              disabled={inputsDisabled || resetSubmitting}
              style={{
                alignSelf: 'flex-end',
                marginTop: 10,
                paddingVertical: 4,
                opacity: inputsDisabled || resetSubmitting ? 0.5 : 1,
              }}
              accessibilityRole="link"
              hitSlop={6}>
              <Text
                style={{
                  fontFamily: fonts.uiMed,
                  fontSize: 12.5,
                  color: t.fg2,
                  letterSpacing: -0.1,
                }}>
                {tr('auth.forgotPassword')}
              </Text>
            </Pressable>
          )}

          {/* Primary CTA */}
          <View style={{ marginTop: 18 }}>
            <Button
              label={isSignUp ? tr('auth.signUp.cta') : tr('auth.signIn.cta')}
              variant="accent"
              block
              onPress={handleSubmit}
              disabled={!canSubmit}
              leadingIcon={
                submitting ? <ActivityIndicator size="small" color={t.accentFg} /> : undefined
              }
            />
          </View>

          {/* Terms — sign-up only.
              M40: the static "By continuing you agree to our Terms" caption
              now exposes Terms + Privacy as discrete tappable links so the
              user can read the legal copy before completing sign-up. App
              Review treats an unreachable Terms link as a 5.1.1 rejection
              risk — surfacing both screens here matches the Paywall pattern
              and keeps a single sign-up disclosure visible. */}
          {isSignUp && (
            <View style={{ marginTop: 12, alignItems: 'center', gap: 6 }}>
              <Caption style={{ textAlign: 'center', maxWidth: 280, letterSpacing: 0 }}>
                {tr('auth.signUp.terms')}
              </Caption>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Pressable
                  onPress={() => nav.navigate('Terms')}
                  accessibilityRole="link"
                  accessibilityLabel={tr('auth.signUp.terms.label')}
                  hitSlop={6}>
                  <Text
                    style={{
                      fontFamily: fonts.uiSemi,
                      fontSize: 12.5,
                      color: t.fg2,
                      letterSpacing: -0.1,
                      textDecorationLine: 'underline',
                    }}>
                    {tr('auth.signUp.terms.link')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => nav.navigate('PrivacyPolicy')}
                  accessibilityRole="link"
                  accessibilityLabel={tr('auth.signUp.privacy.label')}
                  hitSlop={6}>
                  <Text
                    style={{
                      fontFamily: fonts.uiSemi,
                      fontSize: 12.5,
                      color: t.fg2,
                      letterSpacing: -0.1,
                      textDecorationLine: 'underline',
                    }}>
                    {tr('auth.signUp.privacy.link')}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Divider */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginVertical: 22,
              gap: 12,
            }}>
            <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
            <Text
              style={{
                fontFamily: fonts.uiMed,
                fontSize: 11.5,
                color: t.fg3,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}>
              {tr('auth.divider.or')}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
          </View>

          {/* Google */}
          <Pressable
            onPress={handleGoogle}
            disabled={inputsDisabled}
            accessibilityRole="button"
            accessibilityLabel={tr('auth.google')}
            style={({ pressed }) => ({
              height: 44,
              borderRadius: radii.pill,
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: t.border2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: inputsDisabled ? 0.5 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <GoogleIcon size={18} />
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 13,
                color: t.fg,
                letterSpacing: -0.13,
              }}>
              {tr('auth.google')}
            </Text>
          </Pressable>

          {/* Toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 28,
              gap: 6,
            }}>
            <Text
              style={{
                fontFamily: fonts.uiMed,
                fontSize: 12.5,
                color: t.fg2,
                letterSpacing: -0.1,
              }}>
              {isSignUp ? tr('auth.toggle.haveAccount') : tr('auth.toggle.noAccount')}
            </Text>
            <Pressable
              onPress={() => {
                if (submitting) return;
                hapticSelection();
                setMode(isSignUp ? 'signIn' : 'signUp');
                setTouched({});
              }}
              disabled={submitting}
              accessibilityRole="link"
              hitSlop={6}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 12.5,
                  color: t.accent,
                  letterSpacing: -0.1,
                  opacity: submitting ? 0.5 : 1,
                }}>
                {isSignUp ? tr('auth.toggle.toSignIn') : tr('auth.toggle.toSignUp')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field — label-on-top input row matching the editorial design vocabulary.
// forwardRef so AuthScreen can chain focus from one field to the next.

type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };

const Field = React.forwardRef<TextInput, FieldProps>(({ label, ...rest }, ref) => {
  const t = useTokens();
  return (
    <View>
      <Eyebrow style={{ marginBottom: 6 }}>{label}</Eyebrow>
      <TextInput
        ref={ref}
        {...rest}
        placeholderTextColor={t.fg3}
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
          opacity: rest.editable === false ? 0.6 : 1,
        }}
      />
    </View>
  );
});
Field.displayName = 'Field';

function FieldError({ children }: { children: React.ReactNode }) {
  const t = useTokens();
  return (
    <Text
      style={{
        marginTop: 6,
        marginLeft: 4,
        fontFamily: fonts.uiMed,
        fontSize: 12,
        color: t.destructive,
        letterSpacing: -0.1,
      }}>
      {children}
    </Text>
  );
}
