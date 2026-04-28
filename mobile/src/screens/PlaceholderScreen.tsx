// Generic "coming soon" placeholder used by every route that isn't yet implemented.
// Renders the design system vocabulary (eyebrow + italic title + body) so the route
// looks intentional during the build-out, not like a missing page.

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { BackIcon } from '../components/icons';

export function PlaceholderScreen({
  eyebrow,
  title,
  body,
  showBack = true,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  showBack?: boolean;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const canGoBack = nav.canGoBack();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {showBack && canGoBack && (
        <Pressable
          onPress={() => nav.goBack()}
          accessibilityLabel="Back"
          style={{
            position: 'absolute',
            top: insets.top + 6,
            left: 16,
            zIndex: 10,
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.card,
            borderWidth: 1,
            borderColor: t.border,
          }}>
          <BackIcon color={t.fg} />
        </Pressable>
      )}
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingHorizontal: 20,
          paddingBottom: 130,
          gap: 14,
        }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <PageTitle>{title}</PageTitle>
        <Text style={{ fontSize: 13.5, color: t.fg2, lineHeight: 20, fontFamily: fonts.ui, marginTop: 6 }}>
          {body ?? 'This screen is coming in a follow-up PR. The route is wired and ready — only the visual implementation is pending.'}
        </Text>
      </ScrollView>
    </View>
  );
}
