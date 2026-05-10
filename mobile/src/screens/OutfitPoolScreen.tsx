// OutfitPoolScreen — M16 entry surface for batch outfit generation.
//
// Receives optional `{ anchorGarmentId, occasion, count }` route params,
// kicks `useOutfitPool.generatePool()` on mount, renders a 2-column grid
// of generated drafts with tap-to-toggle selection, and persists the
// selected drafts via a small inline insert (`outfits` + `outfit_items`)
// when the user taps "Save selected (N)". Per-save failures swallow into
// a toast so a single bad insert doesn't block the rest of the batch.
//
// Subscription gating: `error === 'subscription_required'` routes to the
// PaywallScreen the same way `OutfitGenerateScreen` does (sticky ref so
// repeated retries after a paywall dismiss don't re-pop the modal).
//
// Empty state: when generation completes with zero drafts (full failure),
// render the M16 i18n empty-state copy + a Retry button. Partial results
// (`completed < count`) are NOT empty-stated — the user sees the drafts
// that did land, plus a "Generate more" CTA in the sticky bottom bar.

import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Button } from '../components/Button';
import { IconBtn } from '../components/IconBtn';
import { ErrorState } from '../components/ErrorState';
import { CloseIcon } from '../components/icons';
import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_SENTINEL } from '../lib/edgeFunctionClient';
import { supabase } from '../lib/supabase';
import { useOutfitPool, type ScoredOutfitDraft } from '../hooks/useOutfitPool';
import { hapticLight, hapticSuccess } from '../lib/haptics';
import { Sentry } from '../lib/sentry';
import { outfitGradientHue } from '../lib/outfitDisplay';
import { t as tr } from '../lib/i18n';
import { showToast } from '../lib/toast';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'OutfitPool'>;

const DEFAULT_COUNT = 5;

