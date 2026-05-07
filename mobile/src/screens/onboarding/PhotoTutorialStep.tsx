// PhotoTutorialStep — onboarding "how to take a great garment photo" tutorial (M27).
//
// Mirrors the web `src/components/onboarding/PhotoTutorialStep.tsx` UX:
// Eyebrow + PageTitle + Caption + side-by-side good/bad illustration +
// 3-4 bullet rules (good lighting · plain background · whole garment in
// frame · no person on the garment) + Continue button.
//
// Illustration approach:
// We render placeholder illustration tiles (colored Views with iconography)
// rather than ship binary asset files in this PR — there are no
// `mobile/assets/*` placeholders authored for the tutorial, and the wave
// brief explicitly authorizes "simple colored View placeholders with
// iconography for now." A follow-up PR can swap in real PNGs once the
// design team produces them; the tile component is locally scoped so
// only this file changes.
//
// Patterns (mobile/CLAUDE.md):
//  - Reuses Eyebrow / PageTitle / Caption / Button primitives.
//  - All copy via `t(...)` from `../../lib/i18n` — zero hardcoded English.
//  - `useTokens()` for every color — no hardcoded hex.
//  - Same component shape as StudioSelectionStep — `{ initial?, onComplete, onSkip? }`.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import {
  CameraIcon,
  CheckIcon,
  CloseIcon,
  FrameIcon,
  LayersIcon,
  SunIcon,
  TshirtIcon,
  UserOffIcon,
} from '../../components/icons';
import { hapticLight } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';
import { fonts, radii } from '../../theme/tokens';
import { useTokens } from '../../theme/ThemeProvider';

interface BulletDef {
  icon: (color: string) => React.ReactNode;
  /** i18n key for the rule's title — appended to en.ts under
   * `onboarding.photoTutorial.good.bullets.<n>`. */
  key: string;
}

// Four bullet rules — keep the count <= 5 so the caption + bullets +
// CTA all fit one viewport without forcing a deep scroll. Order mirrors
// the priority that the AI enrichment pipeline cares about most: lighting
// > background > full-garment > no-person.
const GOOD_BULLETS: readonly BulletDef[] = [
  {
    icon: (color) => <SunIcon color={color} size={18} />,
    key: 'onboarding.photoTutorial.good.bullets.0',
  },
  {
    icon: (color) => <LayersIcon color={color} size={18} />,
    key: 'onboarding.photoTutorial.good.bullets.1',
  },
  {
    icon: (color) => <FrameIcon color={color} size={18} />,
    key: 'onboarding.photoTutorial.good.bullets.2',
  },
  {
    icon: (color) => <UserOffIcon color={color} size={18} />,
    key: 'onboarding.photoTutorial.good.bullets.3',
  },
];

// M27 R1 — bad-bullets wired to the bad ExampleTile after Codex flagged
// the dead i18n keys (`onboarding.photoTutorial.bad.bullets.0..3`). Same
// shape / order as GOOD_BULLETS so the contrast reads cleanly: each rule
// in the good column has a matching anti-rule in the bad column.
const BAD_BULLETS: readonly { key: string }[] = [
  { key: 'onboarding.photoTutorial.bad.bullets.0' },
  { key: 'onboarding.photoTutorial.bad.bullets.1' },
  { key: 'onboarding.photoTutorial.bad.bullets.2' },
  { key: 'onboarding.photoTutorial.bad.bullets.3' },
];

