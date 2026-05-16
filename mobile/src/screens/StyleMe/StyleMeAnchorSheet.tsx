// Anchor garment picker sheet for StyleMeScreen — extracted in Phase 3
// polish. Modal `isOpen` / `onClose` stay in the orchestrator; the sheet
// is a pure-render shell that wires `TravelGarmentPicker` into a
// bottom-sheet container with the same styling the inline version had.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { PageTitle } from '../../components/PageTitle';
import { TravelGarmentPicker } from '../../components/TravelGarmentPicker';
import type { Garment } from '../../types/garment';
import { t as tr } from '../../lib/i18n';

export interface StyleMeAnchorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  garments: Garment[];
  loading: boolean;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function StyleMeAnchorSheet({
  isOpen,
  onClose,
  garments,
  loading,
  selectedIds,
  onChange,
}: StyleMeAnchorSheetProps) {
  const t = useTokens();
  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalSheetTall, { backgroundColor: t.bg, borderColor: t.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <PageTitle size={20}>{tr('styleMe.anchor.sheetTitle')}</PageTitle>
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text style={{ fontFamily: fonts.uiMed, fontSize: 14, color: t.accent }}>
                {tr('styleMe.anchor.sheetClose')}
              </Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TravelGarmentPicker
              garments={garments}
              selectedIds={selectedIds}
              onChange={onChange}
              max={1}
              loading={loading}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheetTall: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
  },
});
