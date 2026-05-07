// AccentColorStep — onboarding accent-color picker (M26).
//
// Mirrors web's `src/components/onboarding/AccentColorStep.tsx` swatch grid.
// The persisted hex is METADATA only — the mobile theme's brand accent stays
// the warm-gold token (see `mobile/src/theme/tokens.ts`). The recorded value
// drives downstream color memory + future personalization, not the live UI
// tint. (Web does live-tint via CSS variables; mobile chooses not to, so the
// step writes the chosen hex and moves on.)
//
// Layout: Eyebrow + PageTitle + Caption + 3-column swatch grid (12 curated
// swatches at 44×44 with `CheckIcon` infill on selection) + Continue button.
//
// Patterns (mobile/CLAUDE.md):
//  - Reuses Eyebrow / PageTitle / Caption / Button primitives.
//  - All copy via `t(...)` from `../../lib/i18n` — zero hardcoded English.
//  - Token-aware contrast for the check icon via `isLightSwatch(hex)`
//    (perceptual-luminance threshold; identical heuristic to M25's
//    StyleQuizV4Step.QColors).
//  - Required-touch gate: Continue is disabled until the user explicitly
//    taps a swatch. Skip is delegated to the OnboardingScreen header (parent
//    advances without writing accent_color).

import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { CheckIcon } from '../../components/icons';
import { hapticSelection } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';
import { useTokens } from '../../theme/ThemeProvider';

// ─── Curated 12-swatch palette ────────────────────────────────────────────
//
// Mirrors the web `ACCENT_COLORS` set (`src/contexts/ThemeContext.tsx`) so
// the persisted hex round-trips identically across platforms. Hex values are
// data, not design tokens — they ARE the swatches the user picks from, so
// the "no hardcoded hex" rule does not apply here (per M26 wave brief).

interface AccentSwatch {
  id: string;
  hex: string;
}

export const ACCENT_SWATCHES: readonly AccentSwatch[] = [
  { id: 'indigo', hex: '#2F3A8F' },
  { id: 'petrol', hex: '#0D5C63' },
  { id: 'forest', hex: '#206B4A' },
  { id: 'sage', hex: '#5C8A6E' },
  { id: 'navy', hex: '#264573' },
  { id: 'slate', hex: '#556880' },
  { id: 'burgundy', hex: '#8A2843' },
  { id: 'rose', hex: '#B94D6E' },
  { id: 'terracotta', hex: '#A65A35' },
  { id: 'amber', hex: '#BB8820' },
  { id: 'plum', hex: '#6E3A8A' },
  { id: 'charcoal', hex: '#404040' },
] as const;

export type AccentSwatchId = (typeof ACCENT_SWATCHES)[number]['id'];

// Perceptual-luminance threshold for "is this swatch light enough that a
// dark check icon reads better than a light one?". Matches the
// StyleQuizV4Step.QColors heuristic byte-for-byte. Coefficients are the
// standard Rec. 601 weights; threshold 200/255 is empirically tuned. The
// 12-swatch accent palette is mostly mid/dark, so in practice this returns
// false for every swatch — but the gate is kept for future palette
// extensions and documented intent.
function isLightSwatch(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return r * 0.299 + g * 0.587 + b * 0.114 > 200;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function AccentColorStep({
  initial,
  onComplete,
  onSkip,
}: {
  /** Resume value — fed by OnboardingScreen when its AsyncStorage draft
   *  carries a previously-picked color. `null` means "no prior pick". */
  initial?: { color: string | null };
  /** Called with the chosen hex when Continue is tapped. The parent merges
   *  it into `profiles.preferences.accent_color` at finish-time. */
  onComplete: (data: { color: string }) => void;
  /** Optional skip handler — currently the OnboardingScreen header drives
   *  skip, so this is wired for completeness/future surfaces (e.g.
   *  Settings → "Change accent color" entry that wants its own Skip CTA). */
  onSkip?: () => void;
}) {
  const t = useTokens();
  const [selected, setSelected] = useState<string | null>(initial?.color ?? null);

  const canContinue = selected !== null;

  const handlePick = (hex: string) => {
    hapticSelection();
    setSelected(hex);
  };

  const handleContinue = () => {
    if (!selected) return;
    onComplete({ color: selected });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: 8, marginBottom: 24 }}>
          <Eyebrow>{tr('onboarding.accentColor.eyebrow')}</Eyebrow>
          <PageTitle>{tr('onboarding.accentColor.title')}</PageTitle>
          <Caption>{tr('onboarding.accentColor.intro')}</Caption>
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 14,
            justifyContent: 'flex-start',
          }}
          accessible
          accessibilityLabel={tr('onboarding.accentColor.title')}>
          {ACCENT_SWATCHES.map((swatch) => {
            const isSelected = selected === swatch.hex;
            const checkColor = isLightSwatch(swatch.hex) ? t.fg : t.bg;
            return (
              <Pressable
                key={swatch.id}
                onPress={() => handlePick(swatch.hex)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={tr(`onboarding.accentColor.swatch.${swatch.id}`)}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: swatch.hex,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? t.fg : t.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}>
                {isSelected ? <CheckIcon size={18} color={checkColor} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {onSkip ? (
            <Button
              label={tr('onboarding.accentColor.skip')}
              variant="quiet"
              size="md"
              onPress={onSkip}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              label={tr('onboarding.accentColor.continue')}
              variant="accent"
              block
              disabled={!canContinue}
              onPress={handleContinue}
            />
          </View>
        </View>
        {!canContinue ? (
          <View style={{ marginTop: 8 }}>
            <Caption>{tr('onboarding.accentColor.requiredHint')}</Caption>
          </View>
        ) : null}
      </View>
    </View>
  );
}
