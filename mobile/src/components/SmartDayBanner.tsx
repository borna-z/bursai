// SmartDayBanner — surfaces the day-intelligence engine on HomeScreen.
//
// Layout:
//   1. Eyebrow row: "{Weekday} · {Context}" or just "{Weekday}" until M35/M36
//      wire real weather + calendar feeds.
//   2. PageTitle italic: the natural-language summary text from the
//      `summarize_day` edge function. Falls back to a static prompt when the
//      engine returns null.
//   3. OutfitCard for `top1` from the recommendation engine, navigates to
//      OutfitDetail on tap.
//
// Hidden states: the banner self-hides (renders `null`) when:
//   - the user already has a planned outfit for today (the today's-look hero
//     owns that intent),
//   - the recommendation engine errored (advisory surface — stay quiet), or
//   - there's no candidate `top1` yet (empty wardrobe / scoring still in
//     flight). We deliberately don't render a skeleton; the today's-look
//     hero below owns the slot until we have a real outfit to surface,
//     so the layout doesn't shift after a skeleton flash.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from './Eyebrow';
import { PageTitle } from './PageTitle';
import { Caption } from './Caption';
import { OutfitCard } from './OutfitCard';
import {
  useSmartDayRecommendation,
  type UseSmartDayRecommendationOverrides,
} from '../hooks/useSmartDayRecommendation';
import { useDaySummary } from '../hooks/useDaySummary';
import { useNow } from '../hooks/useNow';
import { useTodayPlannedOutfit } from '../hooks/usePlannedOutfits';
import { outfitDisplayName, outfitGradientHue } from '../lib/outfitDisplay';
import { getLocale, t } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type BannerNav = NativeStackNavigationProp<RootStackParamList>;

// Intl accepts bare BCP47 language codes (`'sv'`, `'en'`, `'fr'`) directly,
// resolving them to a sensible region. We pass the active i18n locale through
// here so the weekday label localises with the rest of the UI instead of
// hard-coding `'en-US'`.
function intlLocale(code: string): string {
  return code;
}

function weekdayLabel(d: Date, locale: string): string {
  return d.toLocaleDateString(intlLocale(locale), { weekday: 'long' });
}

function buildContextLabel(occasion: string | undefined, temperature: number | undefined): string | null {
  const parts: string[] = [];
  if (occasion && occasion !== 'casual') {
    parts.push(occasion.charAt(0).toUpperCase() + occasion.slice(1));
  }
  if (typeof temperature === 'number' && Number.isFinite(temperature)) {
    parts.push(`${Math.round(temperature)}°C`);
  }
  return parts.length === 0 ? null : parts.join(' · ');
}

export interface SmartDayBannerProps {
  /** Optional overrides forwarded to `useSmartDayRecommendation` so HomeScreen
   *  can plumb real weather (M35) and synthetic occasion events through the
   *  scoring engine without the banner needing to know about either source. */
  overrides?: UseSmartDayRecommendationOverrides;
}

export function SmartDayBanner({ overrides }: SmartDayBannerProps = {}) {
  const tokens = useTokens();
  const nav = useNavigation<BannerNav>();
  const recommendation = useSmartDayRecommendation(overrides);
  // Forward the same overrides into the AI summary so its queryKey hash
  // changes when the user picks an occasion or weather loads — otherwise
  // the summary line stayed keyed on `noevents/noweather` and the eyebrow
  // diverged from the recommendation engine. Codex P2 on PR #771.
  const summary = useDaySummary({
    events: overrides?.events,
    weather: overrides?.weather,
  });
  // Read planned-outfit state directly so the banner self-gates: when the
  // user has a real planned look for today, the existing today's-look hero
  // owns the "today's pick" intent and a second banner above it is just
  // visual competition. The hook is tiny and already cached by Home, so
  // the duplicate subscription is effectively free.
  const todayPlanQ = useTodayPlannedOutfit();
  const hasPlannedOutfit = !!todayPlanQ.data?.outfit;

  // Reactive `now` so the weekday label rolls over at midnight / on
  // foreground without remount — same pattern Home/Plan/Insights got in
  // the M14 sweep.
  const now = useNow();
  const top1 = recommendation.top1;

  // Self-hide when the banner has nothing to add. Three exits:
  //  1. There's a planned outfit for today — let the hero own the slot.
  //  2. The recommendation engine errored — advisory surface, stay quiet.
  //  3. There's no candidate top1 (empty wardrobe / scoring still loading
  //     without a result yet) — render `null` so the today's-look hero
  //     doesn't shift up after a skeleton flash. While we wait for the
  //     scoring to settle we deliberately stay invisible; the hero below
  //     is the load-bearing surface.
  if (hasPlannedOutfit) return null;
  if (recommendation.error) return null;
  if (!top1) return null;

  const weekday = weekdayLabel(now, getLocale());
  const contextLabel = buildContextLabel(
    recommendation.context?.intelligence.dominant_occasion,
    recommendation.context?.weather?.temperature,
  );
  const eyebrowText = contextLabel
    ? t('home.smartDay.eyebrowTemplate', { weekday, context: contextLabel })
    : t('home.smartDay.fallback.eyebrow', { weekday });

  const titleText = summary.summaryText ?? t('home.smartDay.fallback.title');

  const outfit = top1.outfit;
  // Pull real garment rows off the joined `outfit_items.garment` shape so the
  // banner's OutfitCard renders signed-URL thumbnails instead of neutral
  // placeholders. Cap at 4 to match OutfitCard's 2×2 grid layout (mirrors
  // RecentOutfitTile). `filter` strips items whose garment is null (deleted /
  // RLS-blocked), so the count → layout switch inside OutfitCard reflects only
  // garments we can actually render. Empty result falls back to `hues.length`
  // neutral tiles inside OutfitCard.
  const cardGarments = (outfit.outfit_items ?? [])
    .slice(0, 4)
    .map((it) => it.garment)
    .filter((g): g is NonNullable<typeof g> => g !== null);
  const hueSeed = outfitGradientHue(outfit.id);
  const hues = [hueSeed, (hueSeed + 30) % 360, (hueSeed + 60) % 360, (hueSeed + 90) % 360];
  // `||` (not `??`) so a legacy empty-string `occasion` falls through to
  // `style_vibe` instead of rendering an empty subtitle.
  const outfitName = outfitDisplayName(outfit);
  const subLabel = (outfit.occasion || outfit.style_vibe || 'Today').toUpperCase();

  const handlePress = () => {
    nav.navigate('OutfitDetail', { id: outfit.id });
  };

  return (
    <View style={[styles.container, { borderColor: tokens.border, backgroundColor: tokens.card }]}>
      <View style={{ marginBottom: 12, gap: 4 }}>
        <Eyebrow>{eyebrowText}</Eyebrow>
        <PageTitle size={22}>{titleText}</PageTitle>
      </View>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={outfitName}
        accessibilityHint={t('home.smartDay.openHint')}
        style={({ pressed }) => [{ transform: pressed ? [{ scale: 0.98 }] : [] }]}>
        <OutfitCard
          name={outfitName}
          sub={subLabel}
          garments={cardGarments}
          hues={hues}
        />
      </Pressable>
      <View style={{ marginTop: 8, alignItems: 'flex-start' }}>
        <Caption>{t('home.smartDay.tapHint')}</Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
});
