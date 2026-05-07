// Bottom-sheet save-choice modal — Studio quality vs Original photo.
// RN port of src/components/garment/GarmentSaveChoiceSheet.tsx, built on
// React Native's stock Modal so the mobile app doesn't pull in a new bottom-
// sheet library (mobile/CLAUDE.md: don't add deps without asking, don't
// introduce a state lib).
//
// Animation: Modal handles the slide-from-bottom animation natively via
// `animationType="slide"` on iOS/Android. The token rule still applies — every
// surface comes from `useTokens()`, no hardcoded hex.
//
// Studio choice = `enableStudioQuality: true` → enqueue_render_job fires +
// `render_status: 'pending'` on insert (background ghost-mannequin render).
// Original choice = `false` → no render queued, row keeps the original photo
// forever. Both options save the row immediately — the difference is only
// what the wardrobe grid eventually displays for this garment.
//
// `isSaving` disables both cards while a save is in flight so the user can't
// fire two inserts back-to-back.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { t as tr } from '../lib/i18n';
import { Eyebrow } from './Eyebrow';
import { SparklesIcon, ImageIcon } from './icons';

interface GarmentSaveChoiceSheetProps {
  open: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSelectStudio: () => void;
  onSelectOriginal: () => void;
}

export function GarmentSaveChoiceSheet({
  open,
  isSaving = false,
  onClose,
  onSelectStudio,
  onSelectOriginal,
}: GarmentSaveChoiceSheetProps) {
  const t = useTokens();
  // Field-report fix (2026-05-07): the sheet previously used a hardcoded
  // `paddingBottom: 28` which left the Cancel button under the home
  // indicator on Face-ID iPhones (insets.bottom ≈ 34). Use the larger of
  // the inset and the design padding so devices without an indicator keep
  // the original spacing while notched devices get clearance.
  const insets = useSafeAreaInsets();
  const sheetPaddingBottom = Math.max(insets.bottom, 28);

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      {/* Scrim — tapping the backdrop dismisses the sheet, matching the web Sheet behaviour. */}
      <Pressable
        accessible={false}
        style={[s.scrim, { backgroundColor: t.scrimBg }]}
        onPress={onClose}
      />

      <View
        accessibilityRole="none"
        style={[
          s.sheet,
          {
            backgroundColor: t.bg,
            borderTopColor: t.border,
            paddingBottom: sheetPaddingBottom,
          },
        ]}>
        <View style={[s.handle, { backgroundColor: t.border }]} />

        <Eyebrow style={{ marginBottom: 6 }}>{tr('addpiece.save.eyebrow')}</Eyebrow>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 22,
            lineHeight: 26,
            color: t.fg,
            letterSpacing: -0.22,
            marginBottom: 6,
          }}>
          {tr('addpiece.save.title')}
        </Text>
        <Text
          style={{
            fontFamily: fonts.ui,
            fontSize: 13,
            lineHeight: 18,
            color: t.fg2,
            marginBottom: 18,
          }}>
          {tr('addpiece.save.body')}
        </Text>

        {/* Studio quality — primary path; the renderer needs ~30-60s but the row is in
            the wardrobe immediately. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('addpiece.save.studio.aria')}
          accessibilityState={{ disabled: isSaving }}
          disabled={isSaving}
          onPress={onSelectStudio}
          style={({ pressed }) => [
            s.choiceCard,
            {
              backgroundColor: t.card,
              borderColor: t.border,
              opacity: isSaving ? 0.55 : pressed ? 0.85 : 1,
            },
          ]}>
          <View
            style={[
              s.choiceIconWrap,
              { backgroundColor: t.accentSoft, borderColor: t.border },
            ]}>
            <SparklesIcon size={18} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 14,
                color: t.fg,
                letterSpacing: -0.14,
              }}>
              {tr('addpiece.save.studio.label')}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: fonts.ui,
                fontSize: 12.5,
                lineHeight: 17,
                color: t.fg2,
              }}>
              {tr('addpiece.save.studio.body')}
            </Text>
          </View>
        </Pressable>

        {/* Original photo — opt-out from the render pipeline. Row saves with
            `render_status: 'none'` so the worker skips it permanently. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('addpiece.save.original.aria')}
          accessibilityState={{ disabled: isSaving }}
          disabled={isSaving}
          onPress={onSelectOriginal}
          style={({ pressed }) => [
            s.choiceCard,
            {
              backgroundColor: t.card,
              borderColor: t.border,
              marginTop: 10,
              opacity: isSaving ? 0.55 : pressed ? 0.85 : 1,
            },
          ]}>
          <View
            style={[
              s.choiceIconWrap,
              { backgroundColor: t.bg2, borderColor: t.border },
            ]}>
            <ImageIcon size={18} color={t.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 14,
                color: t.fg,
                letterSpacing: -0.14,
              }}>
              {tr('addpiece.save.original.label')}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: fonts.ui,
                fontSize: 12.5,
                lineHeight: 17,
                color: t.fg2,
              }}>
              {tr('addpiece.save.original.body')}
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('common.cancel')}
          accessibilityState={{ disabled: isSaving }}
          disabled={isSaving}
          onPress={onClose}
          style={({ pressed }) => [
            s.cancel,
            { borderColor: t.border, opacity: isSaving ? 0.55 : pressed ? 0.7 : 1 },
          ]}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 11,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: t.fg2,
            }}>
            {tr('common.cancel')}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    // paddingBottom is set inline from safe-area insets (Math.max(insets.bottom, 28)).
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  choiceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    marginTop: 14,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
