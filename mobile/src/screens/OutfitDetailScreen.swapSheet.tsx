// OutfitDetailScreen — M37 Swap candidate bottom sheet (N13 split).
//
// Modal-based to stay consistent with the rest of the screen (Alert.alert
// + inline Modal); a more elaborate @gorhom/bottom-sheet wasn't in deps
// when this wave shipped and isn't justified for a single picker. The
// sheet renders a list of garments whose canonical slot matches the row
// being swapped — already-attached garments are excluded by
// useSwapGarment.

import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { useGarmentImage } from '../hooks/useSignedUrl';
import { t as tr } from '../lib/i18n';
import { outfitGradientHue } from '../lib/outfitDisplay';
import type { SwapCandidate } from '../hooks/useSwapGarment';

export function SwapCandidateSheet({
  slotLabelKey,
  isLoading,
  isSwapping,
  candidates,
  error,
  onClose,
  onSelect,
}: {
  slotLabelKey: string;
  isLoading: boolean;
  isSwapping: boolean;
  candidates: SwapCandidate[];
  error: string | null;
  onClose: () => void;
  onSelect: (garmentId: string) => void;
}) {
  const t = useTokens();
  const labelKey = `outfitDetail.slot.${slotLabelKey}`;
  const localized = tr(labelKey);
  const slotLabel =
    localized && localized !== labelKey
      ? localized
      : slotLabelKey.toUpperCase();

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose} accessible={false}>
        <View />
      </Pressable>
      <View style={[s.sheetContainer, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[s.sheetHandle, { backgroundColor: t.border }]} />
        <View style={s.sheetHeader}>
          <Eyebrow>{tr('outfitDetail.swap.title', { slot: slotLabel })}</Eyebrow>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tr('outfitDetail.swap.cancel')}
            hitSlop={6}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 11,
                letterSpacing: 1.4,
                color: t.fg2,
                textTransform: 'uppercase',
              }}>
              {tr('outfitDetail.swap.cancel')}
            </Text>
          </Pressable>
        </View>
        {isLoading ? (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator color={t.accent} />
            <Text style={[s.sectionEmpty, { color: t.fg2, marginTop: 8 }]}>
              {tr('outfitDetail.swap.loading')}
            </Text>
          </View>
        ) : error ? (
          <Text style={[s.sectionEmpty, { color: t.fg2 }]}>{error}</Text>
        ) : candidates.length === 0 ? (
          <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
            {tr('outfitDetail.swap.empty')}
          </Text>
        ) : (
          <FlatList
            data={candidates}
            keyExtractor={(c) => c.garment.id}
            contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
            renderItem={({ item }) => (
              <SwapCandidateRow
                candidate={item}
                disabled={isSwapping}
                onPress={() => onSelect(item.garment.id)}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

function SwapCandidateRow({
  candidate,
  disabled,
  onPress,
}: {
  candidate: SwapCandidate;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  const garment = candidate.garment;
  const imagePath = garment.rendered_image_path ?? garment.original_image_path ?? null;
  const { uri: imageUri, onError: onImageError } = useGarmentImage(imagePath);
  const showImage = imageUri != null;
  const hue = outfitGradientHue(garment.id);
  const sub = [garment.color_primary, garment.category].filter(Boolean).join(' · ').toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={garment.title ?? 'Garment'}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.candidateRow,
        {
          backgroundColor: t.bg2,
          borderColor: t.border,
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}>
      <View style={[s.candidateThumb, { borderColor: t.border }]}>
        <LinearGradient
          colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {showImage ? (
          <Image
            source={{ uri: imageUri }}
            onError={onImageError}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 13,
            color: t.fg,
            letterSpacing: -0.13,
          }}>
          {garment.title ?? 'Garment'}
        </Text>
        {sub ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 9.5,
              color: t.fg2,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginTop: 2,
            }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sectionEmpty: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8,
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  candidateThumb: {
    width: 48,
    height: 60,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
});
