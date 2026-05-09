// Settings · Edit profile (N3.9) — name editor reachable from the
// SettingsAccount Full Name row + the avatar Edit Photo link.
//
// Why this screen exists: prior to N3.9 the Full Name and Edit Photo CTAs
// in SettingsAccountScreen popped Alert("Coming Soon") dialogs. Apple App
// Review's review for the launch build flagged that as a hard blocker —
// users must be able to change their own display name in-app. This screen
// is the smallest viable path to compliance.
//
// Scope (deliberately narrow):
//   • Display-name edit lands end-to-end (TextInput → useUpdateProfile →
//     Supabase `profiles.display_name` → AuthContext.refreshProfile).
//   • Validation: 1..60 chars after trim. Save button is disabled when
//     invalid OR when the trimmed value matches the current profile (no
//     point hitting the API for a no-op).
//   • Photo edit is intentionally NOT persisted. The avatars bucket was
//     dropped 2026-04-21 (mobile/CLAUDE.md) and there is no
//     `profiles.avatar_url` column. We surface a non-blocking "available
//     in a future update" caption next to the photo affordance instead of
//     silently writing a local URI that wouldn't survive a reinstall.
//
// Layout follows EditGarmentScreen's header pattern (Cancel · centred
// eyebrow + title · Save) so the screen reads as a sibling editor in the
// settings stack.

import React from 'react';
import {
  ActivityIndicator,
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
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import {
  DISPLAY_NAME_MAX_LEN,
  useUpdateProfile,
} from '../hooks/useUpdateProfile';
import { hapticLight } from '../lib/haptics';
import { t as tr } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsProfileEditScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const updateProfile = useUpdateProfile();

  const initialName = profile?.display_name ?? '';
  const [name, setName] = React.useState(initialName);

  // If the profile loads in late (cold-start race), re-seed the input once
  // — but only while the user hasn't typed anything custom. Mirrors the
  // hydration guard in EditGarmentScreen so a slow profile fetch doesn't
  // overwrite an active edit.
  const seededRef = React.useRef(initialName !== '');
  React.useEffect(() => {
    if (seededRef.current) return;
    if (profile?.display_name) {
      setName(profile.display_name);
      seededRef.current = true;
    }
  }, [profile?.display_name]);

  const trimmed = name.trim();
  const isValid = trimmed.length >= 1 && trimmed.length <= DISPLAY_NAME_MAX_LEN;
  const isDirty = trimmed !== (profile?.display_name ?? '').trim();
  const saveDisabled = !isValid || !isDirty || updateProfile.isPending;

  const handleSave = () => {
    if (saveDisabled) return;
    hapticLight();
    updateProfile.mutate(
      { display_name: trimmed },
      {
        onSuccess: () => {
          nav.goBack();
        },
        onError: (err) => {
          Alert.alert(
            tr('settings.profileEdit.error.title'),
            err instanceof Error
              ? err.message
              : tr('settings.profileEdit.error.body'),
          );
        },
      },
    );
  };

  // Avatar circle mirrors the SettingsAccount profile card so the user has
  // a visual anchor while editing the name. Initial is computed from the
  // CURRENT input, not the persisted name, so they get an instant preview
  // of what the rest of the app will show after Save.
  const initial = (trimmed.charAt(0) || 'U').toUpperCase();
  const email = user?.email ?? '';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        {/* Cancel · centred eyebrow+title · Save — same shape as
            EditGarmentScreen so this reads as a sibling editor. */}
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <Pressable
            onPress={() => nav.goBack()}
            accessibilityRole="button"
            accessibilityLabel={tr('common.cancel')}
            hitSlop={8}>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2 }}>
              {tr('common.cancel')}
            </Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>{tr('settings.profileEdit.eyebrow')}</Eyebrow>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 18,
                lineHeight: 22,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.18,
              }}>
              {tr('settings.profileEdit.title')}
            </Text>
          </View>
          <Pressable
            onPress={handleSave}
            disabled={saveDisabled}
            accessibilityLabel={tr('settings.profileEdit.save')}
            accessibilityRole="button"
            accessibilityState={{
              disabled: saveDisabled,
              busy: updateProfile.isPending,
            }}
            hitSlop={8}
            style={{
              opacity: saveDisabled ? 0.5 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}>
            {updateProfile.isPending ? (
              <ActivityIndicator size="small" color={t.accent} />
            ) : null}
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 13,
                color: t.accent,
                fontWeight: '600',
              }}>
              {tr('settings.profileEdit.save')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Identity preview — same layout as the profile card on the
              SettingsAccount screen so saving feels like a 1:1 update of
              what the user just saw. */}
          <Card hero padding={18}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[s.avatar, { backgroundColor: t.accent }]}>
                <Text
                  style={{
                    color: t.accentFg,
                    fontFamily: fonts.uiSemi,
                    fontSize: 26,
                    fontWeight: '600',
                  }}>
                  {initial}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.displayMedium,
                    fontStyle: 'italic',
                    fontSize: 18,
                    fontWeight: '500',
                    color: t.fg,
                    letterSpacing: -0.18,
                  }}>
                  {trimmed || tr('settings.profile.fallbackName')}
                </Text>
                {email ? <Caption>{email}</Caption> : null}
              </View>
            </View>
          </Card>

          {/* Name field. Single TextInput inside a Card to match the form
              styling other settings editors use. The label uses Eyebrow
              for typographic continuity with EditGarment's FieldLabel. */}
          <View style={{ gap: 8 }}>
            <Eyebrow>{tr('settings.profileEdit.section.name')}</Eyebrow>
            <Card padding={14}>
              <Eyebrow style={{ marginBottom: 8 }}>
                {tr('settings.profileEdit.field.displayName')}
              </Eyebrow>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={tr('settings.profileEdit.field.displayName.placeholder')}
                placeholderTextColor={t.fg3}
                maxLength={DISPLAY_NAME_MAX_LEN}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                accessibilityLabel={tr('settings.profileEdit.field.displayName')}
                style={[
                  s.input,
                  { backgroundColor: t.bg2, borderColor: t.border, color: t.fg },
                ]}
              />
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: 11.5,
                  lineHeight: 15,
                  color: t.fg2,
                  marginTop: 8,
                  letterSpacing: -0.05,
                }}>
                {tr('settings.profileEdit.field.displayName.helper')}
              </Text>
            </Card>
          </View>

          {/* Photo affordance — deferred. The avatars bucket was dropped
              2026-04-21 and there's no `profiles.avatar_url` column to
              persist into. Surfacing the deferral inline is friendlier
              than the prior "Coming Soon" alert and gives App Review a
              clear signal that the name path is the live edit. */}
          <View style={{ gap: 8 }}>
            <Eyebrow>{tr('settings.profileEdit.section.photo')}</Eyebrow>
            <Card padding={14}>
              <Text
                style={{
                  fontFamily: fonts.uiMed,
                  fontSize: 13,
                  color: t.fg,
                  letterSpacing: -0.1,
                }}>
                {tr('settings.profileEdit.photo.deferred.title')}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: 11.5,
                  lineHeight: 15,
                  color: t.fg2,
                  marginTop: 6,
                  letterSpacing: -0.05,
                }}>
                {tr('settings.profileEdit.photo.deferred.body')}
              </Text>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    fontFamily: fonts.uiMed,
    fontSize: 13,
  },
});
