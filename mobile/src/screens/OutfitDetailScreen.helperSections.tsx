// OutfitDetailScreen — M17 composition helper sections (N13 split).
//
// Renders the three collapsible helper cards (accessories, variations,
// clone-DNA) and their disclosure CTAs. Parent owns the hook state and
// passes it down — keeping render logic + lookup queries in one place.

import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Button } from '../components/Button';
import { OutfitCard } from '../components/OutfitCard';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { t as tr } from '../lib/i18n';
import type { useSuggestAccessories } from '../hooks/useSuggestAccessories';
import type { useSuggestCombinations } from '../hooks/useSuggestCombinations';
import type { useCloneOutfitDNA } from '../hooks/useCloneOutfitDNA';

import { AccessoryCard } from './OutfitDetailScreen.accessoryCard';
import { CollapsibleSection } from './OutfitDetailScreen.collapsibleSection';

type AccessoriesHook = ReturnType<typeof useSuggestAccessories>;
type CombinationsHook = ReturnType<typeof useSuggestCombinations>;
type CloneHook = ReturnType<typeof useCloneOutfitDNA>;

type AccessoryRow = {
  id: string;
  title?: string | null;
  category?: string | null;
  color_primary?: string | null;
  rendered_image_path?: string | null;
  original_image_path?: string | null;
};

export type HelperSectionsProps = {
  accessoriesHook: AccessoriesHook;
  combinationsHook: CombinationsHook;
  cloneHook: CloneHook;
  accessoriesOpen: boolean;
  variationsOpen: boolean;
  cloneOpen: boolean;
  filteredAccessorySuggestions: AccessoriesHook['accessorySuggestions'];
  accessoryRows: AccessoryRow[];
  accessoryRowsLoading: boolean;
  addedAccessoryIds: Set<string>;
  addingAccessoryId: string | null;
  onSuggestAccessories: () => void;
  onTryVariations: () => void;
  onCloneDna: () => void;
  onCloseAccessories: () => void;
  onCloseVariations: () => void;
  onCloseClone: () => void;
  onRefreshAccessories: () => void;
  onRefreshCombinations: () => void;
  onRefreshClone: () => void;
  onAddAccessory: (id: string) => void;
  onOpenVariation: (seedIds: string[]) => void;
  onOpenClone: (seedIds: string[]) => void;
};