export function OutfitPoolScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Snapshot route params once — they're stable per-mount, and re-reading
  // would otherwise churn the dep arrays on the regenerate path.
  const anchorGarmentId = route.params?.anchorGarmentId?.trim() || undefined;
  const occasion = route.params?.occasion?.trim() || undefined;
  const requestedCount = Math.max(
    1,
    Math.min(10, Math.floor(route.params?.count ?? DEFAULT_COUNT)),
  );

  const { pool, isGenerating, error, completed, generatePool, reset } = useOutfitPool();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = React.useState(false);
  const paywallShownRef = React.useRef(false);

  // Kick generation on mount + when the anchor / occasion / count change.
  React.useEffect(() => {
    void generatePool({
      count: requestedCount,
      anchorGarmentId,
      occasion,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorGarmentId, occasion, requestedCount]);

  // Route to paywall once per screen lifetime when the engine surfaces the
  // subscription sentinel — sticky ref so a back-and-forth doesn't re-pop.
  React.useEffect(() => {
    if (error === SUBSCRIPTION_SENTINEL && !paywallShownRef.current) {
      paywallShownRef.current = true;
      nav.navigate('Paywall');
    }
  }, [error, nav]);

  const toggle = React.useCallback((draftId: string) => {
    hapticLight();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(draftId)) next.delete(draftId);
      else next.add(draftId);
      return next;
    });
  }, []);

  const regenerate = React.useCallback(() => {
    hapticLight();
    setSelectedIds(new Set());
    reset();
    void generatePool({
      count: requestedCount,
      anchorGarmentId,
      occasion,
    });
  }, [reset, generatePool, requestedCount, anchorGarmentId, occasion]);

  const persistDraft = React.useCallback(
    async (draft: ScoredOutfitDraft): Promise<boolean> => {
      if (!user) return false;
      try {
        const { data: outfit, error: insertErr } = await supabase
          .from('outfits')
          .insert({
            user_id: user.id,
            occasion: draft.occasion ?? null,
            explanation: draft.explanation ?? '',
            family_label: draft.family_label ?? null,
            saved: true,
          })
          .select('id')
          .single();
        if (insertErr) throw insertErr;

        const itemRows = draft.items.map((item) => ({
          outfit_id: outfit.id,
          garment_id: item.garment_id,
          slot: item.slot,
        }));
        const { error: itemsErr } = await supabase.from('outfit_items').insert(itemRows);
        if (itemsErr) throw itemsErr;

        return true;
      } catch (err) {
        // Per-draft swallow — surface count of failures via the toast at
        // the end of the batch. A single bad insert shouldn't block the
        // rest of the user's selected pool. Sentry breadcrumb so a
        // sustained pattern shows up in the dashboard.
        Sentry.withScope((s) => {
          s.setTag('mutation', 'OutfitPoolScreen.persistDraft');
          Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
        });
        return false;
      }
    },
    [user],
  );

  const saveSelected = React.useCallback(async () => {
    // Bail before the haptic fires — a no-op save shouldn't trigger any
    // tactile feedback (P3.4).
    if (selectedIds.size === 0 || !user) return;
    hapticLight();
    setIsSaving(true);
    try {
      const drafts = pool.filter((d) => selectedIds.has(d.draftId));
      // Parallel inserts — `Promise.all` over the per-draft helper which
      // already swallows individual failures. Counts both buckets so the
      // toast can surface partial saves honestly.
      const results = await Promise.all(drafts.map((d) => persistDraft(d)));
      const savedCount = results.filter(Boolean).length;
      const failedCount = results.length - savedCount;

      // N3.10 F-009 — name the failed drafts in the toast so the user knows
      // which looks didn't land instead of a bare "X couldn't be saved".
      // Falls back to "Look {n}" when a draft has no family_label/occasion.
      const failedNames = drafts
        .map((d, i) => ({ draft: d, ok: results[i], idx: i }))
        .filter(({ ok }) => !ok)
        .map(({ draft, idx }) =>
          draft.family_label?.trim()
            || draft.occasion?.trim()
            || `Look ${idx + 1}`,
        );

      // Only invalidate if at least one save landed — invalidating on
      // total failure would force a needless refetch with no new rows.
      if (savedCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['outfits'] });
      }

      if (savedCount > 0) hapticSuccess();
      // Title swaps to a failure framing when nothing landed; the body
      // surfaces the partial-save count + names so the user knows which
      // looks didn't land. Empty title-only alert ("0 saved") was
      // misleading on total failure.
      const title = savedCount === 0
        ? tr('outfitPool.saveFailedTitle')
        : tr('outfitPool.savedTemplate', { n: savedCount });
      const body = failedCount > 0
        ? failedNames.length > 0
          ? tr('outfitPool.partialSaveBodyWithNames', {
              failed: failedCount,
              names: failedNames.join(', '),
            })
          : tr('outfitPool.partialSaveBody', { failed: failedCount })
        : '';
      // N3b — non-blocking save summary; the user can keep generating /
      // saving so don't block them with a modal.
      showToast(savedCount === 0 ? 'error' : 'success', title, body || undefined);

      // Clear selection but keep the pool around so the user can save more.
      setSelectedIds(new Set());
    } finally {
      setIsSaving(false);
    }
  }, [selectedIds, pool, user, persistDraft, queryClient]);

  // Subscription branch — render a soft pre-paywall affordance so the
  // screen isn't blank between the redirect-effect and the modal mount.
  if (error === SUBSCRIPTION_SENTINEL) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <Header onClose={() => nav.goBack()} />
        <View style={s.empty}>
          <Eyebrow>{tr('outfitPool.empty.title')}</Eyebrow>
          <Text style={[s.emptyBody, { color: t.fg2 }]}>{tr('outfitPool.empty.body')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Full-failure empty state — generation finished, zero drafts landed.
  // Note: this path also fires when `error` is set; the ErrorState handles
  // both branches (raw error message or fallback empty copy).
  const isFullyFailed =
    !isGenerating && pool.length === 0 && (error !== null || completed === 0);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <Header onClose={() => nav.goBack()} />
      {isFullyFailed ? (
        <ErrorState
          title={tr('outfitPool.empty.title')}
          body={error && error !== SUBSCRIPTION_SENTINEL ? error : tr('outfitPool.empty.body')}
          onRetry={regenerate}
        />
      ) : (
        <>
          {/* Progress eyebrow — visible while generating OR after a partial
              batch lands so the user understands "5 of 7 ready". */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 8, alignItems: 'center' }}>
            <Eyebrow>
              {tr('outfitPool.progressTemplate', { n: completed, total: requestedCount })}
            </Eyebrow>
          </View>

          <FlatList
            data={pool}
            keyExtractor={(draft) => draft.draftId}
            numColumns={2}
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingBottom: insets.bottom + 140, // leave room for sticky bar
              gap: 10,
            }}
            columnWrapperStyle={{ gap: 10 }}
            renderItem={({ item: draft }) => (
              <PoolCell
                draft={draft}
                selected={selectedIds.has(draft.draftId)}
                onPress={() => toggle(draft.draftId)}
              />
            )}
            ListEmptyComponent={
              isGenerating ? (
                <View style={s.empty}>
                  <Eyebrow>{tr('outfitPool.title')}</Eyebrow>
                  <Text style={[s.emptyBody, { color: t.fg2 }]}>
                    {tr('outfitPool.progressTemplate', { n: 0, total: requestedCount })}
                  </Text>
                </View>
              ) : null
            }
          />

          {/* Sticky bottom bar — Save selected + Generate more. */}
          <View
            style={[
              s.bottomBar,
              {
                backgroundColor: t.bg,
                borderTopColor: t.border,
                paddingBottom: insets.bottom + 12,
              },
            ]}>
            {/* Buttons share the row width — `block` (which sets
                `width: '100%'` per the Button primitive contract) would
                push each button to fill the parent and break the
                horizontal layout. `flex: 1` lets them split evenly. */}
            <Button
              label={tr('outfitPool.saveSelectedTemplate', { n: selectedIds.size })}
              onPress={saveSelected}
              style={{ flex: 1 }}
              disabled={selectedIds.size === 0 || isSaving}
            />
            <Button
              label={tr('outfitPool.generateMore')}
              onPress={regenerate}
              variant="outline"
              disabled={isGenerating}
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  const t = useTokens();
  return (
    <View style={s.header}>
      <IconBtn ariaLabel="Close" onPress={() => { hapticLight(); onClose(); }}>
        <CloseIcon color={t.fg} />
      </IconBtn>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Eyebrow>Pool</Eyebrow>
        <PageTitle style={{ marginTop: 4 }}>{tr('outfitPool.title')}</PageTitle>
      </View>
      <View style={{ width: 36 }} />
    </View>
  );
}

