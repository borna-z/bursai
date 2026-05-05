import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTokens } from '../theme/ThemeProvider';

// Standard card surface. Hero variant adds a soft gold radial accent at the top-right
// (RN can't do CSS radial-gradient, so we approximate with an absolute LinearGradient overlay
// that fades down-left from accent-soft to transparent — visually equivalent in the corner glow).
export function Card({
  children,
  hero = false,
  padding = 16,
  style,
}: {
  children: React.ReactNode;
  hero?: boolean;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  const radius = hero ? 24 : 18;
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: t.border,
          padding,
          overflow: 'hidden',
          ...(hero ? {
            shadowColor: t.shadow.color,
            shadowOffset: t.shadow.offset,
            shadowRadius: t.shadow.radius,
            shadowOpacity: t.shadow.opacity,
            elevation: 6,
          } : null),
        },
        style,
      ]}>
      {hero && (
        <LinearGradient
          colors={[t.accentSoft, 'rgba(0,0,0,0)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.3, y: 0.6 }}
          style={{ position: 'absolute', top: 0, right: 0, width: '70%', height: '60%' }}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}
