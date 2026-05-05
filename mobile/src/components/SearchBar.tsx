// Pill-shaped search input — matches design_handoff_burs_rn/source/styles.css `.search-bar`.
// Used as a tappable pressable on Wardrobe (pushes a real search route) and as a true
// TextInput on Search itself. Default behaviour is the pressable button.

import React from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { SearchIcon } from './icons';

type CommonProps = {
  placeholder: string;
  style?: StyleProp<ViewStyle>;
};

type ButtonProps = CommonProps & {
  onPress: () => void;
  editable?: false;
  value?: never;
  onChangeText?: never;
};

type InputProps = CommonProps & {
  editable: true;
  value: string;
  onChangeText: (v: string) => void;
  onPress?: never;
};

export function SearchBar(props: ButtonProps | InputProps) {
  const t = useTokens();

  const shellStyle = {
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: t.bg2,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  };

  if (props.editable) {
    return (
      <View style={[shellStyle, props.style]}>
        <SearchIcon color={t.fg2} />
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={t.fg3}
          style={{
            flex: 1,
            color: t.fg,
            fontFamily: fonts.uiMed,
            fontSize: 13,
            padding: 0,
          }}
          returnKeyType="search"
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.placeholder}
      onPress={props.onPress}
      style={({ pressed }) => [
        shellStyle,
        { opacity: pressed ? 0.85 : 1 },
        props.style,
      ]}>
      <SearchIcon color={t.fg2} />
      <Text style={{ color: t.fg3, fontFamily: fonts.uiMed, fontSize: 13 }} numberOfLines={1}>
        {props.placeholder}
      </Text>
    </Pressable>
  );
}
