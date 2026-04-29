import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { text } from '../theme/tokens';

export function Caption({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTokens();
  return <Text style={[text.caption, { color: t.fg2 }, style]}>{children}</Text>;
}
