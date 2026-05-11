// OutfitDetailScreen — top header bar (N13 split).
//
// Back affordance + centered Eyebrow/Title + Share + More-options menu.

import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { IconBtn } from '../components/IconBtn';
import { BackIcon, MoreIcon, ShareIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';

export function OutfitDetailHeader({
  title,
  isSharing,
  onBack,
  onShare,
  onAddToPlan,
  onDelete,
}: {
  title: string;
  isSharing: boolean;
  onBack: () => void;
  onShare: () => void;
  onAddToPlan: () => void;
  onDelete: () => void;
}) {
  const t = useTokens();
  return (
    <View style={[s.headerRow, { borderBottomColor: t.border }]}>
      <IconBtn ariaLabel="Back" onPress={onBack} variant="ghost">
        <BackIcon color={t.fg} />
      </IconBtn>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Eyebrow>Outfit</Eyebrow>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 18,
            lineHeight: 22,
            fontWeight: '500',
            color: t.fg,
            letterSpacing: -0.18,
          }}>
          {title}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <IconBtn
          ariaLabel={tr('outfit.detail.share.aria')}
          variant="ghost"
          onPress={isSharing ? undefined : onShare}>
          <ShareIcon color={t.fg} />
        </IconBtn>
        <IconBtn
          ariaLabel="More options"
          variant="ghost"
          onPress={() =>
            Alert.alert('Options', undefined, [
              { text: 'Add to plan', onPress: onAddToPlan },
              { text: 'Delete outfit', style: 'destructive', onPress: onDelete },
              { text: 'Cancel', style: 'cancel' },
            ])
          }>
          <MoreIcon color={t.fg} />
        </IconBtn>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
});
