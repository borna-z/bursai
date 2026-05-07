// CoachOverlay — first-run coachmark primitive (M27).
//
// Renders a transparent fade-in Modal with a dimmed scrim + an optional
// rounded "target hole" cut out around a measured rect. The hole is
// achieved by stacking four scrim quadrants AROUND the target rect — top
// strip, bottom strip, left and right strips — each with a translucent
// black backgroundColor so the target stays uncovered. When `targetRef` is
// null/undefined we fall back to a single full-screen scrim with no
// cutout.
//
// Caption + Next/Skip buttons are positioned BELOW the target by default,
// or pinned to the screen center when no target is given. A "1 of 4"
// progress indicator floats at the top of the modal.
//
// Accessibility:
//   - The modal content gets `accessibilityRole="dialog"` so VoiceOver /
//     TalkBack announce the overlay as a dialog (focus trap is handled by
//     the underlying Modal component on iOS/Android).
//   - The target rect cutout exposes `accessibilityLabel` reading the
//     caption so screen-reader users get the same context.
//
// Tokens: every color reads from `useTokens()`. The scrim transparency
// uses an inline rgba which is OK per wave brief (the rest of the
// codebase already uses inline rgba for scrim overlays — see SmartTile,
// AccentColorStep).

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
  type View as ViewType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Caption } from './Caption';
import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { t as tr } from '../lib/i18n';

// Single source of truth for the dim. Inline rgba is intentional — the
// scrim color does not vary with theme (a near-black wash reads cleanly
// over both light and dark surfaces). Mirrors the precedent set by
// `tokens.scrimBg` which is also rgba-typed.
const SCRIM_COLOR = 'rgba(0,0,0,0.62)';

// Pad applied around the measured target rect so the cutout has visual
// breathing room and the highlighted element doesn't touch the dimmed
// edges. Picked by eye to feel like a tap-target ring rather than a
// cropping mask.
const TARGET_INSET = 12;

// Vertical gap between the target hole and the caption block. When the
// caption can't fit below the target we fall back to placing it ABOVE
// the target — keeps the overlay readable on tall targets near the
// bottom of the screen.
const CAPTION_GAP = 18;

// Approximate caption block height (eyebrow + caption + 2 buttons). Used
// only to decide above-vs-below layout; the actual block lays out with
// `position: 'absolute'` and shrinks/grows as needed.
const CAPTION_BLOCK_ESTIMATED_HEIGHT = 200;

export interface CoachOverlayProps {
  /** Toggles the modal. When false the modal is unmounted entirely so
   * scroll inside the underlying screen continues to work. */
  visible: boolean;
  /** Optional ref to the element the overlay should highlight. We measure
   * its rect via `measureInWindow` once the modal is visible; null /
   * undefined renders a centered caption with no cutout. */
  targetRef?: React.RefObject<ViewType | null>;
  /** Body copy for the coachmark — usually a short sentence ("Today's
   * outfit goes here"). */
  caption: string;
  /** Primary CTA copy — defaults to the localized "Next" string. The
   * final step's caller passes the localized "Done" copy instead. */
  ctaLabel: string;
  /** Fires when the user taps the primary CTA. The hook decides whether
   * to advance to the next step or persist completion. */
  onNext: () => void;
  /** Fires when the user taps Skip. Always shown — the wave brief makes
   * skip a first-class affordance on every step. */
  onSkip: () => void;
  /** 1-indexed step number for the progress indicator. */
  step: number;
  /** Total number of steps in the tour (for "step of total" rendering). */
  total: number;
}

