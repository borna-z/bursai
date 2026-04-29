import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export function PageTitle({ children, size = 28, style }: { children: React.ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  const t = useTokens();
  return (
    <Text
      style={[
        {
          fontFamily: fonts.displayMedium,
          fontStyle: 'italic',
          fontSize: size,
          lineHeight: size * 1.1,
          letterSpacing: -size * 0.01,
          color: t.fg,
          fontWeight: '500',
        },
        style,
      ]}>
      {children}
    </Text>
  );
}