export function HelperSections({
  accessoriesHook,
  combinationsHook,
  cloneHook,
  accessoriesOpen,
  variationsOpen,
  cloneOpen,
  filteredAccessorySuggestions,
  accessoryRows,
  accessoryRowsLoading,
  addedAccessoryIds,
  addingAccessoryId,
  onSuggestAccessories,
  onTryVariations,
  onCloneDna,
  onCloseAccessories,
  onCloseVariations,
  onCloseClone,
  onRefreshAccessories,
  onRefreshCombinations,
  onRefreshClone,
  onAddAccessory,
  onOpenVariation,
  onOpenClone,
}: HelperSectionsProps) {
  const t = useTokens();
  return (
    <>
      {/* M17 — composition helper action row. */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button
          label={
            accessoriesHook.isSuggesting
              ? tr('outfitDetail.helperLoading')
              : tr('outfitDetail.suggestAccessoriesAction')
          }
          variant="quiet"
          size="sm"
          onPress={onSuggestAccessories}
          disabled={accessoriesHook.isSuggesting}
          accessibilityHint="Suggests 3-5 accessories from your wardrobe"
        />
        <Button
          label={
            combinationsHook.isSuggesting
              ? tr('outfitDetail.helperLoading')
              : tr('outfitDetail.tryVariationsAction')
          }
          variant="quiet"
          size="sm"
          onPress={onTryVariations}
          disabled={combinationsHook.isSuggesting}
          accessibilityHint="Generates 3 alternative outfits"
        />
        <Button
          label={
            cloneHook.isCloning
              ? tr('outfitDetail.helperLoading')
              : tr('outfitDetail.cloneDnaAction')
          }
          variant="quiet"
          size="sm"
          onPress={onCloneDna}
          disabled={cloneHook.isCloning}
          accessibilityHint="Generates a fresh outfit in this style"
        />
      </View>

      {accessoriesOpen ? (
        <CollapsibleSection
          title={tr('outfitDetail.accessories.title')}
          onClose={onCloseAccessories}
          onRefresh={onRefreshAccessories}
          refreshDisabled={accessoriesHook.isSuggesting}>
          {accessoriesHook.isSuggesting || accessoryRowsLoading ? (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <ActivityIndicator color={t.accent} />
            </View>
          ) : accessoriesHook.error
              && accessoriesHook.error !== SUBSCRIPTION_SENTINEL ? (
            <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
              {accessoriesHook.error}
            </Text>
          ) : filteredAccessorySuggestions.length === 0 ? (
            <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
              {tr('outfitDetail.accessories.empty')}
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {filteredAccessorySuggestions.map((sugg) => {
                const accessoryId = sugg.garment_id;
                const row = accessoryRows.find((r) => r.id === accessoryId);
                const added = addedAccessoryIds.has(accessoryId);
                const adding = addingAccessoryId === accessoryId;
                const fallbackSub = [row?.color_primary, row?.category]
                  .filter(Boolean)
                  .join(' · ')
                  .toUpperCase();
                const subtitle = sugg.reason ?? fallbackSub;
                return (
                  <AccessoryCard
                    key={accessoryId}
                    title={row?.title ?? 'Accessory'}
                    subtitle={subtitle}
                    subtitleUppercase={!sugg.reason}
                    imagePath={row?.rendered_image_path ?? row?.original_image_path ?? null}
                    added={added}
                    adding={adding}
                    onAdd={() => onAddAccessory(accessoryId)}
                  />
                );
              })}
            </ScrollView>
          )}
        </CollapsibleSection>
      ) : null}

      {variationsOpen ? (
        <CollapsibleSection
          title={tr('outfitDetail.variations.title')}
          onClose={onCloseVariations}
          onRefresh={onRefreshCombinations}
          refreshDisabled={combinationsHook.isSuggesting}>
          {combinationsHook.isSuggesting ? (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <ActivityIndicator color={t.accent} />
            </View>
          ) : combinationsHook.error
              && combinationsHook.error !== SUBSCRIPTION_SENTINEL ? (
            <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
              {combinationsHook.error}
            </Text>
          ) : combinationsHook.combinations.length === 0 ? (
            <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
              {tr('outfitDetail.variations.empty')}
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {combinationsHook.combinations.slice(0, 3).map((draft) => {
                const itemCount = draft.items.length;
                const sub = `${itemCount} PIECE${itemCount === 1 ? '' : 'S'}`;
                const name =
                  draft.family_label?.trim()
                  || draft.occasion?.trim()
                  || 'Variation';
                const seedIds = draft.items
                  .map((it) => it.garment_id)
                  .filter((id): id is string => typeof id === 'string' && id.length > 0);
                return (
                  <View key={draft.draftId} style={{ width: 220 }}>
                    <OutfitCard
                      name={name}
                      sub={sub}
                      onPress={() => onOpenVariation(seedIds)}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}
        </CollapsibleSection>
      ) : null}

      {cloneOpen ? (
        <CollapsibleSection
          title={tr('outfitDetail.cloneDna.title')}
          onClose={onCloseClone}
          onRefresh={onRefreshClone}
          refreshDisabled={cloneHook.isCloning}>
          {cloneHook.isCloning ? (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <ActivityIndicator color={t.accent} />
            </View>
          ) : cloneHook.error
              && cloneHook.error !== SUBSCRIPTION_SENTINEL ? (
            <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
              {cloneHook.error}
            </Text>
          ) : cloneHook.cloned ? (
            <View style={{ gap: 10 }}>
              <Text style={[s.cloneBanner, { color: t.fg2, borderColor: t.border }]}>
                {tr('outfitDetail.cloneDna.banner')}
              </Text>
              {(() => {
                const cloned = cloneHook.cloned;
                const seedIds = cloned.items
                  .map((it) => it.garment_id)
                  .filter((id): id is string => typeof id === 'string' && id.length > 0);
                return (
                  <OutfitCard
                    name={cloned.family_label?.trim() || 'Cloned look'}
                    sub={`${cloned.items.length} PIECE${cloned.items.length === 1 ? '' : 'S'}`}
                    onPress={() => onOpenClone(seedIds)}
                  />
                );
              })()}
            </View>
          ) : (
            <Text style={[s.sectionEmpty, { color: t.fg2 }]}>
              {tr('outfitDetail.variations.empty')}
            </Text>
          )}
        </CollapsibleSection>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  sectionEmpty: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8,
  },
  cloneBanner: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
});
