import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { text } from '../theme/tokens';

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTokens();
  return <Text style={[text.eyebrow, { color: t.fg2, opacity: 0.7 }, style]}>{children}</Text>;
}