function PoolCell({
  draft,
  selected,
  onPress,
}: {
  draft: ScoredOutfitDraft;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  const hue = outfitGradientHue(draft.draftId);
  const itemCount = draft.items.length;
  const sub = `${itemCount} PIECE${itemCount === 1 ? '' : 'S'}`;
  const name = draft.family_label?.trim() || draft.occasion?.trim() || 'Look';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${sub}`}
      accessibilityHint="Toggles selection"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        s.cell,
        {
          borderColor: selected ? t.accent : t.border,
          backgroundColor: t.card,
          transform: pressed ? [{ scale: 0.98 }] : [],
        },
      ]}>
      <View style={{ aspectRatio: 1, position: 'relative' }}>
        <LinearGradient
          colors={[`hsl(${hue}, 38%, 78%)`, `hsl(${(hue + 30) % 360}, 30%, 62%)`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {selected ? (
          <View style={[s.checkBadge, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentFg, fontFamily: fonts.uiSemi, fontSize: 11 }}>✓</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 2 }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 9.5,
            letterSpacing: 1.6,
            color: t.fg2,
            textTransform: 'uppercase',
          }}>
          {sub}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.displayMedium,
            fontStyle: 'italic',
            fontSize: 14,
            color: t.fg,
            letterSpacing: -0.14,
          }}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyBody: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
  },
});
