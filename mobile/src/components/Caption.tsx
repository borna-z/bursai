import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { text } from '../theme/tokens';

export function Caption({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  /** Forwarded to the inner <Text>. Optional — when omitted the caption
   *  wraps freely. Used by long-form rationale callers (e.g. M22
   *  UnusedGarmentsScreen header) that need a hard cap on row growth. */
  numberOfLines?: number;
}) {
  const t = useTokens();
  return (
    <Text numberOfLines={numberOfLines} style={[text.caption, { color: t.fg2 }, style]}>
      {children}
    </Text>
  );
}
