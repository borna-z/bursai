// Pick Must-Haves — follow-up to WardrobeGapsScreen. Lets the user mark
// which gaps they want to actually buy + assign a priority, persists the
// selection as a "shopping list" inside profiles.preferences (JSONB).
//
// Reachable from:
//   • WardrobeGapsScreen "Pick must-haves" CTA — receives the gap list
//     fresh from analysis
//   • Profile "Shopping list" row — opens with `gaps: []`; the empty-state
//     branch renders a link back to gaps analysis.
//
// Persistence flows through `usePickMustHaves.ts` — single source of
// truth for the JSON shape + read-modify-write merge.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { PageTitle } from '../components/PageTitle';
import { Caption } from '../components/Caption';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconBtn } from '../components/IconBtn';
import { Chip } from '../components/Chip';
import { BackIcon, CheckIcon } from '../components/icons';
import {
  useShoppingList,
  useSaveShoppingList,
  type ShoppingListEntry,
  type ShoppingListPriority,
} from '../hooks/usePickMustHaves';
import { t as tr } from '../lib/i18n';
import { Sentry } from '../lib/sentry';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PickMustHaves'>;
type ScreenRoute = RouteProp<RootStackParamList, 'PickMustHaves'>;

// Local-only stable id. Mirrors the offlineQueue helper so the entry id
// is stable across edits + persists across sessions without pulling
// expo-crypto. Collision risk negligible at the entry counts we expect
// per user (single digits, double digits worst-case).
function newEntryId(): string {
  const head = Math.random().toString(36).slice(2, 10);
  const tail = Date.now().toString(36);
  return `mh-${head}-${tail}`;
}

// Stable per-row identity. WardrobeGapsScreen uses the same `category-i`
// shape internally, but the gap object itself doesn't carry an id field
// — derive one from category + item_name so the same gap recurring on
// later analyses keys identically.
//
// Content-only key (no index suffix). Normalised (trim + lowercase) so
// casing/whitespace drift between analyses doesn't fragment a saved
// entry off its row pre-fill. True duplicates within the SAME analysis
// (same content key, different row) get a deterministic counter suffix
// from the caller so React keys stay unique.
function gapContentKey(g: GapInput): string {
  const cat = g.category.trim().toLowerCase();
  const name = g.item_name.trim().toLowerCase();
  return `${cat}::${name}`;
}

export interface GapInput {
  category: string;
  item_name: string;
  reason?: string;
  priority?: 'high' | 'medium' | 'low';
  estimated_price?: string;
}

interface RowDraft {
  gapId: string;
  category: string;
  item_name: string;
  reason: string;
  selected: boolean;
  priority: ShoppingListPriority;
  notes: string;
  notesOpen: boolean;
  /** Existing entry id when the row is pre-filled from a saved list. */
  existingEntryId?: string;
  /** Existing added_at timestamp; preserved across re-saves so order is stable. */
  existingAddedAt?: string;
}

function priorityFromGap(p: GapInput['priority']): ShoppingListPriority {
  if (p === 'high') return 1;
  if (p === 'medium') return 2;
  return 3;
}

// Pick the singular / plural variant for a {count} template. The
// translation shim falls back to the bare key, so when an i18n key is
// missing the count is rendered as a sensible English fallback rather
// than a literal `{count} items` string.
function pluralized(
  baseKey: string,
  count: number,
  fallbackOne: string,
  fallbackOther: string,
): string {
  const variantKey = count === 1 ? `${baseKey}.one` : `${baseKey}.other`;
  const raw = tr(variantKey, { count });
  if (raw === variantKey) {
    // Missing key — substitute hardcoded English so the UI never shows
    // a raw dot-namespaced key to the user.
    return (count === 1 ? fallbackOne : fallbackOther).replace(
      '{count}',
      String(count),
    );
  }
  return raw;
}

function priorityLabel(p: ShoppingListPriority): string {
  if (p === 1) return tr('pickMustHaves.priority.high');
  if (p === 2) return tr('pickMustHaves.priority.medium');
  return tr('pickMustHaves.priority.low');
}

