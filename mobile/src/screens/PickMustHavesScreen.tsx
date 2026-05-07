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
function gapKey(g: GapInput, fallbackIndex: number): string {
  return `${g.category}::${g.item_name}::${fallbackIndex}`;
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

  const { entries: savedEntries, isLoading: isLoadingSaved } = useShoppingList();
  const saveMutation = useSaveShoppingList();

  // Build draft rows once per (gaps, savedEntries) change. Pre-fills
  // from the persisted list by gap_id so the user sees their previous
  // shortlist marked + prioritised when they re-enter the screen.
  const initialRows = useMemo<RowDraft[]>(() => {
    const savedByGapId = new Map(savedEntries.map((e) => [e.gap_id, e]));
    return incomingGaps.map((g, i) => {
      const id = gapKey(g, i);
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
  // Re-seed when the inputs change (savedEntries hydrates async on first
  // mount; the `gaps` param can also change if the user re-enters from
  // a different gap analysis run).
  const initialKeyRef = useRef('');
  useEffect(() => {
    const key = JSON.stringify(initialRows.map((r) => [r.gapId, r.existingEntryId]));
    if (key !== initialKeyRef.current) {
      initialKeyRef.current = key;
      setRows(initialRows);
    }
  }, [initialRows]);

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

  // ── Empty state — no gaps were threaded in (e.g. opened from Profile
  //    "Shopping list" row when the user hasn't run analysis yet). The
  //    screen still renders the saved list count so they can see what's
  //    there, but the primary affordance is "go run gap analysis".
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

          {!isLoadingSaved && savedEntries.length > 0 ? (
            <Card padding={16}>
              <Caption>
                {tr('pickMustHaves.savedCountTemplate').replace(
                  '{count}',
                  String(savedEntries.length),
                )}
              </Caption>
            </Card>
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
          {tr('pickMustHaves.savedCountTemplate').replace(
            '{count}',
            String(selectedCount),
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
}: {
  row: RowDraft;
  onToggle: () => void;
  onPriorityChange: (p: ShoppingListPriority) => void;
  onToggleNotes: () => void;
  onNotesChange: (value: string) => void;
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
