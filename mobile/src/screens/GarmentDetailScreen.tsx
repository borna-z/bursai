// Garment detail — opened from any garment card or list row.
// Layout (top→bottom): header (back · eyebrow + italic title · edit + more) · hero image
// (aspect 0.78, radius 18) with Studio badge top-left + wear count badge top-right · 3-tab strip
// (Info / Outfits / Similar) · tab body · sticky "Wear today" CTA at the bottom safe area.
//
// W2 wires real Supabase data via useGarment + useSignedUrl + useMarkWorn / useMarkLaundry /
// useDeleteGarment mutations. The Outfits and Similar tabs intentionally render empty
// placeholders pending Wave 9 hooks — fixture data was removed per the "no mock garment data
// in wired screens" rule.

import React from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { ListRow } from '../components/ListRow';
import { ErrorState } from '../components/ErrorState';
import { BackIcon, EditIcon, MoreIcon } from '../components/icons';
import { useGarment, useMarkLaundry, useMarkWorn, useDeleteGarment } from '../hooks/useGarments';
import { useNow } from '../hooks/useNow';
import { isActiveGarmentRenderStatus, useRenderJobStatus } from '../hooks/useRenderJobStatus';
import { useSignedUrl } from '../hooks/useSignedUrl';
import { localISODate } from '../lib/outfitDisplay';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import type { Garment } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'GarmentDetail'>;
type Tab = 'info' | 'outfits' | 'similar';

// djb2-ish — same as GarmentCard's fallback so an unloaded photo and the
// hero gradient share a colour family.
function hueFromId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

// Calendar-day diff via `localISODate` rather than ms-subtraction. The old
// `(Date.now() - ms) / 86400000 | 0` shape mis-counts on DST transition days
// (a wear logged 23 calendar hours ago can read "0 days" or "2 days" depending
// on the spring-forward / fall-back direction). Codex P2 on PR #738.
function formatLastWorn(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const wornAt = new Date(iso);
  if (Number.isNaN(wornAt.getTime())) return '—';
  const wornIso = localISODate(wornAt);
  const today = new Date();
  const todayIso = localISODate(today);
  if (wornIso >= todayIso) return 'Today';
  // Walk back one local day at a time off `today` until we hit the worn iso.
  // Capped at 30 to bound the loop on extreme staleness — beyond a month we
  // bail out to the locale date format below anyway.
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (localISODate(d) === wornIso) {
      if (i === 1) return 'Yesterday';
      return `${i} days ago`;
    }
  }
  // Beyond a month, show the date in the user's locale.
  return wornAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatPrice(value: number | null | undefined, currency: string | null | undefined): string | null {
  if (value == null) return null;
  const code = currency ?? 'EUR';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value);
  } catch {
    return `${value} ${code}`;
  }
}

function buildInfoFields(garment: Garment): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  const cat = [garment.category, garment.subcategory].filter(Boolean).join(' · ');
  if (cat) fields.push({ label: 'Category', value: cat });
  if (garment.color_primary) fields.push({ label: 'Color', value: garment.color_primary });
  if (garment.material) fields.push({ label: 'Material', value: garment.material });
  if (garment.fit) fields.push({ label: 'Fit', value: garment.fit });
  if (garment.pattern) fields.push({ label: 'Pattern', value: garment.pattern });
  const seasons = (garment.season_tags ?? []).filter(Boolean);
  if (seasons.length) fields.push({ label: 'Season', value: seasons.join(' · ') });
  fields.push({ label: 'Wear count', value: String(garment.wear_count ?? 0) });
  fields.push({ label: 'Last worn', value: formatLastWorn(garment.last_worn_at) });
  const price = formatPrice(garment.purchase_price, garment.purchase_currency);
  if (price) fields.push({ label: 'Price', value: price });
  if (garment.purchase_price && (garment.wear_count ?? 0) > 0) {
    const cpw = garment.purchase_price / (garment.wear_count ?? 1);
    const cpwFmt = formatPrice(cpw, garment.purchase_currency);
    if (cpwFmt) fields.push({ label: 'Cost per wear', value: cpwFmt });
  }
  return fields;
}