export function PickMustHavesScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  // Memoise so the `?? []` fallback doesn't allocate a fresh array every
  // render and re-trigger the rows-derivation useMemo below.
  const routeGaps = route.params?.gaps;
  const incomingGaps = useMemo<GapInput[]>(
    () => routeGaps ?? [],
    [routeGaps],
  );

  const {
    entries: savedEntries,
    isLoading: isLoadingSaved,
    error: savedError,
  } = useShoppingList();
  const saveMutation = useSaveShoppingList();

  // Build draft rows once per (gaps, savedEntries) change. Pre-fills
  // from the persisted list by gap_id so the user sees their previous
  // shortlist marked + prioritised when they re-enter the screen.
  //
  // Duplicate-aware key derivation: same (category, item_name) appearing
  // twice in one analysis gets a deterministic `::1`, `::2`… counter
  // appended so React keys stay unique. Single-occurrence rows keep the
  // bare content key, which is what re-runs of analysis will match
  // against — preserving prior `existingEntryId` pre-fill across
  // re-orderings.
  const initialRows = useMemo<RowDraft[]>(() => {
    const savedByGapId = new Map(savedEntries.map((e) => [e.gap_id, e]));
    const seen = new Map<string, number>();
    return incomingGaps.map((g) => {
      const base = gapContentKey(g);
      const dupCount = seen.get(base) ?? 0;
      seen.set(base, dupCount + 1);
      const id = dupCount === 0 ? base : `${base}::${dupCount}`;
      const existing = savedByGapId.get(id);
      return {
        gapId: id,
        category: g.category,
        item_name: g.item_name,
        reason: g.reason ?? '',
        selected: !!existing,
        priority: existing?.priority ?? priorityFromGap(g.priority),
        notes: existing?.notes ?? '',
        notesOpen: !!(existing?.notes && existing.notes.length > 0),
        existingEntryId: existing?.id,
        existingAddedAt: existing?.added_at,
      };
    });
  }, [incomingGaps, savedEntries]);

  const [rows, setRows] = useState<RowDraft[]>(initialRows);
  // Hydration-aware re-seed. On the FIRST non-loading render we replace
  // the row state wholesale (this is the user's first view of the
  // pre-filled list once `useShoppingList` has resolved). On subsequent
  // saves / refetches we MERGE fresh `existingEntryId`/`existingAddedAt`
  // into the current row state instead of clobbering user edits
  // (selected / priority / notes / notesOpen).
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (isLoadingSaved) return;
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      setRows(initialRows);
      return;
    }
    // Post-hydration: merge by gapId. Preserve user's in-progress
    // edits; only adopt the fresh saved-entry pointers.
    setRows((prev) => {
      const byId = new Map(prev.map((r) => [r.gapId, r]));
      return initialRows.map((fresh) => {
        const existing = byId.get(fresh.gapId);
        if (!existing) {
          // New row appeared (e.g. re-run analysis added a gap).
          return fresh;
        }
        return {
          ...existing,
          // Adopt latest server-side identity for this gap.
          existingEntryId: fresh.existingEntryId,
          existingAddedAt: fresh.existingAddedAt,
        };
      });
    });
  }, [initialRows, isLoadingSaved]);

  // Surface read-query failures inline + once-per-error to Sentry so
  // an empty list doesn't silently mask a fetch error.
  useEffect(() => {
    if (savedError) {
      Sentry.captureException(savedError, {
        tags: { component: 'PickMustHavesScreen' },
      });
    }
  }, [savedError?.message]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRow = (gapId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.gapId === gapId ? { ...r, selected: !r.selected } : r,
      ),
    );
  };

  const setRowPriority = (gapId: string, priority: ShoppingListPriority) => {
    setRows((prev) =>
      prev.map((r) => (r.gapId === gapId ? { ...r, priority } : r)),
    );
  };

  const toggleNotesOpen = (gapId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.gapId === gapId ? { ...r, notesOpen: !r.notesOpen } : r,
      ),
    );
  };

  const setRowNotes = (gapId: string, notes: string) => {
    setRows((prev) =>
      prev.map((r) => (r.gapId === gapId ? { ...r, notes } : r)),
    );
  };

  const selectedCount = rows.filter((r) => r.selected).length;

  const handleSave = () => {
    const nowIso = new Date().toISOString();
    const entries: ShoppingListEntry[] = rows
      .filter((r) => r.selected)
      .map((r) => {
        const trimmedNotes = r.notes.trim();
        const entry: ShoppingListEntry = {
          id: r.existingEntryId ?? newEntryId(),
          gap_id: r.gapId,
          category: r.category,
          priority: r.priority,
          added_at: r.existingAddedAt ?? nowIso,
        };
        if (trimmedNotes.length > 0) {
          entry.notes = trimmedNotes;
        }
        return entry;
      });

    saveMutation.mutate(entries, {
      onSuccess: () => {
        Alert.alert(tr('pickMustHaves.saved'));
      },
      onError: (err) => {
        Alert.alert(
          tr('pickMustHaves.title'),
          err instanceof Error ? err.message : 'Failed to save',
        );
      },
    });
  };

  // Remove a single saved entry by id. Used by the empty-state read-only
  // list so the user can prune their saved must-haves without re-running
  // analysis. Re-uses the same save mutation to keep the JSONB shape +
  // optimistic-update path consistent with the main flow.
  const handleRemoveSavedEntry = (entryId: string) => {
    const next = savedEntries.filter((e) => e.id !== entryId);
    saveMutation.mutate(next, {
      onError: (err) => {
        Alert.alert(
          tr('pickMustHaves.title'),
          err instanceof Error ? err.message : 'Failed to save',
        );
      },
    });
  };

  // ── Empty state — no gaps were threaded in (e.g. opened from Profile
  //    "Shopping list" row when the user hasn't run analysis yet). The
  //    screen renders any saved entries as read-only-ish rows with a
  //    per-row remove affordance, plus the "Run analysis again" CTA as
  //    the primary action.
  if (incomingGaps.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={s.headerRow}>
          <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
            <BackIcon color={t.fg} />
          </IconBtn>
          <View style={{ flex: 1 }}>
            <Eyebrow style={{ marginBottom: 4 }}>{tr('pickMustHaves.eyebrow')}</Eyebrow>
            <PageTitle>{tr('pickMustHaves.title')}</PageTitle>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 18 }}
          showsVerticalScrollIndicator={false}>
          <Card hero padding={20}>
            <Eyebrow style={{ marginBottom: 6 }}>{tr('pickMustHaves.eyebrow')}</Eyebrow>
            <PageTitle size={24} style={{ marginBottom: 8 }}>
              {tr('pickMustHaves.empty.title')}
            </PageTitle>
            <Caption style={{ marginBottom: 14, lineHeight: 18 }}>
              {tr('pickMustHaves.empty.body')}
            </Caption>
            <Button
              label={tr('pickMustHaves.empty.cta')}
              onPress={() => {
                nav.goBack();
                nav.navigate('WardrobeGaps');
              }}
            />
          </Card>

          {savedError ? (
            <Caption style={{ color: t.destructive }}>
              {tr('pickMustHaves.loadError')}
            </Caption>
          ) : null}

          {!isLoadingSaved && savedEntries.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Caption>
                {pluralized(
                  'pickMustHaves.savedCountTemplate',
                  savedEntries.length,
                  '1 item saved',
                  '{count} items saved',
                )}
              </Caption>
              {savedEntries.map((entry) => (
                <SavedEntryRow
                  key={entry.id}
                  entry={entry}
                  disabled={saveMutation.isPending}
                  onRemove={() => handleRemoveSavedEntry(entry.id)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.headerRow}>
        <IconBtn ariaLabel="Back" onPress={() => nav.goBack()} variant="ghost">
          <BackIcon color={t.fg} />
        </IconBtn>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 4 }}>{tr('pickMustHaves.eyebrow')}</Eyebrow>
          <PageTitle>{tr('pickMustHaves.title')}</PageTitle>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 120, gap: 16 }}
        showsVerticalScrollIndicator={false}>
        <Caption style={{ lineHeight: 18 }}>{tr('pickMustHaves.intro')}</Caption>

        {savedError ? (
          <Caption style={{ color: t.destructive }}>
            {tr('pickMustHaves.loadError')}
          </Caption>
        ) : null}

        {isLoadingSaved ? (
          <Card padding={16}>
            <Caption>…</Caption>
          </Card>
        ) : null}

        {rows.map((row) => (
          <GapRow
            key={row.gapId}
            row={row}
            onToggle={() => toggleRow(row.gapId)}
            onPriorityChange={(p) => setRowPriority(row.gapId, p)}
            onToggleNotes={() => toggleNotesOpen(row.gapId)}
            onNotesChange={(v) => setRowNotes(row.gapId, v)}
            onFindSimilar={() =>
              nav.navigate('StyleChat', {
                mode: 'shopping',
                gapContext: { category: row.category, item_name: row.item_name },
              })
            }
          />
        ))}
      </ScrollView>

      {/* Sticky save bar — always rendered when at least one row exists,
          so the user can also save an empty list (effectively clears any
          prior shortlist). */}
      <View
        style={[
          s.stickyBar,
          { backgroundColor: t.bg, borderTopColor: t.border },
        ]}>
        <Button
          block
          label={
            saveMutation.isPending
              ? tr('pickMustHaves.saving')
              : tr('pickMustHaves.save')
          }
          disabled={saveMutation.isPending}
          accessibilityState={{ busy: saveMutation.isPending }}
          onPress={handleSave}
        />
        <Caption style={{ marginTop: 6, textAlign: 'center' }}>
          {pluralized(
            'pickMustHaves.selectedCountTemplate',
            selectedCount,
            '1 selected',
            '{count} selected',
          )}
        </Caption>
      </View>
    </SafeAreaView>
  );
}

