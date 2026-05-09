// Profile — your at-a-glance view: avatar, style summary, wardrobe stats, settings shortcuts.
// Mirrors design_handoff_burs_rn/source/extra-screens.jsx ProfileScreen.

import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { IconBtn } from '../components/IconBtn';
import { Button } from '../components/Button';
import { StatBlock } from '../components/StatBlock';
import { SettingsRow } from '../components/SettingsRow';
import { Skeleton } from '../components/Skeleton';
import { BackIcon, GearIcon, GapsIcon, TshirtIcon } from '../components/icons';
import { ProfileSkeleton } from '../components/skeletons';
import { useAuth } from '../hooks/useAuth';
import { useShoppingList } from '../hooks/usePickMustHaves';
import { FORMALITY_BUCKETS_DISPLAY, useStyleDNA } from '../hooks/useStyleDNA';
import { useWardrobeStats } from '../hooks/useWardrobeStats';
import { t as tr } from '../lib/i18n';
import { styleColorToHex } from '../theme/styleColors';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const { user, profile } = useAuth();
  const { entries: shoppingEntries } = useShoppingList();
  const shoppingCount = shoppingEntries.length;
  const dnaQuery = useStyleDNA();
  const statsQuery = useWardrobeStats();
  const dna = dnaQuery.data;
  const stats = statsQuery.data;
  // Pull-to-refresh kicks both the DNA + stats queries in parallel so the
  // user can manually pull a fresh count after, e.g., adding garments on
  // another device. `refreshing` stays true until the slower of the two
  // settles. Initial-mount loading is handled by per-section skeletons
  // (the DNA card + stat row each render their own placeholder) so the
  // screen frame paints immediately rather than blanking on first open.
  const refreshing = dnaQuery.isFetching || statsQuery.isFetching;
  const onRefresh = React.useCallback(async () => {
    await Promise.all([dnaQuery.refetch(), statsQuery.refetch()]);
  }, [dnaQuery, statsQuery]);

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Your profile';
  const initial = (displayName.trim().charAt(0) || 'U').toUpperCase();
  const email = user?.email ?? '';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : '';

  // First-load (no cached data yet) renders the existing ProfileSkeleton
  // so the screen has structural feedback while the DNA + stats queries
  // are in flight on cold start. Once we have ANY cached data (initial
  // resolve OR a stale-while-refetch path) we fall through to the real
  // surfaces — per-section skeletons handle subsequent fetches.
  const isInitialLoading =
    (dnaQuery.isLoading && !dna) || (statsQuery.isLoading && !stats);
  if (isInitialLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              accessibilityLabel={tr('profile.refresh')}
            />
          }
          showsVerticalScrollIndicator={false}>
          <ProfileSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 18 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
            accessibilityLabel={tr('profile.refresh')}
          />
        }
        showsVerticalScrollIndicator={false}>
        {/* ============ HEADER ============ */}
        <View style={s.headerRow}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>Your profile</Eyebrow>
            <PageTitle>{displayName}</PageTitle>
          </View>
          <Button label="Edit" variant="outline" size="sm" onPress={() => nav.navigate('SettingsAccount')} />
        </View>

        {/* ============ AVATAR + IDENTITY ============ */}
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
          <View
            style={[
              s.avatar,
              { backgroundColor: t.accent },
            ]}>
            <Text style={{ color: t.accentFg, fontFamily: fonts.uiSemi, fontSize: 32, fontWeight: '600' }}>
              {initial}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 14.5,
              color: t.fg,
              fontWeight: '600',
              letterSpacing: -0.15,
            }}>
            {displayName}
          </Text>
          <Caption>
            {[email, memberSince ? `Member since ${memberSince}` : null].filter(Boolean).join(' · ')}
          </Caption>
        </View>

        {/* ============ STYLE SUMMARY ============ */}
        {/* M29: archetype + formality + vibes + signatureColors are all
            read from useStyleDNA(). The hook reads
            `user_style_summaries.summary_json` first (canonical once
            enough wear/feedback events exist) and falls back to the V4
            quiz answers when confidence is below threshold. The
            "Favorite colors" swatch row maps each `dna.signatureColors`
            name (e.g., 'navy', 'sage') to a hex via `styleColorToHex`;
            the section hides entirely when the DNA has no colors yet. */}
        <Card hero padding={18}>
          <Eyebrow style={{ marginBottom: 8 }}>Style DNA</Eyebrow>
          {dna ? (
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 22,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.22,
                marginBottom: 14,
              }}>
              {dna.archetype}
            </Text>
          ) : (
            <Skeleton radius={4} height={26} style={{ width: 180, marginBottom: 14 }} />
          )}

          {dna && dna.vibes.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {dna.vibes.map((vibe) => (
                <Chip key={vibe} label={vibe} active />
              ))}
            </View>
          ) : null}

          {dna && dna.signatureColors.length > 0 ? (
            <>
              <Eyebrow style={{ marginBottom: 8 }}>Favorite colors</Eyebrow>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {dna.signatureColors.slice(0, 5).map((colorName) => (
                  <View
                    key={colorName}
                    accessibilityLabel={colorName}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: styleColorToHex(colorName),
                      borderWidth: 1,
                      borderColor: t.border,
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Eyebrow style={{ marginBottom: 8 }}>Formality</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {FORMALITY_BUCKETS_DISPLAY.map((level) => (
              <Chip key={level} label={level} active={dna ? level === dna.formality : false} />
            ))}
          </View>

          {dna && dna.confidence < 0.2 ? (
            <Caption style={{ marginTop: 12 }}>
              {tr('profile.styleDNA.empty')}
            </Caption>
          ) : null}
        </Card>

        {/* ============ STATS ============ */}
        {/* M29: counts come from useWardrobeStats() (3 HEAD count queries
            in parallel). While the query is in flight on cold start the
            ProfileSkeleton above takes over; this render path only fires
            once stats have resolved at least once, so a stale-while-refetch
            shows the previous numbers (good UX) instead of blanking. */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatBlock
            num={stats ? stats.garmentCount : '—'}
            label={tr('profile.stats.garments')}
            accessibilityLabel={
              stats
                ? tr('profile.stats.garmentsTemplate', { count: stats.garmentCount })
                : undefined
            }
            style={{ flex: 1 }}
          />
          <StatBlock
            num={stats ? stats.outfitCount : '—'}
            label={tr('profile.stats.outfits')}
            accessibilityLabel={
              stats
                ? tr('profile.stats.outfitsTemplate', { count: stats.outfitCount })
                : undefined
            }
            style={{ flex: 1 }}
          />
          <StatBlock
            num={stats ? stats.wearLogCount : '—'}
            label={tr('profile.stats.wears')}
            accessibilityLabel={
              stats
                ? tr('profile.stats.wearLogsTemplate', { count: stats.wearLogCount })
                : undefined
            }
            style={{ flex: 1 }}
          />
        </View>

        {/* ============ SETTINGS LINKS ============ */}
        <Card padding={4}>
          <SettingsRow
            icon={<GearIcon size={18} color={t.accent} />}
            title={tr('profile.row.account.title')}
            caption={tr('profile.row.account.caption')}
            onPress={() => nav.navigate('SettingsAccount')}
          />
          <SettingsRow
            icon={<TshirtIcon size={18} color={t.accent} />}
            title={tr('profile.row.style.title')}
            caption={tr('profile.row.style.caption')}
            onPress={() => nav.navigate('SettingsStyle')}
          />
          {/* M24 — Shopping list shortcut. The screen handles the empty
              `gaps: []` case with a link back to gap analysis, so this
              row is reachable even before the user has run analysis. */}
          <SettingsRow
            icon={<GapsIcon size={18} color={t.accent} />}
            title={tr('profile.shoppingList')}
            caption={
              shoppingCount > 0
                ? tr('pickMustHaves.savedCountTemplate').replace(
                    '{count}',
                    String(shoppingCount),
                  )
                : tr('profile.shoppingListEmpty')
            }
            last
            onPress={() => nav.navigate('PickMustHaves', { gaps: [] })}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
