// Hero image + Studio badge + wear-count badge for GarmentDetailScreen —
// extracted in Phase 3 polish. The orchestrator continues to drive the
// render-status polling effect; this surface is pure render.
//
// Studio badge — four states the parent collapses into:
//   • pending render → "Studio render…" with inline spinner
//   • rendered image present → "Studio"
//   • render_status='failed' → "Render unavailable" (N14/F7)
//   • render_status='none' → hidden, original photo stands alone
//
// The badge state is exposed as a prop (`renderState`) so the
// component stays a dumb-render and we don't duplicate the truth
// tables across the parent + the sub-component.

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { GarmentImageTile } from '../../components/GarmentImageTile';
import type { Garment } from '../../types/garment';
import { t as tr } from '../../lib/i18n';

export type GarmentDetailHeroBadge = 'rendering' | 'rendered' | 'failed' | 'none';

export interface GarmentDetailHeroProps {
  garment: Garment;
  badge: GarmentDetailHeroBadge;
}

export function GarmentDetailHero({ garment, badge }: GarmentDetailHeroProps) {
  const t = useTokens();
  return (
    <View style={[s.hero, { borderColor: t.border }]}>
      <GarmentImageTile garment={garment} iconSize={64} />
      {badge === 'rendering' ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={tr('garmentDetail.badge.studioRendering.a11y')}
          style={[s.heroBadge, s.heroBadgePending, { backgroundColor: t.accentSoft }]}>
          <ActivityIndicator size="small" color={t.accent} style={{ marginRight: 6 }} />
          <Text style={[s.heroBadgeText, { color: t.accent }]}>{tr('garmentDetail.badge.studioRendering')}</Text>
        </View>
      ) : badge === 'rendered' ? (
        <View style={[s.heroBadge, { backgroundColor: t.accentSoft }]}>
          <Text style={[s.heroBadgeText, { color: t.accent }]}>{tr('garmentDetail.badge.studio')}</Text>
        </View>
      ) : badge === 'failed' ? (
        <View
          accessibilityLabel={tr('garment.render.failed.a11y')}
          style={[s.heroBadge, { backgroundColor: t.destructiveSoft }]}>
          <Text style={[s.heroBadgeText, { color: t.destructive }]}>{tr('garment.render.failed')}</Text>
        </View>
      ) : null}
      <View style={[s.heroBadgeRight, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 14,
            color: t.fg,
            letterSpacing: -0.14,
          }}>
          {garment.wear_count ?? 0}
        </Text>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 8.5,
            color: t.fg2,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginTop: 1,
          }}>
          Wears
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    width: '100%',
    aspectRatio: 0.78,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  heroBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBadgeText: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroBadgeRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
});
