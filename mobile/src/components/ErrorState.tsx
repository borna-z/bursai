// Error state — rendered when a screen's mock data load (or future API call) fails.
// Centered SVG warning glyph, italic Playfair "Something went wrong", caption with
// "Pull down to try again", outline Retry button.
//
// Drop into any data-driven screen behind an `error` boolean — keeps the error-recovery
// vocabulary identical across the app.

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Button } from './Button';
import { Caption } from './Caption';

function WarningGlyph({ color, size = 56 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.5} />
      <Line x1="12" y1="7.5" x2="12" y2="13" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx="12" cy="16" r="0.9" fill={color} />
    </Svg>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  body = 'Pull down to try again.',
  onRetry,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  // Optional second action — surfaced as a quiet button below Retry. The
  // batch Add-piece flow uses this to offer "Skip this photo" alongside
  // Retry so a single bad photo doesn't sink the whole multi-photo session.
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  return (
    <View style={[s.wrap, style]} accessibilityLiveRegion="polite">
      <View style={[s.iconWrap, { backgroundColor: t.accentSoft }]}>
        <WarningGlyph color={t.accent} />
      </View>
      <Text
        style={{
          marginTop: 18,
          fontFamily: fonts.displayMedium,
          fontStyle: 'italic',
          fontSize: 22,
          fontWeight: '500',
          color: t.fg,
          letterSpacing: -0.22,
          textAlign: 'center',
        }}>
        {title}
      </Text>
      <Caption style={{ textAlign: 'center', marginTop: 6, maxWidth: 240 }}>{body}</Caption>
      {onRetry ? (
        <View style={{ marginTop: 18, gap: 8, alignItems: 'center' }}>
          <Button label="Retry" variant="outline" onPress={onRetry} />
          {secondaryActionLabel && onSecondaryAction ? (
            <Button label={secondaryActionLabel} variant="quiet" onPress={onSecondaryAction} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
