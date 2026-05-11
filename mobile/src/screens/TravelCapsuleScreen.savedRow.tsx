// TravelCapsuleScreen — saved capsule list row (N13 split).
//
// Compact list row — destination + date range eyebrow + (items, looks)
// caption. Tapping the body opens the capsule; tapping the trash icon
// fires a confirm prompt before delete. The row uses Card so the
// border / padding rhythm matches the rest of the screen.

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { TrashIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import type { TravelCapsuleRow } from '../hooks/useTravelCapsules';
import { formatRowDates } from './TravelCapsuleScreen.helpers';

export function SavedCapsuleRow({
  row,
  onOpen,
  onDelete,
}: {
  row: TravelCapsuleRow;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const t = useTokens();
  const dates = formatRowDates(row.start_date, row.end_date);
  const itemCount = row.packing_list.length;
  const outfitCount = row.outfits.length;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityHint={tr('travelCapsule.openSavedHint')}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <Card padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Eyebrow>{dates || row.destination}</Eyebrow>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 17,
                color: t.fg,
                letterSpacing: -0.16,
              }}>
              {row.destination}
            </Text>
            <Caption>
              {tr('travelCapsule.savedTripItemsTemplate', {
                items: itemCount,
                outfits: outfitCount,
              })}
            </Caption>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            accessibilityRole="button"
            accessibilityLabel={tr('travelCapsule.delete.aria')}
            hitSlop={8}
            style={({ pressed }) => [
              {
                width: 36,
                height: 36,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: t.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              },
            ]}>
            <TrashIcon color={t.fg2} size={16} />
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}
