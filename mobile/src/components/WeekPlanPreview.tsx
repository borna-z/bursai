// WeekPlanPreview — M16 surface rendered under PlanScreen's WeekStrip.
//
// Receives the 7 generated entries from `useWeekGenerator` (date + draft
// outfit + per-day error) and renders one row per day:
//   • date label (DOW + day-of-month) + occasion
//   • outfit preview (gradient swatch + piece count) when present
//   • skeleton when generating + outfit not yet landed
//   • "Couldn't generate {day} — tap to retry" pressable on per-day error
//   • quick-swap action (chevron) that fires `onSwapDay(date)`
//
// When `entries` is empty, renders a single "Generate week" CTA so the
// PlanScreen surface stays compact until the user opts in.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Button } from '../components/Button';
import { ChevronIcon } from '../components/icons';
import { hapticLight } from '../lib/haptics';
import { outfitGradientHue } from '../lib/outfitDisplay';
import { t as tr } from '../lib/i18n';
import type { WeekGeneratorEntry } from '../hooks/useWeekGenerator';

export type WeekPlanPreviewProps = {
  entries: WeekGeneratorEntry[];
  isGenerating: boolean;
  completed: number;
  /** Total expected (always 7 for the week generator; param keeps the
   *  copy honest if the loop ever reseeds with fewer days). */
  total?: number;
  onGenerateWeek: () => void;
  onSwapDay: (date: string) => void;
};

function formatDateLabel(iso: string): { dow: string; n: string } {
  // `iso` is YYYY-MM-DD in the user's local TZ — appending T00:00:00 keeps
  // it parsed as local midnight (avoids the UTC-skew gotcha noted in
  // localISODate's comment).
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { dow: '', n: '' };
  return {
    dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    n: String(d.getDate()),
  };
}

export function WeekPlanPreview({
  entries,
  isGenerating,
  completed,
  total = 7,
  onGenerateWeek,
  onSwapDay,
}: WeekPlanPreviewProps) {
  const t = useTokens();

  // Empty state — no week generated yet. Renders a single CTA so the
  // PlanScreen surface stays compact until the user opts in.
  if (entries.length === 0) {
    return (
      <View style={{ gap: 10 }}>
        <Eyebrow>{tr('weekPlan.title')}</Eyebrow>
        <Button
          label={isGenerating ? tr('weekPlan.generating') : tr('weekPlan.generate')}
          onPress={() => {
            if (!isGenerating) {
              hapticLight();
              onGenerateWeek();
            }
          }}
          disabled={isGenerating}
          block
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={s.headerRow}>
        <Eyebrow>{tr('weekPlan.title')}</Eyebrow>
        <Text style={[s.headerProgress, { color: t.fg3 }]}>
          {tr('weekPlan.progressTemplate', { n: completed, total })}
        </Text>
      </View>

      <View style={[s.list, { borderColor: t.border }]}>
        {entries.map((entry, idx) => (
          <WeekRow
            key={entry.date}
            entry={entry}
            isLast={idx === entries.length - 1}
            isGenerating={isGenerating}
            onPress={() => {
              hapticLight();
              onSwapDay(entry.date);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function WeekRow({
  entry,
  isLast,
  isGenerating,
  onPress,
}: {
  entry: WeekGeneratorEntry;
  isLast: boolean;
  isGenerating: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  const { dow, n } = formatDateLabel(entry.date);
  const dayLabel = `${dow} ${n}`;
  const hasOutfit = entry.outfit !== null;
  const hasError = entry.error !== null;
  // Pending state — generating, no outfit yet, no error. The screen-wide
  // `isGenerating` is the global flag (true during the sequential loop);
  // we infer per-row pendingness when the entry is empty + the global
  // flag is on.
  const isPending = isGenerating && !hasOutfit && !hasError;
  const hue = entry.outfit ? outfitGradientHue(entry.outfit.draftId) : 200;
  const itemCount = entry.outfit?.items.length ?? 0;
  const pieceLabel = itemCount === 1 ? '1 piece' : `${itemCount} pieces`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        hasError
          ? tr('weekPlan.dayFailedTemplate', { day: dayLabel })
          : `${dayLabel} ${entry.outfit?.occasion ?? ''}`
      }
      style={({ pressed }) => [
        s.row,
        {
          borderBottomColor: t.border,
          borderBottomWidth: isLast ? 0 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      {/* Date column */}
      <View style={{ width: 48, alignItems: 'flex-start' }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 9.5,
            letterSpacing: 1.4,
            color: t.fg2,
          }}>
          {dow}
        </Text>
        <Text
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 18,
            color: t.fg,
            letterSpacing: -0.18,
          }}>
          {n}
        </Text>
      </View>

      {/* Outfit / pending / error preview */}
      {hasError ? (
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13,
              color: t.destructive,
              letterSpacing: -0.13,
            }}
            numberOfLines={2}>
            {tr('weekPlan.dayFailedTemplate', { day: dayLabel })}
          </Text>
        </View>
      ) : isPending ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.md,
              backgroundColor: t.bg2,
              borderWidth: 1,
              borderColor: t.border,
            }}
          />
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13,
              color: t.fg3,
              letterSpacing: -0.13,
            }}>
            {tr('weekPlan.generating')}
          </Text>
        </View>
      ) : hasOutfit && entry.outfit ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.md,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: t.border,
            }}>
            <LinearGradient
              colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: '100%', height: '100%' }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 13,
                color: t.fg,
                letterSpacing: -0.13,
              }}>
              {entry.outfit.occasion ?? entry.outfit.family_label ?? 'Look'}
            </Text>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: 11,
                color: t.fg2,
              }}>
              {pieceLabel}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13,
              color: t.fg3,
              letterSpacing: -0.13,
            }}>
            {tr('weekPlan.swap')}
          </Text>
        </View>
      )}

      <ChevronIcon color={t.fg3} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerProgress: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  list: {
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
