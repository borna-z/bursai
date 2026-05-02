// AuthScreen — sign-in / sign-up toggle. Single screen, two modes.
// KeyboardAvoidingView wraps the form so the keyboard doesn't obscure inputs on iOS.
//
// No real auth wired yet — the CTA stubs are TODOs. Once Supabase auth lands,
// replace `handleSubmit` with `supabase.auth.signInWithPassword` / `signUp` and
// `handleGoogle` with the OAuth flow.

import React, { useRef, useState } from 'react';
import {
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
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Ref chain for keyboard "Next" focus advancement (P1-9).
  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);

  const isSignUp = mode === 'signUp';
  const canSubmit = email.trim().length > 0 && password.length >= 6 && (!isSignUp || name.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit) return;
    hapticLight();
    // TODO(auth): wire to Supabase. Until real auth lands, both stub paths
    // route through Onboarding — sign-in's "skip onboarding for returning
    // users" decision lives behind real session check (P0-4 from review).
    nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  const handleGoogle = () => {
    hapticLight();
    // TODO(auth): wire OAuth. Stub routes through onboarding — same reason
    // as `handleSubmit`.
    nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

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
              <Field
                label={tr('auth.field.name')}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            )}
            <Field
              ref={emailRef}
              label={tr('auth.field.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Field
              ref={passwordRef}
              label={tr('auth.field.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={isSignUp ? 'new-password' : 'password'}
              textContentType={isSignUp ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {/* Forgot password — sign-in only */}
          {!isSignUp && (
            <Pressable
              onPress={() => { hapticLight(); nav.navigate('ResetPassword'); }}
              style={{ alignSelf: 'flex-end', marginTop: 10, paddingVertical: 4 }}
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
            />
          </View>

          {/* Terms — sign-up only */}
          {isSignUp && (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <Caption style={{ textAlign: 'center', maxWidth: 280, letterSpacing: 0 }}>
                {tr('auth.signUp.terms')}
              </Caption>
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
              onPress={() => { hapticSelection(); setMode(isSignUp ? 'signIn' : 'signUp'); }}
              accessibilityRole="link"
              hitSlop={6}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 12.5,
                  color: t.accent,
                  letterSpacing: -0.1,
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
        }}
      />
    </View>
  );
});
Field.displayName = 'Field';