export function CoachOverlay({
  visible,
  targetRef,
  caption,
  ctaLabel,
  onNext,
  onSkip,
  step,
  total,
}: CoachOverlayProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const [windowSize, setWindowSize] = React.useState<LayoutRectangle | null>(null);
  const [targetRect, setTargetRect] = React.useState<LayoutRectangle | null>(null);

  // Measure the target whenever the modal becomes visible OR the ref
  // updates. `measureInWindow` runs on the native side and returns
  // window-coordinate {x, y, w, h}. We retry once on the next animation
  // frame because Modal's mount can race the parent layout — the first
  // measure occasionally returns 0×0 before the ref fully settles.
  React.useEffect(() => {
    if (!visible) {
      setTargetRect(null);
      return;
    }
    const node = targetRef?.current;
    if (!node) {
      setTargetRect(null);
      return;
    }
    const tryMeasure = () => {
      // Measurements can be off until layout settles; we retry inside an
      // RAF so the modal's fade-in animation has a frame to land first.
      node.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          setTargetRect({ x, y, width, height });
        }
      });
    };
    tryMeasure();
    const raf = requestAnimationFrame(tryMeasure);
    return () => cancelAnimationFrame(raf);
  }, [visible, targetRef]);

  // Padded rect that the four scrim quadrants surround. Computed inline
  // so the cutout updates if the target moves between renders (e.g. a
  // FlatList reflow). When `windowSize` is null the cutout maths can't
  // run yet — we render a single full-bleed scrim as a safe fallback.
  const cutout = React.useMemo(() => {
    if (!targetRect || !windowSize) return null;
    const left = Math.max(0, targetRect.x - TARGET_INSET);
    const top = Math.max(0, targetRect.y - TARGET_INSET);
    const right = Math.min(
      windowSize.width,
      targetRect.x + targetRect.width + TARGET_INSET,
    );
    const bottom = Math.min(
      windowSize.height,
      targetRect.y + targetRect.height + TARGET_INSET,
    );
    return { left, top, right, bottom };
  }, [targetRect, windowSize]);

  // Decide whether the caption block sits ABOVE or BELOW the target.
  // Below by default; flip to above only if there isn't enough room
  // beneath the cutout for the estimated block height. Keeps the caption
  // visible on screens where the target is pinned to the bottom of the
  // viewport (e.g. the FAB on MainTabs).
  const captionPlacement = React.useMemo<{
    top: number | undefined;
    bottom: number | undefined;
  }>(() => {
    if (!cutout || !windowSize) {
      return { top: undefined, bottom: undefined };
    }
    const spaceBelow = windowSize.height - cutout.bottom - insets.bottom;
    const spaceAbove = cutout.top - insets.top;
    if (spaceBelow >= CAPTION_BLOCK_ESTIMATED_HEIGHT || spaceBelow >= spaceAbove) {
      return {
        top: cutout.bottom + CAPTION_GAP,
        bottom: undefined,
      };
    }
    return {
      top: undefined,
      bottom: windowSize.height - cutout.top + CAPTION_GAP,
    };
  }, [cutout, windowSize, insets.top, insets.bottom]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
      statusBarTranslucent>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) =>
          setWindowSize({
            x: 0,
            y: 0,
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })
        }
        accessibilityViewIsModal
        accessibilityRole="alert"
        // RN's accessibilityRole union doesn't include 'dialog' — 'alert'
        // is the closest semantic match supported on both platforms and
        // matches the pattern other modal sheets use (see
        // GarmentSaveChoiceSheet).
      >
        {cutout ? (
          // Four scrim quadrants surrounding the target rect. The target
          // hole is the un-painted middle — pressing inside the hole is
          // intentionally a no-op so the user can't dismiss the overlay
          // by tapping the highlighted control (would race with onNext).
          <>
            <View
              style={[
                styles.scrim,
                { top: 0, left: 0, right: 0, height: cutout.top },
              ]}
            />
            <View
              style={[
                styles.scrim,
                { top: cutout.bottom, left: 0, right: 0, bottom: 0 },
              ]}
            />
            <View
              style={[
                styles.scrim,
                {
                  top: cutout.top,
                  left: 0,
                  width: cutout.left,
                  height: cutout.bottom - cutout.top,
                },
              ]}
            />
            <View
              style={[
                styles.scrim,
                {
                  top: cutout.top,
                  left: cutout.right,
                  right: 0,
                  height: cutout.bottom - cutout.top,
                },
              ]}
            />
            {/* Accessible target descriptor — exposes the caption to
                screen readers as the label of the highlighted region so
                a VoiceOver / TalkBack user understands what the cutout
                is pointing at. Visually invisible (transparent border). */}
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={caption}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: cutout.top,
                left: cutout.left,
                width: cutout.right - cutout.left,
                height: cutout.bottom - cutout.top,
                borderRadius: radii.lg,
                borderWidth: 2,
                borderColor: t.accent,
              }}
            />
          </>
        ) : (
          <Pressable
            // Tappable scrim WITHOUT a target hole — tapping advances the
            // step (centered captions are usually informational and a
            // single big "tap to continue" matches the pattern). When a
            // target exists we never make the scrim tappable so the user
            // can't accidentally advance by hitting the dim outside the
            // CTA.
            onPress={onNext}
            style={[styles.scrim, StyleSheet.absoluteFill]}
            accessibilityRole="button"
            accessibilityLabel={caption}
          />
        )}

        {/* Step progress indicator — small editorial caption at the top
            of the modal, anchored to the safe-area inset so notch/dynamic-
            island devices don't clip it. */}
        <View
          pointerEvents="none"
          style={[styles.progressWrap, { top: insets.top + 12 }]}>
          <View
            style={[
              styles.progressPill,
              { backgroundColor: t.card, borderColor: t.border },
            ]}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 10.5,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: t.fg2,
              }}>
              {tr('coachTour.progressTemplate', { current: step, total })}
            </Text>
          </View>
        </View>

        {/* Caption block — positioned absolutely so it never reflows the
            quadrant geometry above. Pads horizontally so caption + buttons
            never touch the screen edge. */}
        <View
          pointerEvents="box-none"
          style={[
            styles.captionWrap,
            captionPlacement.top !== undefined ? { top: captionPlacement.top } : null,
            captionPlacement.bottom !== undefined
              ? { bottom: captionPlacement.bottom }
              : null,
            captionPlacement.top === undefined && captionPlacement.bottom === undefined
              ? { top: '50%' as const, transform: [{ translateY: -CAPTION_BLOCK_ESTIMATED_HEIGHT / 2 }] }
              : null,
          ]}>
          <View
            style={[
              styles.captionCard,
              { backgroundColor: t.card, borderColor: t.border },
            ]}>
            <Caption
              style={{
                color: t.fg,
                fontFamily: fonts.uiSemi,
                fontSize: 14,
                lineHeight: 20,
                letterSpacing: -0.1,
                textTransform: 'none',
                marginBottom: 14,
              }}>
              {caption}
            </Caption>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Button
                label={tr('coachTour.skip')}
                variant="quiet"
                size="sm"
                onPress={onSkip}
              />
              <View style={{ flex: 1 }}>
                <Button
                  label={ctaLabel}
                  variant="accent"
                  size="sm"
                  block
                  onPress={onNext}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    backgroundColor: SCRIM_COLOR,
  },
  progressWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  progressPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  captionWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  captionCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 16,
  },
});
