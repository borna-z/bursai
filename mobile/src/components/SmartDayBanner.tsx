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
// Hidden states: while the recommendation hook is loading we render a
// skeleton; on error or empty top1 we render nothing (engine errors aren't
// surfaced to users — the banner is advisory, not load-bearing).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { useTokens } from '../theme/ThemeProvider';
import { Eyebrow } from './Eyebrow';
import { PageTitle } from './PageTitle';
import { Caption } from './Caption';
import { OutfitCard } from './OutfitCard';
import { Skeleton } from './Skeleton';
import { useSmartDayRecommendation } from '../hooks/useSmartDayRecommendation';
import { useDaySummary } from '../hooks/useDaySummary';
import { outfitDisplayName, outfitGradientHue } from '../lib/outfitDisplay';
import { t } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/RootNavigator';

type BannerNav = NativeStackNavigationProp<RootStackParamList>;

function weekdayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long' });
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

export function SmartDayBanner() {
  const tokens = useTokens();
  const nav = useNavigation<BannerNav>();
  const recommendation = useSmartDayRecommendation();
  const summary = useDaySummary();

  const isLoading = recommendation.isLoading || summary.isLoading;
  const top1 = recommendation.top3[0] ?? null;

  // Hide entirely on engine error or no candidate outfit — the banner is
  // advisory only, surfacing the engine's diagnostics to end-users would be
  // noise. The existing today's-look hero card below picks up the slack.
  if (!isLoading && (!top1 || recommendation.error)) {
    return null;
  }

  const today = new Date();
  const weekday = weekdayLabel(today);
  const contextLabel = buildContextLabel(
    recommendation.context?.intelligence.dominant_occasion,
    recommendation.context?.weather?.temperature,
  );
  const eyebrowText = contextLabel
    ? t('home.smartDay.eyebrowTemplate', { weekday, context: contextLabel })
    : t('home.smartDay.fallback.eyebrow', { weekday });

  const titleText = summary.summaryText ?? t('home.smartDay.fallback.title');

  const handlePress = () => {
    if (top1) nav.navigate('OutfitDetail', { id: top1.outfit.id });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { borderColor: tokens.border, backgroundColor: tokens.card }]}>
        <View style={{ gap: 8, marginBottom: 14 }}>
          <Skeleton radius={4} height={11} style={{ width: 120 }} />
          <Skeleton radius={4} height={26} style={{ width: '85%' }} />
          <Skeleton radius={4} height={14} style={{ width: '60%' }} />
        </View>
        <Skeleton radius={18} height={170} style={{ width: '100%' }} />
      </View>
    );
  }

  if (!top1) return null;

  const outfit = top1.outfit;
  const hueSeed = outfitGradientHue(outfit.id);
  const hues = [hueSeed, (hueSeed + 30) % 360, (hueSeed + 60) % 360, (hueSeed + 90) % 360];

  return (
    <View style={[styles.container, { borderColor: tokens.border, backgroundColor: tokens.card }]}>
      <View style={{ marginBottom: 12, gap: 4 }}>
        <Eyebrow>{eyebrowText}</Eyebrow>
        <PageTitle size={22}>{titleText}</PageTitle>
      </View>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={t('home.smartDay.tapHint')}
        style={({ pressed }) => [{ transform: pressed ? [{ scale: 0.98 }] : [] }]}>
        <OutfitCard
          name={outfitDisplayName(outfit)}
          sub={(outfit.occasion ?? outfit.style_vibe ?? 'Today').toUpperCase()}
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
