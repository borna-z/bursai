// Result body for OutfitGenerateScreen — extracted in Phase 3 polish.
//
// Renders three sub-branches the orchestrator selects between via prop
// signals (anchorMissed / itemCount === 0 / normal result). The
// orchestrator continues to own data fetch, mutations, and navigation;
// this component is a pure-render surface that maps resolved props to
// the existing layout (2×2 preview grid + chip row + actions).
//
// Behaviour parity rules:
//   • All actions are passed in as handlers — no haptics fire here that
//     didn't fire in the inlined version (the parent's handlers already
//     emit `hapticLight()` / `hapticSuccess()` where the original code
//     did).
//   • `previewGarmentBySlot` is computed by the parent so we don't
//     re-fetch hydration data per render.
//   • SLOT_LABELS / ChipPill stay co-located here since they're only
//     used in this branch.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { GarmentImageTile } from '../../components/GarmentImageTile';
import type { GarmentBasic } from '../../hooks/useGarmentsByIds';
import { t as tr } from '../../lib/i18n';

const SLOT_LABELS = ['OUTER', 'TOP', 'BOTTOM', 'SHOES'];

export interface OutfitGenerateResultItem {
  garment_id?: string;
  slot?: string;
  title?: string;
  image_path?: string;
  color?: string;
}

export interface OutfitGenerateResultProps {
  anchorId: string | undefined;
  anchorMissed: boolean;
  anchorGarmentTitle: string | null | undefined;
  itemCount: number;
  outfitName: string;
  description: string | null | undefined;
  occasion: string | null | undefined;
  formality: string | null | undefined;
  subLine: string;
  items: OutfitGenerateResultItem[];
  previewGarmentBySlot: Map<string, GarmentBasic>;
  persistableItemsCount: number;
  persistPending: boolean;
  wearPending: boolean;
  savedOutfitId: string | null;
  onTryAgain: () => void;
  onRemoveAnchor: () => void;
  onWear: () => void;
  onPlan: () => void;
  onSave: () => void;
  onGeneratePool: () => void;
}

