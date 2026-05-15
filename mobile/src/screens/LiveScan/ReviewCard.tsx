// LiveScan per-garment review card (Wave R-D Bug C).
//
// Centered modal-style overlay that surfaces the analyzed payload — photo
// preview, garment title, category chip — and lets the user pick Save
// Original / Save Studio / Skip. After save the card transitions to a
// "Saved" / "Skipped" / "Failed" confirmation state with a Next CTA that
// dismisses the card and re-arms the scanner.
//
// The LiveScanScreen owns the state machine + transition logic. This
// component is presentational: receives props, fires callbacks, that's it.
//
// Always-dark palette is intentional — the LiveScan camera surface itself
// is a "system camera" mode regardless of OS theme, and the review card
// reads as a layer on top of that surface.
//
// Photo source: when the on-device segmenter produced a masked WebP we
// show the signed URL of the masked sidecar — the user sees the
// background-removed cutout as immediate feedback for the segmentation
// run. Falls back to the local raw `photoUri` URI on iOS 15/16, Android
// pre-segmentation-download, or any failed mask.

import React from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { useSignedUrl } from '../../hooks/useSignedUrl';
import { t as tr } from '../../lib/i18n';
import { SparklesIcon, ImageIcon } from '../../components/icons';
import type { PipelineErrorClass } from './types';
import type { AnalyzedScan } from './events';

const VF_FG = '#FFFFFF';
const VF_FG2 = 'rgba(255,255,255,0.65)';
const VF_FG3 = 'rgba(255,255,255,0.45)';
const VF_CARD_BG = '#161514';
const VF_BORDER = 'rgba(255,255,255,0.14)';
const VF_ACCENT_SOFT = 'rgba(255,217,107,0.18)';
const ACCENT_GOLD = '#FFD96B';
const SCRIM_BG = 'rgba(0,0,0,0.55)';

export type ReviewCardState =
  | { kind: 'reviewing'; payload: AnalyzedScan }
  | { kind: 'saving'; payload: AnalyzedScan; choice: 'original' | 'studio' }
  | { kind: 'saved'; payload: AnalyzedScan; choice: 'original' | 'studio' }
  | { kind: 'skipped'; payload: AnalyzedScan }
  | { kind: 'failed'; payload: AnalyzedScan; errorClass: PipelineErrorClass };

interface ReviewCardProps {
  state: ReviewCardState | null;
  onSaveOriginal: () => void;
  onSaveStudio: () => void;
  onSkip: () => void;
  onNext: () => void;
}

export function ReviewCard({ state, onSaveOriginal, onSaveStudio, onSkip, onNext }: ReviewCardProps) {
  const insets = useSafeAreaInsets();
  // Hooks must run before the early return — `useSignedUrl` is called for
  // every render regardless of card visibility, with a null path when the
  // card is hidden. The query short-circuits internally on null.
  const maskedPath = state?.payload.maskedStoragePath ?? null;
  const { data: maskedSignedUrl } = useSignedUrl(maskedPath);

  if (!state) return null;
  const { payload } = state;
  const photoUri = maskedSignedUrl ?? payload.photoUri;
  const title = payload.analysis.title || tr('livescan.review.untitled');
  const category = payload.analysis.category;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onSkip} accessibilityViewIsModal>
      <View style={[s.scrim, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <View style={s.card}>
          {/* Photo preview */}
          <View style={s.photoWrap}>
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            {state.kind === 'saving' ? (
              <View style={s.photoOverlay} accessibilityLabel={tr('livescan.review.saving')}>
                <ActivityIndicator size="large" color={ACCENT_GOLD} />
              </View>
            ) : null}
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
            <Eyebrow style={{ color: VF_FG2 }}>{stateEyebrow(state)}</Eyebrow>
            <Text style={s.title}>{title}</Text>
            {category ? <Text style={s.category}>{titleCase(category)}</Text> : null}
          </View>

          {/* Footer — state-dependent */}
          <View style={s.footer}>
            {state.kind === 'reviewing' ? (
              <View style={{ gap: 10 }}>
                <ChoiceRow
                  icon={<SparklesIcon size={18} color={ACCENT_GOLD} />}
                  label={tr('livescan.review.saveStudio.label')}
                  body={tr('livescan.review.saveStudio.body')}
                  onPress={onSaveStudio}
                  primary
                />
                <ChoiceRow
                  icon={<ImageIcon size={18} color={VF_FG} />}
                  label={tr('livescan.review.saveOriginal.label')}
                  body={tr('livescan.review.saveOriginal.body')}
                  onPress={onSaveOriginal}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr('livescan.review.skip.aria')}
                  onPress={onSkip}
                  style={({ pressed }) => [s.skipBtn, { opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={s.skipLabel}>{tr('livescan.review.skip.label')}</Text>
                </Pressable>
              </View>
            ) : state.kind === 'saving' ? (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={s.status}>{tr('livescan.review.saving')}</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={[s.status, statusToneStyle(state.kind)]}>
                  {statusLabel(state)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr('livescan.review.next.aria')}
                  onPress={onNext}
                  style={({ pressed }) => [s.nextBtn, { opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={s.nextLabel}>{tr('livescan.review.next.label')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ChoiceRow({
  icon,
  label,
  body,
  onPress,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.choice,
        {
          backgroundColor: primary ? VF_ACCENT_SOFT : 'rgba(255,255,255,0.06)',
          borderColor: primary ? ACCENT_GOLD : VF_BORDER,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View
        style={[
          s.choiceIcon,
          { backgroundColor: primary ? 'rgba(255,217,107,0.16)' : 'rgba(255,255,255,0.08)' },
        ]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.choiceLabel, { color: primary ? ACCENT_GOLD : VF_FG }]}>{label}</Text>
        <Text style={s.choiceBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

function stateEyebrow(state: ReviewCardState): string {
  switch (state.kind) {
    case 'reviewing':
      return tr('livescan.review.eyebrow.review');
    case 'saving':
      return tr('livescan.review.eyebrow.saving');
    case 'saved':
      return tr('livescan.review.eyebrow.saved');
    case 'skipped':
      return tr('livescan.review.eyebrow.skipped');
    case 'failed':
      return tr('livescan.review.eyebrow.failed');
  }
}

function statusLabel(state: ReviewCardState): string {
  switch (state.kind) {
    case 'saved':
      return state.choice === 'studio'
        ? tr('livescan.review.savedStudio')
        : tr('livescan.review.savedOriginal');
    case 'skipped':
      return tr('livescan.review.skipped');
    case 'failed':
      return tr(`livescan.error.${state.errorClass}`);
    default:
      return '';
  }
}

function statusToneStyle(kind: ReviewCardState['kind']) {
  if (kind === 'failed') return { color: '#FFB59A' };
  if (kind === 'saved') return { color: ACCENT_GOLD };
  return { color: VF_FG };
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: SCRIM_BG,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: VF_CARD_BG,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: VF_BORDER,
    overflow: 'hidden',
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.displayMedium,
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 26,
    color: VF_FG,
    marginTop: 2,
    letterSpacing: -0.22,
  },
  category: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: VF_FG3,
    marginTop: 6,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  choiceIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceLabel: {
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    letterSpacing: -0.14,
  },
  choiceBody: {
    marginTop: 3,
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 16,
    color: VF_FG2,
  },
  skipBtn: {
    marginTop: 4,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: VF_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: VF_FG2,
  },
  status: {
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: VF_FG,
    textAlign: 'center',
  },
  nextBtn: {
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: ACCENT_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    letterSpacing: 0.4,
    color: '#1a1610',
    fontWeight: '600',
  },
});
