// Tiny banner pinned under the system status bar when the app is offline AND
// has at least one queued mutation waiting to replay. Both conditions matter:
// "offline with no pending work" is uninteresting noise; "online with pending"
// is a transient state the queue is already resolving (we show it briefly
// only if the count is non-zero AND the user is offline).
//
// Single token surface (accent + accentSoft + accentFg), so it visually
// matches the rest of the warm-gold accent system without introducing a new
// brand color.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

export function OfflineBanner() {
  const t = useTokens();
  const { pending, isOnline } = useOfflineQueue();

  if (isOnline) return null;
  if (pending === 0) return null;

  const label =
    pending === 1
      ? '1 change saved offline — will retry when back online.'
      : `${pending} changes saved offline — will retry when back online.`;

  return (
    <View style={[styles.wrap, { backgroundColor: t.accentSoft, borderColor: t.accent }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      <Text style={[styles.text, { color: t.accent, fontFamily: fonts.uiSemi }]}
        numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    letterSpacing: -0.1,
    lineHeight: 16,
  },
});
