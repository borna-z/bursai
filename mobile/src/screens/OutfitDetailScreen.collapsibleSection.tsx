// OutfitDetailScreen — CollapsibleSection wrapper (N13 split).
//
// Used by the three helper sections (accessories / variations / clone).
// Header has an Eyebrow title, an optional Refresh action, and a Hide
// action. Body is whatever the caller passes in.

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { t as tr } from '../lib/i18n';

export function CollapsibleSection({
  title,
  onClose,
  onRefresh,
  refreshDisabled,
  children,
}: {
  title: string;
  onClose: () => void;
  /** M17 Codex P1.8 — small refresh button alongside Hide. Re-fires the
   *  upstream hook when tapped. Don't auto-refresh on re-open (cost-aware
   *  — each tap costs an AI call); explicit user gesture only. */
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: radii.lg,
        backgroundColor: t.card,
        padding: 14,
        gap: 10,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>{title}</Eyebrow>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {onRefresh ? (
            <Pressable
              onPress={onRefresh}
              accessibilityRole="button"
              accessibilityLabel={tr('outfitDetail.refreshAction')}
              accessibilityHint="Re-runs the suggestion to fetch a fresh result"
              disabled={refreshDisabled}
              hitSlop={6}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 11,
                  letterSpacing: 1.4,
                  color: refreshDisabled ? t.fg3 : t.fg2,
                  textTransform: 'uppercase',
                }}>
                {tr('outfitDetail.refreshAction')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Hide section"
            hitSlop={6}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 11,
                letterSpacing: 1.4,
                color: t.fg2,
                textTransform: 'uppercase',
              }}>
              Hide
            </Text>
          </Pressable>
        </View>
      </View>
      {children}
    </View>
  );
}
