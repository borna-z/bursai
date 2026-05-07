// ConditionBadge — pill showing the assessed condition score plus a
// one-line summary underneath. M21.
//
// Tier breakpoints (per the wave brief, score in 0-100 space):
//   80-100 → accent (good)
//   50-79  → neutral border (fair)
//   0-49   → destructive (poor)
//
// Tap behaviour: when `onTap` is provided the whole pill becomes a
// Pressable with an accessibility hint pointing the user at the detail
// sheet. Without `onTap` it renders as a static label so list-cell
// surfaces can re-use the badge without forcing a tap target. Sub-line
// uses the existing `Caption` primitive — no hardcoded hex; everything
// goes through `useTokens()`.

import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii, text } from '../theme/tokens';
import { t as tr } from '../lib/i18n';
import type { ConditionAssessment } from '../hooks/useAssessCondition';

export type ConditionTier = 'good' | 'fair' | 'poor';

export function tierForScore(score: number): ConditionTier {
  if (score >= 80) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

interface ConditionBadgeProps {
  assessment: ConditionAssessment;
  onTap?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ConditionBadge({ assessment, onTap, style }: ConditionBadgeProps) {
  const t = useTokens();
  // Defensive read — clamp the score for the visual + tier even if a
  // future caller hands the badge an unnormalised value. The hook
  // normalises today, but the component is reusable so the guard pays
  // for itself.
  const rawScore = Number.isFinite(assessment.condition_score)
    ? Math.max(0, Math.min(100, Math.round(assessment.condition_score)))
    : 0;
  const tier = tierForScore(rawScore);

  // Three palettes mapped to the wave's tier breakpoints. `accentSoft` /
  // `destructiveSoft` provide the tinted background; the foreground uses
  // the corresponding solid token so contrast stays in spec across both
  // light and dark themes.
  const palette = (() => {
    switch (tier) {
      case 'good':
        return { bg: t.accentSoft, fg: t.accent, border: 'transparent' as const };
      case 'fair':
        return { bg: t.card, fg: t.fg, border: t.border };
      case 'poor':
      default:
        return { bg: t.destructiveSoft, fg: t.destructive, border: 'transparent' as const };
    }
  })();

  // The sub-line prefers a repair recommendation when the server returned
  // any (forward-compat field — empty today). Falls back to the AI's
  // free-form summary; final fallback is a generic "tap for details" cue.
  const subline = (() => {
    const firstRec = assessment.repair_recommendations.find((r) => r.trim().length > 0);
    if (firstRec) return firstRec;
    const summary = assessment.summary?.trim();
    if (summary && summary.length > 0) return summary;
    return null;
  })();

  const tierLabel = tr(`condition.tier.${tier}`);
  const accessibilityLabel = `${tr('condition.scoreLabel', { score: String(rawScore) })} · ${tierLabel}`;

  const PillBody = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: radii.pill,
          backgroundColor: palette.bg,
          borderWidth: palette.border === 'transparent' ? 0 : 1,
          borderColor: palette.border,
          gap: 8,
        },
      ]}>
      <Text
        style={{
          fontFamily: fonts.displayMedium,
          fontStyle: 'italic',
          fontSize: 16,
          lineHeight: 18,
          color: palette.fg,
          letterSpacing: -0.16,
        }}>
        {rawScore}
      </Text>
      <Text
        style={{
          fontFamily: fonts.uiSemi,
          fontSize: 9.5,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: palette.fg,
        }}>
        {tierLabel}
      </Text>
    </View>
  );

  const Body = (
    <View style={[{ alignSelf: 'flex-start', gap: 4 }, style]}>
      {PillBody}
      {subline ? (
        <Text
          numberOfLines={2}
          style={[text.caption, { color: t.fg2, maxWidth: 260 }]}>
          {subline}
        </Text>
      ) : null}
    </View>
  );

  if (onTap) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={tr('condition.openHint')}
        onPress={onTap}
        style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        {Body}
      </Pressable>
    );
  }
  return Body;
}
