// Outfit result card for StyleMeScreen — extracted in Phase 3.
//
// Renders three branches:
//   • Preview — fresh generation; "Save" + "Restyle" actions.
//   • Saved — outfit has been persisted; "Open detail" link + Restyle.
//   • Empty — engine returned `itemCount === 0`; soft empty state + Restyle.
//
// The orchestrator owns generation kickoff / persistence mutation /
// navigation. We accept resolved props and the three handlers so the
// card stays pure-render.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Eyebrow } from '../../components/Eyebrow';
import { OutfitCard } from '../../components/OutfitCard';
import { t as tr } from '../../lib/i18n';

export interface StyleMeResultGarment {
  id: string;
  rendered_image_path: string | null;
  original_image_path: string | null;
}

export interface StyleMeResultCardProps {
  // The generated outfit. `null` is handled by the orchestrator (it
  // renders the Generate button); we never receive null here. The
  // `name` / `description` come straight off `result`.
  name: string;
  description: string | null | undefined;
  subLine: string;
  garments: StyleMeResultGarment[] | undefined;
  itemCount: number;
  savedOutfitId: string | null;
  onSave: () => void;
  onOpenSavedDetail: () => void;
  onRestyle: () => void;
}

export function StyleMeResultCard({
  name,
  description,
  subLine,
  garments,
  itemCount,
  savedOutfitId,
  onSave,
  onOpenSavedDetail,
  onRestyle,
}: StyleMeResultCardProps) {
  const t = useTokens();

  if (itemCount === 0) {
    // Engine returned a non-error response with no garments — wardrobe
    // doesn't cover this occasion+formality combo. Surface a soft empty
    // state instead of rendering a "0 PIECES" OutfitCard. Codex audit
    // P2-1 (audit 3).
    return (
      <View style={{ gap: 14 }}>
        <View style={s.emptyResult}>
          <Eyebrow>No matching pieces</Eyebrow>
          <Caption style={{ marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
            {description || 'Try a different occasion or formality — your wardrobe doesn’t yet cover this combo.'}
          </Caption>
        </View>
        <Button label="Restyle" variant="outline" onPress={onRestyle} block />
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <Eyebrow>Styled for you</Eyebrow>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 10,
              letterSpacing: 1.4,
              color: savedOutfitId ? t.accent : t.fg2,
              textTransform: 'uppercase',
            }}>
            {savedOutfitId ? tr('styleMe.saved.badge') : tr('styleMe.preview.badge')}
          </Text>
        </View>
        <OutfitCard
          name={name}
          sub={subLine}
          garments={garments}
          onUse={savedOutfitId ? onOpenSavedDetail : onSave}
          onSave={savedOutfitId ? undefined : onSave}
        />
        {savedOutfitId ? (
          <Pressable
            onPress={onOpenSavedDetail}
            accessibilityRole="link"
            style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.accent }}>
              {tr('styleMe.saved.openDetail')}
            </Text>
          </Pressable>
        ) : null}
        {description ? (
          <Caption style={{ marginTop: 8, lineHeight: 18 }}>{description}</Caption>
        ) : null}
      </View>
      <Button label="Restyle" variant="outline" onPress={onRestyle} block />
    </View>
  );
}

const s = StyleSheet.create({
  emptyResult: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