export function OutfitGenerateResult({
  anchorId,
  anchorMissed,
  anchorGarmentTitle,
  itemCount,
  outfitName,
  description,
  occasion,
  formality,
  subLine,
  items,
  previewGarmentBySlot,
  persistableItemsCount,
  persistPending,
  wearPending,
  savedOutfitId,
  onTryAgain,
  onRemoveAnchor,
  onWear,
  onPlan,
  onSave,
  onGeneratePool,
}: OutfitGenerateResultProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();

  if (anchorId && (anchorMissed || itemCount === 0)) {
    return (
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: insets.bottom + 32,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
          <Eyebrow>{tr('anchor.missed.eyebrow')}</Eyebrow>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13.5,
              lineHeight: 20,
              color: t.fg2,
              textAlign: 'center',
              letterSpacing: -0.13,
              maxWidth: 260,
            }}>
            {anchorGarmentTitle
              ? tr('anchor.missed.errorBody', { title: anchorGarmentTitle })
              : tr('anchor.missed.errorBodyFallback')}
          </Text>
        </View>
        <Button label="Try again" variant="outline" onPress={onTryAgain} block />
        <Button label={tr('anchor.removeAnchor')} variant="quiet" onPress={onRemoveAnchor} block />
      </ScrollView>
    );
  }

  if (itemCount === 0) {
    return (
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: insets.bottom + 32,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
          <Eyebrow>No matching pieces</Eyebrow>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13.5,
              lineHeight: 20,
              color: t.fg2,
              textAlign: 'center',
              letterSpacing: -0.13,
              maxWidth: 260,
            }}>
            {description
              || 'Your wardrobe doesn’t yet cover this look. Add more garments or try a different anchor.'}
          </Text>
        </View>
        <Button label="Try again" variant="outline" onPress={onTryAgain} block />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: insets.bottom + 32,
        gap: 14,
      }}
      showsVerticalScrollIndicator={false}>
      <PageTitle style={{ textAlign: 'center', fontSize: 24 }}>{outfitName}</PageTitle>

      {anchorId ? (
        <View
          style={[
            s.anchorRow,
            {
              backgroundColor: anchorMissed ? t.bg2 : t.card,
              borderColor: anchorMissed ? t.destructive : t.accent,
            },
          ]}>
          <Text style={[s.anchorEyebrow, { color: anchorMissed ? t.destructive : t.accent }]}>
            {tr(anchorMissed ? 'anchor.missed.eyebrow' : 'anchor.locked.eyebrow')}
          </Text>
          <Text style={[s.anchorTitle, { color: t.fg }]} numberOfLines={1}>
            {anchorGarmentTitle ?? tr('anchor.locked.fallback')}
          </Text>
        </View>
      ) : null}

      <View style={s.grid}>
        {[0, 1, 2, 3].map((i) => {
          const item = items[i];
          const garmentId = item?.garment_id;
          const garment = garmentId ? previewGarmentBySlot.get(garmentId) ?? null : null;
          return (
            <View
              key={i}
              style={[
                s.gridCell,
                {
                  borderColor: t.border,
                },
              ]}>
              <GarmentImageTile garment={garment} iconSize={26} />
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 9,
                  letterSpacing: 1.2,
                  color: t.fg,
                  opacity: 0.7,
                  position: 'absolute',
                  bottom: 10,
                  left: 10,
                  backgroundColor: t.card,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radii.pill,
                }}>
                {item?.slot?.toUpperCase() ?? SLOT_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={s.chipRow}>
        {occasion ? <ChipPill label={occasion} /> : null}
        {formality ? <ChipPill label={formality} /> : null}
        <ChipPill label={subLine} />
      </View>

      {description ? (
        <Text
          style={{
            fontFamily: fonts.display,
            fontStyle: 'italic',
            fontSize: 14.5,
            lineHeight: 22,
            color: t.fg2,
            marginTop: 4,
          }}>
          {description}
        </Text>
      ) : null}

      <Button
        label={wearPending ? tr('outfitGenerate.wear.busy') : tr('outfitGenerate.wear.action')}
        onPress={onWear}
        disabled={persistPending || wearPending || persistableItemsCount === 0}
        block
        style={{ marginTop: 8 }}
      />
      <Button
        label={tr('outfitGenerate.plan.action')}
        variant="outline"
        onPress={onPlan}
        disabled={persistPending || wearPending || persistableItemsCount === 0}
        block
      />
      <Button
        label={
          savedOutfitId
            ? tr('outfitGenerate.save.saved')
            : persistPending
              ? tr('outfitGenerate.save.busy')
              : tr('outfitGenerate.save.action')
        }
        variant={savedOutfitId ? 'accent' : 'outline'}
        onPress={onSave}
        disabled={persistPending || Boolean(savedOutfitId) || persistableItemsCount === 0}
        block
      />
      <Button label="Try again" variant="quiet" onPress={onTryAgain} block />
      <Caption style={{ marginTop: 8, textAlign: 'center' }}>
        Want more options? Generate a pool of looks.
      </Caption>
      <Button
        label="Generate pool"
        variant="outline"
        onPress={onGeneratePool}
        block
      />
      {anchorId ? (
        <Button label={tr('anchor.removeAnchor')} variant="outline" onPress={onRemoveAnchor} block />
      ) : null}
    </ScrollView>
  );
}

function ChipPill({ label }: { label: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        height: 26,
        paddingHorizontal: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 10.5,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: t.fg,
        }}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridCell: {
    width: '48.5%',
    aspectRatio: 0.85,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  anchorRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 2,
  },
  anchorEyebrow: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  anchorTitle: {
    fontFamily: fonts.uiMed,
    fontSize: 13,
    letterSpacing: -0.13,
  },
});