function GapRow({
  row,
  onToggle,
  onPriorityChange,
  onToggleNotes,
  onNotesChange,
  onFindSimilar,
}: {
  row: RowDraft;
  onToggle: () => void;
  onPriorityChange: (p: ShoppingListPriority) => void;
  onToggleNotes: () => void;
  onNotesChange: (value: string) => void;
  onFindSimilar: () => void;
}) {
  const t = useTokens();

  return (
    <Card padding={16}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.selected }}
        onPress={onToggle}
        style={s.rowHeader}>
        <View
          style={[
            s.checkbox,
            {
              borderColor: row.selected ? t.accent : t.border2,
              backgroundColor: row.selected ? t.accent : 'transparent',
            },
          ]}>
          {row.selected ? <CheckIcon size={14} color={t.accentFg} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 14,
              fontWeight: '600',
              color: t.fg,
              letterSpacing: -0.13,
            }}>
            {row.item_name}
          </Text>
          {row.reason ? (
            <Caption style={{ marginTop: 2 }} numberOfLines={2}>
              {row.reason}
            </Caption>
          ) : null}
        </View>
      </Pressable>

      {row.selected ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip
              label={tr('pickMustHaves.priority.high')}
              active={row.priority === 1}
              onPress={() => onPriorityChange(1)}
            />
            <Chip
              label={tr('pickMustHaves.priority.medium')}
              active={row.priority === 2}
              onPress={() => onPriorityChange(2)}
            />
            <Chip
              label={tr('pickMustHaves.priority.low')}
              active={row.priority === 3}
              onPress={() => onPriorityChange(3)}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onToggleNotes}
            style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 12,
                color: t.accent,
                letterSpacing: -0.05,
              }}>
              {row.notesOpen ? '−' : '+'}{' '}
              {tr('pickMustHaves.notesPlaceholder')}
            </Text>
          </Pressable>

          {row.notesOpen ? (
            <TextInput
              value={row.notes}
              onChangeText={onNotesChange}
              placeholder={tr('pickMustHaves.notesPlaceholder')}
              placeholderTextColor={t.fg3}
              multiline
              maxLength={500}
              style={{
                minHeight: 64,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: t.border,
                padding: 10,
                fontFamily: fonts.ui,
                fontSize: 13,
                color: t.fg,
                textAlignVertical: 'top',
              }}
            />
          ) : null}
        </View>
      ) : null}

      {/* G4 — "Find similar" CTA per row routes to Shopping Chat with the
          gap as anchored context, replacing the prior expectation that
          users would google for the missing item externally. Visible on
          every row regardless of selection so the user can browse first
          before committing to the shortlist. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('pickMustHaves.findSimilar')}
        onPress={onFindSimilar}
        style={{
          alignSelf: 'flex-start',
          paddingVertical: 6,
          paddingHorizontal: 0,
          marginTop: row.selected ? 4 : 12,
        }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 12,
            color: t.accent,
            letterSpacing: -0.05,
          }}>
          {tr('pickMustHaves.findSimilar')}
        </Text>
      </Pressable>
    </Card>
  );
}

// Read-only-ish saved-entry row for the empty-state branch (Profile
// shortcut). Shows category + priority pill + optional notes; the only
// affordance is a Remove button that prunes this entry from the saved
// list via `useSaveShoppingList`.
function SavedEntryRow({
  entry,
  disabled,
  onRemove,
}: {
  entry: ShoppingListEntry;
  disabled: boolean;
  onRemove: () => void;
}) {
  const t = useTokens();
  return (
    <Card padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 14,
              fontWeight: '600',
              color: t.fg,
              letterSpacing: -0.13,
            }}>
            {entry.category}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radii.sm,
                borderWidth: 1,
                borderColor: t.border2,
              }}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 11,
                  color: t.fg2,
                  letterSpacing: 0.04,
                }}>
                {priorityLabel(entry.priority)}
              </Text>
            </View>
          </View>
          {entry.notes ? (
            <Caption style={{ marginTop: 6 }} numberOfLines={3}>
              {entry.notes}
            </Caption>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('pickMustHaves.removeAriaLabel')}
          onPress={onRemove}
          disabled={disabled}
          style={{ paddingVertical: 4, paddingHorizontal: 8, opacity: disabled ? 0.5 : 1 }}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 12,
              color: t.destructive,
              letterSpacing: -0.05,
            }}>
            {tr('pickMustHaves.remove')}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 14,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
});
