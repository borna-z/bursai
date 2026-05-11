// OutfitDetailScreen — M37 slot composition list (N13 split).
//
// Vertical slotted list of garments in the outfit. Each slot exposes
// Swap / Anchor / Remove. The anchored slot renders a lock pill
// alongside its eyebrow; the lock state lives in the parent.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { OutfitSlotRow } from '../components/OutfitSlotRow';
import type { OutfitItemWithGarment } from '../types/outfit';
import type { groupGarmentsBySlot } from '../lib/outfitDisplay';

type SlotGroup = ReturnType<typeof groupGarmentsBySlot>[number];

export type SlotCompositionListProps = {
  slotGroups: SlotGroup[];
  itemCount: number;
  anchorGarmentId: string | null;
  swapTargetItemId: string | null;
  onPressItem: (garmentId: string) => void;
  onSwap: (slot: string, item: OutfitItemWithGarment) => void;
  onAnchor: (garmentId: string) => void;
  onRemove: (item: OutfitItemWithGarment) => void;
};

export function SlotCompositionList({
  slotGroups,
  itemCount,
  anchorGarmentId,
  swapTargetItemId,
  onPressItem,
  onSwap,
  onAnchor,
  onRemove,
}: SlotCompositionListProps) {
  const t = useTokens();
  return (
    <View>
      <View style={s.sectionHead}>
        <Eyebrow>Garments in this outfit</Eyebrow>
        <Text style={{ color: t.fg2, fontFamily: fonts.uiMed, fontSize: 11 }}>
          {itemCount}
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        {slotGroups.map((group) =>
          group.items.map((item) => {
            const garmentId = item.garment?.id ?? null;
            const isAnchored = !!garmentId && anchorGarmentId === garmentId;
            return (
              <OutfitSlotRow
                key={item.id}
                slot={group.slot}
                item={item}
                isAnchored={isAnchored}
                onPress={() => {
                  if (garmentId) onPressItem(garmentId);
                }}
                onSwap={() => onSwap(group.slot, item)}
                onAnchor={() => {
                  if (!garmentId) return;
                  onAnchor(garmentId);
                }}
                onRemove={() => onRemove(item)}
                swapDisabled={!!swapTargetItemId && swapTargetItemId !== item.id}
              />
            );
          }),
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
});
