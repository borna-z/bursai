// Reset password — confirm-new-password screen.
//
// Two ways the user lands here:
//   1. Recovery deep link from email: `burs://reset-password#access_token=...`.
//      The Linking handler in App.tsx parses the hash, calls
//      supabase.auth.setSession({ access_token, refresh_token }), and React
//      Navigation routes to this screen. By the time this component mounts
//      the session is hydrated and updateUser succeeds.
//   2. Signed-in user from SettingsAccountScreen → Reset password row. They
//      already have an active session, so the same updateUser call works.
//
// Either way: enter + confirm a new password, dispatch confirmReset, then
// reset to MainTabs (the AuthContext listener routes appropriately based on
// the now-authenticated session).
//
// The "request a reset email" UI moved to AuthScreen's "Forgot password?"
// link in M12 — that flow uses the email field already on screen and shows
// a "check your email" Alert, so it doesn't need its own route.

import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { BackIcon } from '../components/icons';
import { useResetPassword } from '../hooks/useResetPassword';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MIN_PASSWORD = 6;

export function ResetPasswordScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { confirmReset } = useResetPassword();

  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [touched, setTouched] = React.useState<{ password?: boolean; confirm?: boolean }>({});

  const confirmRef = React.useRef<TextInput | null>(null);

  // Guards setState in the async finally — the post-success nav.reset can
  // unmount the screen before updateUser resolves on a slow connection.
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const passwordValid = password.length >= MIN_PASSWORD;
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = passwordValid && passwordsMatch && !submitting;

  const showPasswordError = Boolean(touched.password) && !passwordValid;
  const showConfirmError = Boolean(touched.confirm) && password.length > 0 && !passwordsMatch;

  const handleSubmit = async () => {
    setTouched({ password: true, confirm: true });
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await confirmReset(password);
      if (!mountedRef.current) return;
      if (error) {
        Alert.alert(tr('resetPassword.errorTitle'), error.message);
        return;
      }
      Alert.alert(tr('resetPassword.successTitle'), tr('resetPassword.successBody'), [
        {
          text: 'OK',
          onPress: () => {
            // Session is now valid (recovery flow set it; signed-in flow
            // already had it). AuthContext will route via MainTabs/Onboarding
            // depending on profile state.
            nav.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          },
        },
      ]);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
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
          <View style={s.headerRow}>
            <IconBtn ariaLabel={tr('resetPassword.back')} onPress={() => nav.goBack()} variant="ghost">
              <BackIcon color={t.fg} />
            </IconBtn>
            <View style={{ flex: 1 }}>
              <PageTitle>{tr('resetPassword.title')}</PageTitle>
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Eyebrow>{tr('resetPassword.eyebrow')}</Eyebrow>
            <Caption>{tr('resetPassword.intro')}</Caption>
          </View>

          <View style={{ gap: 12 }}>
            <View>
              <Eyebrow style={{ marginBottom: 6 }}>{tr('resetPassword.newPasswordLabel')}</Eyebrow>
              <View style={[s.input, { backgroundColor: t.card, borderColor: t.border }]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => setTouched((x) => ({ ...x, password: true }))}
                  editable={!submitting}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  style={{ flex: 1, color: t.fg, fontFamily: fonts.uiMed, fontSize: 14, padding: 0 }}
                />
              </View>
              {showPasswordError ? (
                <Text style={[s.errorText, { color: t.destructive }]}>
                  {tr('resetPassword.tooShort')}
                </Text>
              ) : null}
            </View>

            <View>
              <Eyebrow style={{ marginBottom: 6 }}>{tr('resetPassword.confirmPasswordLabel')}</Eyebrow>
              <View style={[s.input, { backgroundColor: t.card, borderColor: t.border }]}>
                <TextInput
                  ref={confirmRef}
                  value={confirm}
                  onChangeText={setConfirm}
                  onBlur={() => setTouched((x) => ({ ...x, confirm: true }))}
                  editable={!submitting}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  style={{ flex: 1, color: t.fg, fontFamily: fonts.uiMed, fontSize: 14, padding: 0 }}
                />
              </View>
              {showConfirmError ? (
                <Text style={[s.errorText, { color: t.destructive }]}>
                  {tr('resetPassword.mismatch')}
                </Text>
              ) : null}
            </View>
          </View>

          <Button
            label={submitting ? tr('resetPassword.submitting') : tr('resetPassword.cta')}
            variant="accent"
            block
            disabled={!canSubmit}
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
              {tr('resetPassword.back')}
            </Text>
          </Pressable>
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
  errorText: {
    marginTop: 6,
    marginLeft: 4,
    fontFamily: fonts.uiMed,
    fontSize: 12,
    letterSpacing: -0.1,
  },
});
