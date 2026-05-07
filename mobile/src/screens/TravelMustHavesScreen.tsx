// Travel Capsule — Step 2 of 3. Must-haves with edit support.
//
// M28 wired this screen to real data. The capsule is generated server-side
// before this screen mounts (see useGenerateTravelCapsule); this screen
// reads `capsuleId` from route params, looks up the row via
// useTravelCapsule(), and renders the must_haves the wizard seeded.
//
// Each row is a tri-state toggle:
//   • have   — bringing this piece (default for rows seeded from the
//              user's prior selection)
//   • buy    — gap they intend to purchase before the trip
//   • unsure — explicitly deferred decision
//
// Edits persist via useUpdateTravelCapsuleMustHaves with optimistic
// updates so the toggle reflects instantly. The "Continue · Packing list"
// CTA threads `capsuleId` into TravelPackingList.
//
// Empty-state copy renders when the capsule has no must_haves seeded
// (e.g. user picked nothing on Step 1, or this is a legacy row from
// before the M28 wave) — the user can still continue to the packing
// list.

import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { Card } from '../components/Card';
import { BackIcon } from '../components/icons';
import { t as tr } from '../lib/i18n';
import {
  useTravelCapsule,
  useUpdateTravelCapsuleMustHaves,
  type TravelCapsuleMustHave,
  type TravelCapsuleMustHaveStatus,
} from '../hooks/useTravelCapsules';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'TravelMustHaves'>;

const STATUS_CYCLE: TravelCapsuleMustHaveStatus[] = ['have', 'buy', 'unsure'];

function nextStatus(s: TravelCapsuleMustHaveStatus): TravelCapsuleMustHaveStatus {
  const idx = STATUS_CYCLE.indexOf(s);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

function statusLabel(s: TravelCapsuleMustHaveStatus): string {
  switch (s) {
    case 'have':
      return tr('travelMustHaves.status.have');
    case 'buy':
      return tr('travelMustHaves.status.buy');
    case 'unsure':
      return tr('travelMustHaves.status.unsure');
  }
}

export function TravelMustHavesScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const capsuleId = route.params?.capsuleId;
  const { capsule, isLoading } = useTravelCapsule(capsuleId);
  const updateMustHaves = useUpdateTravelCapsuleMustHaves();

  // Local working copy so the user can flip several toggles before the
  // optimistic write debounces. We persist on every change and let the
  // optimistic-update reconcile back. Initialised from the row.
  const [draft, setDraft] = React.useState<TravelCapsuleMustHave[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  // Sync local state from the cached capsule once. We don't sync on
  // every render — the parent's optimistic update would clobber the
  // user's mid-flight tap. Re-sync if the capsuleId changes (e.g.
  // navigation pushes a different row mid-mount).
  React.useEffect(() => {
    if (!capsule) return;
    setDraft(capsule.must_haves);
    setHydrated(true);
  }, [capsule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = React.useCallback(
    (mh: TravelCapsuleMustHave) => {
      if (!capsuleId) return;
      // Capture the pre-toggle snapshot explicitly so rollback survives
      // a second toggle landing while the first is still in-flight. A
      // closed-over `draft` would point at the most recent render's
      // value — onError would restore the wrong baseline.
      const prev = draft;
      const next = draft.map((row) =>
        row.id === mh.id ? { ...row, status: nextStatus(row.status) } : row,
      );
      setDraft(next);
      updateMustHaves.mutate(
        { capsuleId, mustHaves: next },
        {
          onError: () => {
            // Roll back local state on persistence failure so the row
            // doesn't lie about a status that didn't actually save.
            setDraft(prev);
            Alert.alert('', tr('travelMustHaves.saveFailed'));
          },
        },
      );
    },
    [capsuleId, draft, updateMustHaves],
  );

  const handleContinue = React.useCallback(() => {
    if (!capsuleId) return;
    nav.navigate('TravelPackingList', { capsuleId });
  }, [capsuleId, nav]);

  const showEmpty = hydrated && draft.length === 0;

  // Without a capsuleId, the screen has nothing to render — bounce back
  // to the wizard. Direct deep-link entry shouldn't be possible today
  // but the guard keeps the navigator types honest.
  if (!capsuleId) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <Header onBack={() => nav.goBack()} />
        <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 12 }}>
          <Caption>{tr('travelMustHaves.empty.body')}</Caption>
          <Button label="Back to wizard" variant="accent" onPress={() => nav.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={draft}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, paddingBottom: 14, gap: 14 }}>
            <Header onBack={() => nav.goBack()} />
            <Eyebrow>Step 2 of 3</Eyebrow>
            <PageTitle>{tr('travelMustHaves.heading')}</PageTitle>
            <Caption>{tr('travelMustHaves.intro')}</Caption>
            {capsule?.destination ? <Eyebrow>{capsule.destination}</Eyebrow> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : showEmpty ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 14 }}>
              <Card padding={16}>
                <View style={{ gap: 6 }}>
                  <Eyebrow>{tr('travelMustHaves.empty.title')}</Eyebrow>
                  <Caption>{tr('travelMustHaves.empty.body')}</Caption>
                </View>
              </Card>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <MustHaveRow row={item} onToggle={() => handleToggle(item)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Sticky continue bar */}
      <View style={[s.stickyBar, { backgroundColor: t.bg, borderTopColor: t.border }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{capsule?.destination ?? ''}</Eyebrow>
          <Caption style={{ marginTop: 2 }}>
            {draft.length === 0
              ? tr('travelMustHaves.empty.body')
              : `${draft.filter((r) => r.status === 'have').length} bringing · ${draft.filter((r) => r.status === 'buy').length} buying`}
          </Caption>
        </View>
        <Button
          label={tr('travelMustHaves.continueCta')}
          variant="accent"
          onPress={handleContinue}
        />
      </View>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  const t = useTokens();
  return (
    <View style={s.headerRow}>
      <IconBtn ariaLabel="Back" onPress={onBack} variant="ghost">
        <BackIcon color={t.fg} />
      </IconBtn>
    </View>
  );
}

function MustHaveRow({
  row,
  onToggle,
}: {
  row: TravelCapsuleMustHave;
  onToggle: () => void;
}) {
  const t = useTokens();
  const isHave = row.status === 'have';
  const isBuy = row.status === 'buy';
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={row.label || row.id}
      accessibilityHint={tr('travelMustHaves.status.aria')}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <Card padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            {row.category ? <Eyebrow>{row.category}</Eyebrow> : null}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 14,
                color: t.fg,
                letterSpacing: -0.13,
              }}>
              {row.label || row.id}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: radii.pill,
              backgroundColor: isHave ? t.accent : isBuy ? t.accentSoft : t.bg2,
              borderWidth: isBuy ? 1 : 0,
              borderColor: isBuy ? t.accent : 'transparent',
            }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 11,
                letterSpacing: 0.4,
                color: isHave ? t.accentFg : isBuy ? t.accent : t.fg2,
              }}>
              {statusLabel(row.status)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4 },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
