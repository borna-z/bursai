// AccentColorStep — onboarding accent-color picker (M26).
//
// Mirrors web's `src/components/onboarding/AccentColorStep.tsx` swatch grid.
// The persisted hex is METADATA only — the mobile theme's brand accent stays
// the warm-gold token (see `mobile/src/theme/tokens.ts`). The recorded value
// drives downstream color memory + future personalization, not the live UI
// tint. (Web does live-tint via CSS variables; mobile chooses not to, so the
// step writes the chosen swatch and moves on.)
//
// Layout: Eyebrow + PageTitle + Caption + 3-column swatch grid (12 curated
// swatches at 44×44 with `CheckIcon` infill on selection) + Continue button.
//
// Patterns (mobile/CLAUDE.md):
//  - Reuses Eyebrow / PageTitle / Caption / Button primitives.
//  - All copy via `t(...)` from `../../lib/i18n` — zero hardcoded English.
//  - Token-aware contrast for the check icon via `isLightSwatch(hex)`
//    (perceptual-luminance threshold; shared helper in `../../lib/color`).
//  - No required-touch gate (web parity, M26 review): Continue is always
//    enabled. On first mount with no resume value we pre-select 'amber',
//    which mirrors web ThemeContext's `DEFAULT_ACCENT_ID`. Skip is delegated
//    to the OnboardingScreen header (parent advances without writing).

import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import { CheckIcon } from '../../components/icons';
import { hapticSelection } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';
import { isLightSwatch } from '../../lib/color';
import { useTokens } from '../../theme/ThemeProvider';

// ─── Curated 12-swatch palette ────────────────────────────────────────────
//
// Mirrors the web `ACCENT_COLORS` set (`src/contexts/ThemeContext.tsx`) so
// the persisted swatch round-trips identically across platforms. Hex values
// are data, not design tokens — they ARE the swatches the user picks from,
// so the "no hardcoded hex" rule does not apply here (per M26 wave brief).

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

const DEFAULT_ACCENT_ID: AccentSwatchId = 'amber';

// ─── Component ─────────────────────────────────────────────────────────────

export function AccentColorStep({
  initial,
  onComplete,
  onSkip,
}: {
  /** Resume value — fed by OnboardingScreen when its AsyncStorage draft
   *  carries a previously-picked swatch. `id`/`hex` undefined means "no
   *  prior pick"; we pre-select the web default ('amber') so Continue
   *  always has something meaningful to send. */
  initial?: { id?: string; hex?: string };
  /** Called with the chosen swatch when Continue is tapped. The parent
   *  merges the id (web-key) and hex (mobile-key) into
   *  `profiles.preferences.{accentColor,accent_color}` at finish-time. */
  onComplete: (data: { id: string; hex: string }) => void;
  /** Optional skip handler — currently the OnboardingScreen header drives
   *  skip, so this is wired for completeness/future surfaces (e.g.
   *  Settings → "Change accent color" entry that wants its own Skip CTA). */
  onSkip?: () => void;
}) {
  const t = useTokens();
  // Pre-select either the resume value or the web default ('amber'). With
  // the required-touch gate dropped (M26 review, P1), Continue must always
  // produce a valid swatch to match web's "writes the currently-active
  // accent on click" behaviour.
  const initialId =
    (initial?.id && ACCENT_SWATCHES.some((s) => s.id === initial.id)
      ? initial.id
      : null) ??
    (initial?.hex
      ? ACCENT_SWATCHES.find((s) => s.hex.toLowerCase() === initial.hex!.toLowerCase())?.id ?? null
      : null) ??
    DEFAULT_ACCENT_ID;
  const [selectedId, setSelectedId] = useState<string>(initialId);

  const handlePick = (id: string) => {
    hapticSelection();
    setSelectedId(id);
  };

  const handleContinue = () => {
    const swatch = ACCENT_SWATCHES.find((s) => s.id === selectedId);
    if (!swatch) return;
    onComplete({ id: swatch.id, hex: swatch.hex });
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
          // Use radiogroup role so the container is semantically grouped
          // WITHOUT collapsing children into one a11y node. (M26 review:
          // `accessible` flattened the 12 swatches on iOS, defeating the
          // per-swatch labels.) The accessibilityLabel on the container is
          // dropped — the title above already describes the group.
          accessibilityRole="radiogroup">
          {ACCENT_SWATCHES.map((swatch) => {
            const isSelected = selectedId === swatch.id;
            const swatchIsLight = isLightSwatch(swatch.hex);
            const checkColor = swatchIsLight ? t.fg : t.bg;
            // Selection ring must contrast with EVERY swatch fill. Dark
            // swatches (charcoal/navy/indigo/petrol/forest/burgundy/plum)
            // disappear under `t.fg` (near-black). Flip to `t.bg` on dark
            // swatches so the ring stays visible. (M26 review.)
            const selectedBorder = swatchIsLight ? t.fg : t.bg;
            return (
              <Pressable
                key={swatch.id}
                onPress={() => handlePick(swatch.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={tr(`onboarding.accentColor.swatch.${swatch.id}`)}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: swatch.hex,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? selectedBorder : t.border,
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
              onPress={handleContinue}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
