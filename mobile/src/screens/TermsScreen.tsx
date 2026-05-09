// TermsScreen — App Store launch blocker (M40).
//
// Mirrors PrivacyPolicyScreen's structure (Eyebrow + PageTitle + last-updated
// label, hero intro card, section list, web-version fallback link). Body copy
// comes from `lib/legalContent` so the screen itself stays a thin renderer.
//
// Apple Guideline 3.1.2 + 3.1.1 require subscription auto-renewal and refund
// disclosures plus a Terms of Use surface. PaywallScreen renders the verbatim
// renewal disclosures inline and links here for the fuller terms.

import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { IconBtn } from '../components/IconBtn';
import { BackIcon } from '../components/icons';
import { t as tr, useTranslation } from '../lib/i18n';
import { hapticLight } from '../lib/haptics';
import { getTermsDocument } from '../lib/legalContent';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TermsScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { locale } = useTranslation();
  const doc = getTermsDocument(locale);

  const onWebVersion = () => {
    hapticLight();
    Linking.openURL(tr('legal.webTermsUrl')).catch(() => {
      Alert.alert(tr('legal.webError.title'), tr('legal.webError.body'));
    });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel={tr('common.back')} onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{tr('legal.terms.eyebrow')}</Eyebrow>
            <PageTitle>{doc.title}</PageTitle>
            <Caption style={{ marginTop: 6, letterSpacing: 0 }}>{doc.lastUpdatedLabel}</Caption>
          </View>
        </View>

        {/* ============ INTRO ============ */}
        <Card hero padding={18}>
          <Text
            style={{
              fontFamily: fonts.uiMed,
              fontSize: 14,
              lineHeight: 21,
              color: t.fg,
              letterSpacing: -0.1,
            }}>
            {doc.intro}
          </Text>
        </Card>

        {/* ============ SECTIONS ============ */}
        {doc.sections.map((section) => (
          <View key={section.heading} style={{ gap: 8 }}>
            <Eyebrow>{section.heading}</Eyebrow>
            {section.paragraphs.map((para, idx) => (
              <Text
                key={idx}
                style={{
                  fontFamily: fonts.uiMed,
                  fontSize: 13.5,
                  lineHeight: 20,
                  color: t.fg2,
                  letterSpacing: -0.05,
                }}>
                {para}
              </Text>
            ))}
          </View>
        ))}

        {/* ============ WEB FALLBACK ============ */}
        <View style={{ alignItems: 'center', paddingTop: 12 }}>
          <Pressable
            onPress={onWebVersion}
            accessibilityRole="link"
            accessibilityLabel={tr('legal.webVersion.label')}
            hitSlop={6}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 12,
                color: t.fg3,
                letterSpacing: -0.1,
                textDecorationLine: 'underline',
              }}>
              {tr('legal.webVersion')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
});
