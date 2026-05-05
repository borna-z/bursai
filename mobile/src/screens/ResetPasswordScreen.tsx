// Reset password — request + success states.
// Mirrors design_handoff_burs_rn/source/audit-screens.jsx ResetPasswordScreen.

import React from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, CheckIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ScreenState = 'request' | 'success';

export function ResetPasswordScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();

  const [state, setState] = React.useState<ScreenState>('request');
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Track in-flight timer + mounted flag so we don't setState after unmount.
  // Codex audit P1.4. The ref pattern survives unmount during the 700ms mock delay; once
  // supabase.auth.resetPasswordForEmail() is wired, the same guard prevents promise
  // resolution from updating an unmounted component.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSubmit = () => {
    if (!isEmailValid) return;
    setSubmitting(true);
    // TODO: replace with supabase.auth.resetPasswordForEmail() once mobile auth bridge lands.
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setSubmitting(false);
      setState('success');
    }, 700);
  };

  // `mailto:` opens compose, not the inbox — no public scheme exists for "open inbox".
  // Honest label below ("Open mail to compose") matches what the OS will actually do.
  // Codex audit P1.6.
  const handleOpenMail = () => {
    Linking.openURL('mailto:').catch(() => {});
  };

  const handleResend = () => {
    setState('request');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* ============ HEADER ============ */}
          <View style={s.headerRow}>
            <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
              <BackIcon color={t.fg} />
            </IconBtn>
            <View style={{ flex: 1 }}>
              <PageTitle>Reset password</PageTitle>
            </View>
          </View>

          {state === 'request' ? (
            <View style={{ gap: 18 }}>
              <View style={{ gap: 6 }}>
                <Eyebrow>Forgot your password?</Eyebrow>
                <Caption>Enter your email and we&rsquo;ll send a reset link.</Caption>
              </View>

              <View style={[s.input, { backgroundColor: t.bg2, borderColor: t.border }]}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={t.fg3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                  style={{ flex: 1, color: t.fg, fontFamily: fonts.uiMed, fontSize: 14, padding: 0 }}
                />
              </View>

              <Button
                label={submitting ? 'Sending…' : 'Send reset link'}
                variant="accent"
                block
                disabled={!isEmailValid || submitting}
                onPress={handleSubmit}
              />

              <Pressable accessibilityRole="link" onPress={() => nav.goBack()} hitSlop={6}>
                <Text
                  style={{
                    fontFamily: fonts.uiMed,
                    fontSize: 12.5,
                    color: t.fg2,
                    textAlign: 'center',
                    paddingVertical: 8,
                    letterSpacing: -0.1,
                  }}>
                  Back to sign in
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 18, alignItems: 'center', paddingTop: 20 }}>
              <View style={[s.successBadge, { backgroundColor: t.accent }]}>
                <CheckIcon color={t.accentFg} size={32} />
              </View>
              <Text
                style={{
                  fontFamily: fonts.displayMedium,
                  fontStyle: 'italic',
                  fontSize: 26,
                  fontWeight: '500',
                  color: t.fg,
                  letterSpacing: -0.26,
                  textAlign: 'center',
                }}>
                Check your inbox
              </Text>
              <Caption style={{ textAlign: 'center', maxWidth: 280 }}>
                We sent a reset link to{' '}
                <Text style={{ color: t.fg, fontFamily: fonts.uiSemi }}>{email}</Text>
                . It expires in 1 hour.
              </Caption>

              <Button label="Open mail app" variant="accent" block onPress={handleOpenMail} />
              <Pressable accessibilityRole="link" onPress={handleResend} hitSlop={6}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 12.5,
                    color: t.accent,
                    paddingVertical: 8,
                    letterSpacing: -0.1,
                  }}>
                  Resend link
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  input: {
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
