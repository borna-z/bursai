// Wave S-C.3 — skeleton form rendered in Step 2 while analyze is in flight.
//
// Replaces the older cycling-phase-copy loading state ("Reading fabric…",
// "Detecting colors…"). The user sees a faithful silhouette of the Step 3
// form they're about to land on: a blurred title placeholder, disabled chip
// rows for category / colors / seasons, three disabled formality stops. This
// makes the wait read as "almost there" rather than "abstract progress."
//
// Design notes:
//   - Each row mirrors the analogous Step 3 section's layout (eyebrow + chip
//     row). Heights are slightly under the real Step 3 values because the
//     skeleton is non-interactive and we want it to feel lighter than the
//     real form.
//   - Reuses existing primitives: `Eyebrow` for section labels, `Shimmer` for
//     the pulse overlay on the title placeholder. No new low-level primitives.
//   - Tokens via `useTokens()`. No hardcoded hex.
//   - All static: no inputs, no state. Mounts in Step 2's loading branch and
//     unmounts when analyze resolves.

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { radii } from '../../theme/tokens';
import { Eyebrow } from '../Eyebrow';
import { Shimmer } from '../Shimmer';
import { t as tr } from '../../lib/i18n';

const SECTION_GAP = 18;
const CHIP_HEIGHT = 30;

/**
 * Single disabled-looking chip placeholder. Matches the Step 3 chip footprint
 * (height + radius + neutral surface) so the cross-fade to the real form
 * feels like fields populating rather than the layout shifting.
 */
function ChipStub({ width }: { width: number }) {
  const t = useTokens();
  return (
    <View
      style={{
        height: CHIP_HEIGHT,
        width,
        borderRadius: radii.pill,
        backgroundColor: t.card,
        borderWidth: 1,
        borderColor: t.border,
        opacity: 0.5,
      }}
    />
  );
}

/** A row of chip stubs with a leading Eyebrow label, mirroring Step 3 rows. */
function ChipRow({ eyebrow, widths }: { eyebrow: string; widths: number[] }) {
  return (
    <View style={{ gap: 8 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <View style={s.chipRow}>
        {widths.map((w, idx) => (
          <ChipStub key={idx} width={w} />
        ))}
      </View>
    </View>
  );
}

export function Step3FormSkeleton() {
  const t = useTokens();
  return (
    <View
      accessibilityRole="none"
      accessible
      accessibilityLabel={tr('addpiece.step2.skeleton.aria')}
      style={[s.wrap, { backgroundColor: t.bg }]}
    >
      {/* Title placeholder — blurred bar with the shimmer pulse overlaid so
          the user reads it as "title is loading" rather than an empty card.
          Heights mirror the Step 3 PageTitle (~26 pt). */}
      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('addpiece.step2.skeleton.titleEyebrow')}</Eyebrow>
        <View
          style={[
            s.titleStub,
            { backgroundColor: t.bg2, borderColor: t.border },
          ]}
        >
          <Shimmer />
        </View>
      </View>

      {/* Category — single representative chip stub row. */}
      <ChipRow
        eyebrow={tr('addpiece.step2.skeleton.categoryEyebrow')}
        widths={[78, 64, 92, 68]}
      />

      {/* Primary + secondary color swatch rows — two short rows so the visual
          rhythm doesn't get monotonous. */}
      <ChipRow
        eyebrow={tr('addpiece.step2.skeleton.colorEyebrow')}
        widths={[72, 56, 80, 62, 70]}
      />

      {/* Seasons — four narrow stubs matching the four-season chip count. */}
      <ChipRow
        eyebrow={tr('addpiece.step2.skeleton.seasonsEyebrow')}
        widths={[62, 62, 62, 62]}
      />

      {/* Formality — three explicit stops (matches FORMALITY_OPTIONS). The
          stops sit on a single row, evenly spaced. */}
      <View style={{ gap: 8 }}>
        <Eyebrow>{tr('addpiece.step2.skeleton.formalityEyebrow')}</Eyebrow>
        <View style={s.formalityRow}>
          {[0, 1, 2].map((idx) => (
            <View
              key={idx}
              style={[
                s.formalityStop,
                { backgroundColor: t.card, borderColor: t.border },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: SECTION_GAP,
  },
  titleStub: {
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formalityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formalityStop: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    opacity: 0.6,
  },
});