export function PhotoTutorialStep({
  onComplete,
  onSkip,
}: {
  /** Fired when the user taps Continue. The parent advances the step
   *  pointer; the tutorial is informational, no draft payload to
   *  capture. */
  onComplete: () => void;
  /** Optional skip handler. The OnboardingScreen header drives skip in
   *  the live flow, but the prop is wired for future surfaces (e.g. a
   *  Settings → "View photo tutorial" entry that wants its own Skip CTA). */
  onSkip?: () => void;
}) {
  const t = useTokens();
  // Double-tap guard — the parent's `advance()` is idempotent but a
  // double tap during the fade-out would still fire the haptic twice
  // and feels janky.
  const [advancing, setAdvancing] = React.useState(false);
  const handleContinue = () => {
    if (advancing) return;
    setAdvancing(true);
    hapticLight();
    onComplete();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: 8, marginBottom: 18 }}>
          <Eyebrow>{tr('onboarding.photoTutorial.eyebrow')}</Eyebrow>
          <PageTitle>{tr('onboarding.photoTutorial.title')}</PageTitle>
          <Caption>{tr('onboarding.photoTutorial.intro')}</Caption>
        </View>

        {/* Side-by-side good/bad illustration. Two equal-width tiles
            with iconography + a tiny header. The colored backgrounds
            (sage-tinted accent for "good" and a destructive-tinted
            backdrop for "bad") read as semantic without needing photos. */}
        <View style={styles.tileRow}>
          <ExampleTile
            kind="good"
            label={tr('onboarding.photoTutorial.good.title')}
          />
          <ExampleTile
            kind="bad"
            label={tr('onboarding.photoTutorial.bad.title')}
          />
        </View>

        {/* Bullet list — one row per rule. Icon + i18n string. */}
        <View style={[styles.bulletCard, { backgroundColor: t.card, borderColor: t.border }]}>
          {GOOD_BULLETS.map((bullet) => (
            <View key={bullet.key} style={styles.bulletRow}>
              <View
                style={[
                  styles.bulletIconWrap,
                  { backgroundColor: t.accentSoft },
                ]}>
                {bullet.icon(t.accent)}
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.uiMed,
                  fontSize: 13,
                  lineHeight: 18,
                  color: t.fg,
                  letterSpacing: -0.1,
                }}>
                {tr(bullet.key)}
              </Text>
            </View>
          ))}
        </View>

        {/* M27 R1 — bad-bullets card. The matching dictionary keys were
            previously orphaned; rendering them here gives the tutorial a
            balanced good vs bad story. CloseIcon swatches in destructive
            tinting so the semantic reading flips from "do" to "don't" at
            a glance. */}
        <View
          style={[
            styles.bulletCard,
            {
              backgroundColor: t.card,
              borderColor: t.border,
              marginTop: 12,
            },
          ]}>
          {BAD_BULLETS.map((bullet) => (
            <View key={bullet.key} style={styles.bulletRow}>
              <View
                style={[
                  styles.bulletIconWrap,
                  { backgroundColor: t.destructiveSoft },
                ]}>
                <CloseIcon color={t.destructive} size={16} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.uiMed,
                  fontSize: 13,
                  lineHeight: 18,
                  color: t.fg,
                  letterSpacing: -0.1,
                }}>
                {tr(bullet.key)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {onSkip ? (
            <Button
              label={tr('onboarding.photoTutorial.skip')}
              variant="quiet"
              size="md"
              onPress={onSkip}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              label={tr('onboarding.photoTutorial.continue')}
              variant="accent"
              block
              onPress={handleContinue}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function ExampleTile({
  kind,
  label,
}: {
  kind: 'good' | 'bad';
  label: string;
}) {
  const t = useTokens();
  const isGood = kind === 'good';
  // Token-resolved palette so the tile reads correctly in both light
  // and dark themes. Good = accent-tinted; bad = destructive-tinted.
  const surfaceBg = isGood ? t.accentSoft : t.destructiveSoft;
  const borderColor = isGood ? t.accent : t.destructive;
  const badgeBg = isGood ? t.accent : t.destructive;
  const Marker = isGood ? CheckIcon : CloseIcon;
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: surfaceBg,
          borderColor,
        },
      ]}>
      {/* Centered placeholder iconography — TshirtIcon for the "good"
          tile (clean garment) and CameraIcon for the "bad" tile (a
          generic "photo went wrong" feel). When real assets land they
          replace this entire <View>. */}
      <View
        style={[
          styles.tileIconWrap,
          { backgroundColor: t.card, borderColor: t.border },
        ]}>
        {isGood ? (
          <TshirtIcon color={t.fg} size={28} />
        ) : (
          <CameraIcon color={t.fg2} size={28} />
        )}
      </View>
      {/* Marker pill in the top-left so the semantic reading is loud
          even at a glance. */}
      <View
        style={[
          styles.tileBadge,
          { backgroundColor: badgeBg },
        ]}>
        <Marker color={t.accentFg} size={14} />
      </View>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 12,
          color: t.fg,
          letterSpacing: -0.1,
          textAlign: 'center',
          marginTop: 10,
        }}
        numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tileRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tileIconWrap: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bulletIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
