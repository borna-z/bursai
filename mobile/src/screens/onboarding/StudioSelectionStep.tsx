// StudioSelectionStep — onboarding step 4.
// Picks the *presentation style* the user wants BURS to render their garments in.
//
// Note vs. web: the web's `studio_selection` step asks the user to pick 3 garments
// from their wardrobe to render with their trial-gift credits. That depends on
// the upstream `batch_capture` step (uploading 20–50 garments via camera/library)
// which isn't in scope for this PR — see the PR body for the deferral note. The
// upload flow itself will use expo-camera + expo-image-picker (already installed
// in mobile/package.json) when shipped as a follow-up PR.
//
// The values emitted by this step (`ghost_mannequin` / `flat_lay` / `hanger`) are
// presentation-style preferences for the render pipeline — they are NOT the same
// thing as `profiles.mannequin_presentation`, which on the web is a body-shape
// enum (`female` / `male` / `mixed`). Server-write needs a new column or a
// `preferences.studio_presentation` JSON entry; do not write these strings into
// `mannequin_presentation` (would fail the CHECK constraint on the web schema).

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { Caption } from '../../components/Caption';
import { Button } from '../../components/Button';
import { CheckIcon, HangerIcon, ImageIcon, SmileIcon } from '../../components/icons';
import { t as tr } from '../../lib/i18n';
import { hapticLight, hapticSelection } from '../../lib/haptics';

export type Studio = 'ghost_mannequin' | 'flat_lay' | 'hanger';

type Option = {
  id: Studio;
  titleKey: string;
  captionKey: string;
  icon: (color: string) => React.ReactNode;
  recommended?: boolean;
};

const OPTIONS: readonly Option[] = [
  {
    id: 'ghost_mannequin',
    titleKey: 'studio.option.ghost.title',
    captionKey: 'studio.option.ghost.caption',
    icon: (color) => <SmileIcon size={28} color={color} />,
    recommended: true,
  },
  {
    id: 'flat_lay',
    titleKey: 'studio.option.flat.title',
    captionKey: 'studio.option.flat.caption',
    icon: (color) => <ImageIcon size={28} color={color} />,
  },
  {
    id: 'hanger',
    titleKey: 'studio.option.hanger.title',
    captionKey: 'studio.option.hanger.caption',
    icon: (color) => <HangerIcon size={28} color={color} />,
  },
];

export function StudioSelectionStep({
  initial,
  onComplete,
}: {
  initial?: Studio;
  onComplete: (studio: Studio) => void;
}) {
  const t = useTokens();
  const [selected, setSelected] = React.useState<Studio>(initial ?? 'ghost_mannequin');

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 18, gap: 8 }}>
        <Eyebrow>{tr('studio.eyebrow')}</Eyebrow>
        <PageTitle>{tr('studio.title')}</PageTitle>
        <Caption>{tr('studio.body')}</Caption>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}
        showsVerticalScrollIndicator={false}>
        {OPTIONS.map((opt) => {
          const active = opt.id === selected;
          return (
            <Pressable
              key={opt.id}
              onPress={() => { hapticSelection(); setSelected(opt.id); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                borderRadius: radii.xl,
                backgroundColor: t.card,
                borderWidth: active ? 2 : 1,
                borderColor: active ? t.accent : t.border,
                overflow: 'hidden',
                opacity: pressed ? 0.95 : 1,
              })}>
              {/* Preview */}
              <View
                style={{
                  height: 120,
                  backgroundColor: t.bg2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                <LinearGradient
                  colors={[t.accentSoft, 'rgba(0,0,0,0)']}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: radii.lg,
                    backgroundColor: t.card,
                    borderWidth: 1,
                    borderColor: t.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {opt.icon(t.accent)}
                </View>
                {opt.recommended && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      paddingHorizontal: 10,
                      height: 22,
                      borderRadius: radii.pill,
                      backgroundColor: t.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text
                      style={{
                        fontFamily: fonts.uiSemi,
                        fontSize: 9.5,
                        color: t.accentFg,
                        letterSpacing: 1.4,
                        textTransform: 'uppercase',
                      }}>
                      {tr('studio.recommended')}
                    </Text>
                  </View>
                )}
                {active && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 26,
                      height: 26,
                      borderRadius: radii.pill,
                      backgroundColor: t.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <CheckIcon size={16} color={t.accentFg} />
                  </View>
                )}
              </View>

              <View style={{ padding: 16, gap: 4 }}>
                <Text
                  style={{
                    fontFamily: fonts.displayMedium,
                    fontStyle: 'italic',
                    fontSize: 20,
                    color: t.fg,
                    letterSpacing: -0.2,
                  }}>
                  {tr(opt.titleKey)}
                </Text>
                <Caption>{tr(opt.captionKey)}</Caption>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Button
          label={tr('studio.continue')}
          variant="accent"
          block
          onPress={() => { hapticLight(); onComplete(selected); }}
        />
      </View>
    </View>
  );
}