export function GarmentDetailScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  const id = route.params?.id;

  const { data: garment, isLoading, isError, refetch } = useGarment(id);
  const heroPath = garment?.rendered_image_path ?? garment?.original_image_path ?? null;
  const { data: heroUrl } = useSignedUrl(heroPath);

  // Studio-render polling. The hook only ticks while `render_status` is active
  // (`pending` = enqueued, `rendering` = worker claimed). Once the worker
  // writes the rendered image and flips render_status to 'ready', the hook's
  // terminal-state branch invalidates the garment cache, useGarment refetches,
  // and this gate disables. Same flow for 'failed' / the 90 s ceiling, except
  // no invalidation fires because the original image stays as the hero.
  //
  // Both 'pending' and 'rendering' must be in scope — the row transitions
  // pending → rendering when the worker claims the job, and a user opening
  // GarmentDetail after the claim would otherwise see no pill and no image
  // swap until manual refresh. (Codex P2 on PR #728. Web treats both as
  // active in `useGarments`, `GarmentCardSystem`, `RenderPendingOverlay`,
  // etc. — `isActiveGarmentRenderStatus` is the shared predicate.)
  const isStudioRendering = isActiveGarmentRenderStatus(garment?.render_status);
  const renderJobGarmentId = isStudioRendering ? (garment?.id ?? null) : null;
  // Side-effecting hook — the snapshot itself is unused on this surface. The
  // hook's own terminal-state effect invalidates the garment cache, which is
  // the only behaviour we need here. The pill below reads `render_status`
  // straight off the (now-fresh) garment row.
  useRenderJobStatus(renderJobGarmentId);
  const hasRenderedImage = !!garment?.rendered_image_path;

  const markWorn = useMarkWorn();
  const markLaundry = useMarkLaundry();
  const deleteGarment = useDeleteGarment();

  const [tab, setTab] = React.useState<Tab>('info');

  // Day-level idempotency gate for the "Wear today" CTA. The mutation
  // itself is read-modify-write on `wear_count`, so a tap that lands while
  // `markWorn.isPending` is still false-from-the-previous-render would
  // double-bump the counter. Derive `wornToday` from the cached
  // `last_worn_at` and disable the button when it matches today's local
  // date — same pattern useMarkOutfitWorn's screen consumers (Home,
  // OutfitDetail, Plan) follow. Codex P1 round-N from internal review.
  const now = useNow();
  const wornToday = React.useMemo(() => {
    if (!garment?.last_worn_at) return false;
    const lastWorn = new Date(garment.last_worn_at);
    if (Number.isNaN(lastWorn.getTime())) return false;
    return localISODate(lastWorn) === localISODate(now);
  }, [garment?.last_worn_at, now]);

  const handleWearToday = () => {
    if (!id) return;
    if (wornToday) return;
    hapticSuccess();
    markWorn.mutate(id, {
      onError: (err) => {
        Alert.alert('Could not log wear', err instanceof Error ? err.message : 'Try again.');
      },
    });
  };

  const handleAddToLaundry = () => {
    if (!id) return;
    // Haptic confirmation — without this the action is silent: the More menu
    // closes, the badge ticks on, but the screen looks identical for the
    // 200-500ms invalidate-and-refetch window. The audit (UX#6) flagged this
    // as a tap-to-feedback gap.
    hapticLight();
    markLaundry.mutate(
      { id, inLaundry: true },
      {
        onError: (err) => {
          Alert.alert('Could not move', err instanceof Error ? err.message : 'Try again.');
        },
      },
    );
  };

  const handleRemoveFromLaundry = () => {
    if (!id) return;
    hapticLight();
    markLaundry.mutate({ id, inLaundry: false });
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete', 'Delete this garment? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteGarment.mutate(id, {
            onSuccess: () => nav.goBack(),
            onError: (err) =>
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Try again.'),
          });
        },
      },
    ]);
  };

  const onMoreOptions = () => {
    if (!garment) return;
    const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (garment.in_laundry) {
      buttons.push({ text: 'Mark clean', onPress: handleRemoveFromLaundry });
    } else {
      buttons.push({ text: 'Add to laundry', onPress: handleAddToLaundry });
    }
    buttons.push({ text: 'Delete garment', style: 'destructive', onPress: handleDelete });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Options', undefined, buttons);
  };

  // Loading: show a quiet header skeleton + spinner block. Detail-screen
  // skeletons aren't part of the existing skeleton kit, so use the spinner
  // for now — adding a dedicated skeleton is scope creep for W2.
  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Loading…</Eyebrow>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={t.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !garment) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Not found</Eyebrow>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <ErrorState
          title={garment === null ? 'Garment not found' : undefined}
          body={garment === null ? "We couldn't find this piece in your wardrobe." : undefined}
          onRetry={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const fields = buildInfoFields(garment);
  const hue = hueFromId(garment.id);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.headerRow, { borderBottomColor: t.border }]}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Eyebrow>{garment.category ?? 'Wardrobe'}</Eyebrow>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.displayMedium,
              fontStyle: 'italic',
              fontSize: 18,
              lineHeight: 22,
              fontWeight: '500',
              color: t.fg,
              letterSpacing: -0.18,
            }}>
            {garment.title}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconBtn
            ariaLabel="Edit piece"
            variant="ghost"
            onPress={() => nav.navigate('EditGarment', { id: garment.id })}>
            <EditIcon color={t.fg} />
          </IconBtn>
          <IconBtn ariaLabel="More options" variant="ghost" onPress={onMoreOptions}>
            <MoreIcon color={t.fg} />
          </IconBtn>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 96,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { borderColor: t.border }]}>
          {/* Gradient placeholder behind the image — visible until the signed
              URL resolves AND when the image fails to load. */}
          <LinearGradient
            colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {heroUrl ? (
            <Image
              source={{ uri: heroUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
          {/* Studio badge — three states:
              • pending render → "Studio render…" with an inline spinner
              • rendered image present → "Studio"
              • otherwise (render_status='none' / 'failed') → hidden, the
                original photo stands on its own without a misleading label. */}
          {isStudioRendering ? (
            <View
              accessibilityLiveRegion="polite"
              accessibilityLabel="Studio render in progress"
              style={[s.heroBadge, s.heroBadgePending, { backgroundColor: t.accentSoft }]}>
              <ActivityIndicator size="small" color={t.accent} style={{ marginRight: 6 }} />
              <Text style={[s.heroBadgeText, { color: t.accent }]}>Studio render…</Text>
            </View>
          ) : hasRenderedImage ? (
            <View style={[s.heroBadge, { backgroundColor: t.accentSoft }]}>
              <Text style={[s.heroBadgeText, { color: t.accent }]}>Studio</Text>
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

        <View style={[s.tabStrip, { borderColor: t.border, backgroundColor: t.card }]}>
          {(['info', 'outfits', 'similar'] as Tab[]).map((tabId) => {
            const active = tab === tabId;
            const label = tabId === 'info' ? 'Info' : tabId === 'outfits' ? 'Outfits' : 'Similar';
            return (
              <Pressable
                key={tabId}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                onPress={() => setTab(tabId)}
                style={[
                  s.tabBtn,
                  { backgroundColor: active ? t.fg : 'transparent' },
                ]}>
                <Text
                  style={{
                    fontFamily: fonts.uiSemi,
                    fontSize: 12,
                    color: active ? t.bg : t.fg2,
                    letterSpacing: -0.1,
                  }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'info' ? (
          <View style={{ gap: 12 }}>
            <View style={[s.fieldGroup, { backgroundColor: t.card, borderColor: t.border }]}>
              {fields.map((f, i) => (
                <ListRow
                  key={f.label}
                  title={f.label}
                  hideChevron
                  last={i === fields.length - 1}
                  right={
                    <Text
                      style={{
                        fontFamily: fonts.uiMed,
                        fontSize: 13,
                        color: t.fg,
                        letterSpacing: -0.1,
                      }}>
                      {f.value}
                    </Text>
                  }
                  style={{ paddingHorizontal: 14 }}
                />
              ))}
            </View>
            {garment.occasion_tags && garment.occasion_tags.length > 0 ? (
              <View>
                <Eyebrow style={{ marginBottom: 8 }}>Tags</Eyebrow>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {garment.occasion_tags.map((tag) => (
                    <View
                      key={tag}
                      style={[s.tagChip, { backgroundColor: t.bg2, borderColor: t.border }]}>
                      <Text style={[s.tagChipText, { color: t.fg2 }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === 'outfits' ? (
          <EmptyTab title="Not in any outfit yet" body="Build a look featuring this piece." />
        ) : null}

        {tab === 'similar' ? (
          <EmptyTab title="No similar pieces" body="Similar-piece suggestions land in a future release." />
        ) : null}
      </ScrollView>

      <View
        style={[
          s.stickyBar,
          {
            backgroundColor: t.bg,
            borderTopColor: t.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}>
        <Button
          label={wornToday ? 'Worn today' : markWorn.isPending ? 'Logging…' : 'Wear today'}
          block
          disabled={wornToday || markWorn.isPending}
          onPress={handleWearToday}
        />
      </View>
    </SafeAreaView>
  );
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6 }}>
      <PageTitle size={22}>{title}</PageTitle>
      <Caption style={{ textAlign: 'center', maxWidth: 240 }}>{body}</Caption>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
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
  tabStrip: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagChipText: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    letterSpacing: -0.05,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
