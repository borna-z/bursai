// Edit garment — opened from GarmentDetail's edit button.
// Header: cancel left · italic eyebrow + title centered · save right (accent).
// Body: photo with "Change photo" pill overlay, then the shared AddPieceStep3Form
// for metadata pickers (wrapped in a "Details" FormCard) plus edit-only Cards
// for usage (wear count, price) and status (in_laundry). Bottom: red Delete row.
//
// W2 wires real Supabase data: useGarment pre-fills the form, useUpdateGarment saves,
// useDeleteGarment removes. The "Change photo" pill is a placeholder pending Wave 9
// image-pick + upload.
//
// KeyboardAvoidingView wraps the whole scroll body so text inputs (Price)
// don't get clipped on iOS. ScrollView, not FlatList — fields are heterogenous and short.
//
// Phase 6 follow-up: reuses `AddPieceStep3Form` for the 11-picker metadata block. The
// shared form's canonical contract is lowercase ids (matches `analyze_garment` + the
// downstream duplicate / outfit-rules / coverage consumers). The boundary helpers
// below normalise DB rows (which may be Title-cased on legacy edits) into the form's
// lowercase shape on hydration, then map back to the legacy Title-case on save to
// preserve the persisted DB shape exactly.

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { TogglePill } from '../components/TogglePill';
import { GarmentImageTile } from '../components/GarmentImageTile';
import { ErrorState } from '../components/ErrorState';
import { MinusIcon, PlusIcon } from '../components/icons';
import { useDeleteGarment, useGarment, useUpdateGarment } from '../hooks/useGarments';
import { t as tr } from '../lib/i18n';
import { showToast } from '../lib/toast';
import {
  CATEGORIES,
  MATERIALS,
  FITS,
  PATTERNS,
  matchCanonical,
} from '../lib/garmentTaxonomy';
import { AddPieceStep3Form } from './AddPieceStep3/AddPieceStep3Form';
import type {
  GarmentFormState,
  CategoryValue,
  MaterialValue,
  FitValue,
  PatternValue,
  FormalityValue,
} from './AddPieceStep3/garmentMetadataForm.types';
import type { Garment, GarmentUpdate } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EditGarment'>;

// Persisted Title-case shape this screen historically wrote to the DB. The
// canonical store-side contract is lowercase (see `garmentTaxonomy.ts`), but
// existing rows last touched by the legacy EditGarmentScreen carry these
// Title-case values; AddPieceStep3 already writes lowercase. We preserve the
// legacy output here so the persisted DB shape doesn't change for edit users.
//
// Outerwear note: the legacy code emitted `'Outer'` here, but the outfit-slot
// classifier in `lib/outfitRules.ts` only recognises `outerwear` / `coat` /
// `jacket` / etc. tokens (lowercased). `'outer'` slips through to the `'top'`
// fallback, which silently breaks outfit validation and suggestion grouping
// after every edit-save. Write the full canonical `'Outerwear'` token so the
// classifier picks it up; `matchCanonical` still round-trips it on hydration.
const CATEGORY_TO_DB: Record<CategoryValue, string | null> = {
  '': null,
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  outerwear: 'Outerwear',
  dress: 'Dress',
  accessory: 'Accessory',
};
const MATERIAL_TO_DB: Record<MaterialValue, string | null> = {
  '': null,
  cotton: 'Cotton',
  linen: 'Linen',
  wool: 'Wool',
  cashmere: 'Cashmere',
  silk: 'Silk',
  leather: 'Leather',
  denim: 'Denim',
  synthetic: 'Synthetic',
};
const FIT_TO_DB: Record<FitValue, string | null> = {
  '': null,
  slim: 'Slim',
  regular: 'Regular',
  loose: 'Loose',
  oversized: 'Oversized',
};
const PATTERN_TO_DB: Record<PatternValue, string | null> = {
  '': null,
  solid: 'Solid',
  striped: 'Striped',
  checked: 'Checked',
  floral: 'Floral',
  other: 'Other',
};
const SEASON_TO_DB: Record<string, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

// DB → form normalisers. `matchCanonical` returns the canonical lowercase id
// when the row's value matches case-insensitively; the legacy `'Outer'` value
// has no lowercase equivalent in CATEGORIES (which uses `'outerwear'`), so a
// targeted alias closes that gap.
function dbToCategory(value: string | null | undefined): CategoryValue {
  if (!value) return '';
  if (value.toLowerCase() === 'outer') return 'outerwear';
  const m = matchCanonical(value, CATEGORIES);
  return typeof m === 'string' && (CATEGORIES as readonly string[]).includes(m)
    ? (m as CategoryValue)
    : '';
}
function dbToMaterial(value: string | null | undefined): MaterialValue {
  if (!value) return '';
  const m = matchCanonical(value, MATERIALS);
  return typeof m === 'string' && (MATERIALS as readonly string[]).includes(m)
    ? (m as MaterialValue)
    : '';
}
function dbToFit(value: string | null | undefined): FitValue {
  if (!value) return '';
  const m = matchCanonical(value, FITS);
  return typeof m === 'string' && (FITS as readonly string[]).includes(m)
    ? (m as FitValue)
    : '';
}
function dbToPattern(value: string | null | undefined): PatternValue {
  if (!value) return '';
  const m = matchCanonical(value, PATTERNS);
  return typeof m === 'string' && (PATTERNS as readonly string[]).includes(m)
    ? (m as PatternValue)
    : '';
}
function dbToFormality(value: number | null | undefined): FormalityValue {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? (value as FormalityValue)
    : null;
}

function buildFormStateFromGarment(garment: Garment): GarmentFormState {
  return {
    title: garment.title ?? '',
    category: dbToCategory(garment.category),
    subcategory: garment.subcategory ?? '',
    primaryColor: garment.color_primary ?? '',
    secondaryColor: garment.color_secondary ?? '',
    material: dbToMaterial(garment.material),
    fit: dbToFit(garment.fit),
    pattern: dbToPattern(garment.pattern),
    seasons: (garment.season_tags ?? []).map((s) => s.toLowerCase()),
    formality: dbToFormality(garment.formality),
  };
}

export function EditGarmentScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;

  const { data: garment, isLoading, isError, refetch } = useGarment(editingId);
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();

  // Hydration model: the shared form lazily initialises its reducer from
  // `initial` once. We delay rendering the form until the garment row arrives
  // and build the initial snapshot eagerly so re-mounting on a different
  // garment.id rebuilds from scratch. Edit-only fields (wear count / price /
  // in_laundry) hydrate alongside via the same effect to keep dirty-checking
  // a single source of truth.
  const [hydrated, setHydrated] = React.useState(false);
  const [initialForm, setInitialForm] = React.useState<GarmentFormState | null>(null);
  const [formState, setFormState] = React.useState<GarmentFormState | null>(null);
  const [wearCount, setWearCount] = React.useState(0);
  const [price, setPrice] = React.useState('');
  const [inLaundry, setInLaundry] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const lastHydratedIdRef = React.useRef<string | null>(null);
  // Snapshot the values pre-fill landed with — compared against the live form
  // + edit-only fields below to detect unsaved edits in the cancel-with-edits
  // guard. Stringified because nested arrays / objects change identity on
  // every state transition but we only care about content. (F-015 in N9.)
  const initialSnapshotRef = React.useRef<string>('');
  // Raw DB values that hydrated to `''` because they fell outside the shared
  // picker taxonomy (e.g. material 'polyester'). The form has no way to
  // surface or preserve them as picker chips, so we cache the raw value here
  // and write it back on save when the user hasn't touched that field.
  // Otherwise a user editing only the title would silently erase the
  // out-of-taxonomy metadata on every save. The ref is invalidated for a
  // field as soon as its form value moves away from the hydrated `''`, so
  // a deliberate clear (tap-the-active-chip-to-deselect) still writes null.
  // (Codex P2 on PR #860.)
  const unknownRawRef = React.useRef<{
    material: string | null;
    fit: string | null;
    pattern: string | null;
  }>({ material: null, fit: null, pattern: null });
  React.useEffect(() => {
    if (!garment) return;
    if (lastHydratedIdRef.current === garment.id) return;
    lastHydratedIdRef.current = garment.id;
    const next = buildFormStateFromGarment(garment);
    // Track raw values that the shared picker can't represent so save doesn't
    // erase them. A value is "unknown" when the row carries a non-null string
    // but our normaliser collapsed it to `''` (not in the canonical chip list).
    unknownRawRef.current = {
      material: garment.material && next.material === '' ? garment.material : null,
      fit: garment.fit && next.fit === '' ? garment.fit : null,
      pattern: garment.pattern && next.pattern === '' ? garment.pattern : null,
    };
    const initialPrice = garment.purchase_price != null ? String(garment.purchase_price) : '';
    const initialWear = garment.wear_count ?? 0;
    const initialInLaundry = Boolean(garment.in_laundry);
    setInitialForm(next);
    setFormState(next);
    setWearCount(initialWear);
    setPrice(initialPrice);
    setInLaundry(initialInLaundry);
    initialSnapshotRef.current = JSON.stringify({
      form: { ...next, seasons: [...next.seasons].sort() },
      wearCount: initialWear,
      price: initialPrice,
      inLaundry: initialInLaundry,
    });
    setHydrated(true);
  }, [garment]);

  // Invalidate each cached raw value the first time the user picks any chip
  // for that field. From that point on the form value is authoritative — even
  // if the user later deselects (back to `''`) we'll write null. Without this,
  // tap-the-active-chip-to-deselect would silently re-write the legacy value.
  React.useEffect(() => {
    if (!formState) return;
    if (unknownRawRef.current.material && formState.material !== '') {
      unknownRawRef.current.material = null;
    }
    if (unknownRawRef.current.fit && formState.fit !== '') {
      unknownRawRef.current.fit = null;
    }
    if (unknownRawRef.current.pattern && formState.pattern !== '') {
      unknownRawRef.current.pattern = null;
    }
  }, [formState]);

  const isDirty = React.useMemo(() => {
    if (!hydrated || !formState) return false;
    const current = JSON.stringify({
      form: { ...formState, seasons: [...formState.seasons].sort() },
      wearCount,
      price,
      inLaundry,
    });
    return current !== initialSnapshotRef.current;
  }, [hydrated, formState, wearCount, price, inLaundry]);

  // Cancel handler — confirms with the user when there are unsaved edits.
  // Without this, a stray tap on Cancel after typing into the form silently
  // discards work. Save is gated by `isValid`, so the user can't always
  // exit by saving — Cancel must own the discard prompt. (F-015.)
  const handleCancel = React.useCallback(() => {
    if (!isDirty) {
      nav.goBack();
      return;
    }
    // N3b — folded the N9-deferred copy into i18n keys (editGarment.cancel.*).
    // KEEP as Alert.alert — destructive choice with two outcomes ("Keep
    // editing" vs "Discard") needs an explicit acknowledge.
    Alert.alert(
      tr('editGarment.cancel.confirm.title'),
      tr('editGarment.cancel.confirm.body'),
      [
        { text: tr('editGarment.cancel.confirm.keep'), style: 'cancel' },
        {
          text: tr('editGarment.cancel.confirm.discard'),
          style: 'destructive',
          onPress: () => nav.goBack(),
        },
      ],
    );
  }, [isDirty, nav]);

  const isValid =
    !!formState && formState.title.trim().length > 0 && formState.category.length > 0;

  const handleSave = async () => {
    if (!garment || !formState || !isValid) return;
    setSubmitting(true);
    try {
      const trimmedPrice = price.trim();
      const parsedPrice = trimmedPrice.length > 0 ? Number(trimmedPrice) : null;
      // Reject NaN — typing "abc" into the price field shouldn't write null
      // to the column without telling the user. Also reject negatives — the
      // column is non-negative semantically and the form has no minus key,
      // but a paste from elsewhere can still land. (European decimal commas
      // like "12,50" parse to NaN here; users get the same alert as "abc"
      // and can re-type with a period — TODO: locale-aware parser.)
      if (parsedPrice != null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
        showToast(
          'error',
          tr('editGarment.invalidPrice.title'),
          tr('editGarment.invalidPrice.body'),
        );
        return;
      }

      const trimmedSub = formState.subcategory.trim();
      // `isValid` above guarantees `formState.category` is non-empty, so the
      // CATEGORY_TO_DB lookup always returns a string here; the `??` keeps
      // GarmentUpdate's non-null `category` type happy without changing the
      // runtime contract.
      const mappedCategory = CATEGORY_TO_DB[formState.category];
      const updates: GarmentUpdate = {
        title: formState.title.trim(),
        category: mappedCategory ?? garment.category,
        subcategory: trimmedSub.length > 0 ? trimmedSub : null,
        color_primary: formState.primaryColor || null,
        color_secondary: formState.secondaryColor || null,
        // When the user hasn't picked a chip but the row hydrated from an
        // out-of-taxonomy value, write the original raw value back so saves
        // that touched other fields don't silently erase legacy/custom
        // metadata. Picking any chip overrides the cache as expected.
        material:
          formState.material === ''
            ? unknownRawRef.current.material
            : (MATERIAL_TO_DB[formState.material] ?? null),
        fit:
          formState.fit === ''
            ? unknownRawRef.current.fit
            : (FIT_TO_DB[formState.fit] ?? null),
        pattern:
          formState.pattern === ''
            ? unknownRawRef.current.pattern
            : (PATTERN_TO_DB[formState.pattern] ?? null),
        season_tags: formState.seasons.map((s) => SEASON_TO_DB[s.toLowerCase()] ?? s),
        formality: formState.formality,
        wear_count: wearCount,
        purchase_price: parsedPrice,
        in_laundry: inLaundry,
      };

      await updateGarment.mutateAsync({ id: garment.id, updates });
      nav.goBack();
    } catch (err) {
      showToast(
        'error',
        tr('editGarment.saveFailed.title'),
        err instanceof Error ? err.message : tr('editGarment.saveFailed.fallback'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!garment) return;
    Alert.alert(
      'Delete piece',
      'Permanently remove this garment? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGarment.mutateAsync(garment.id);
              // After a delete, both the EditGarment and the upstream
              // GarmentDetail point at a now-missing row. Pop back to the
              // first screen on the stack so we never leave the user on a
              // 404 detail page. `popToTop` is a no-op when EditGarment is
              // already the only stack entry (which the React Navigation
              // docs guarantee), so this also covers deep-link entry. The
              // earlier double-`goBack` could overshoot when the back stack
              // had unexpected depth (e.g. opened from Search). Audit UX#5.
              const stackNav = nav.getParent?.() ?? nav;
              if (
                'popToTop' in stackNav &&
                typeof (stackNav as { popToTop?: () => void }).popToTop === 'function'
              ) {
                (stackNav as { popToTop: () => void }).popToTop();
              } else if (nav.canGoBack()) {
                nav.goBack();
              }
            } catch (err) {
              showToast(
                'error',
                tr('editGarment.deleteFailed.title'),
                err instanceof Error ? err.message : tr('common.alerts.tryAgain'),
              );
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Loading…</Eyebrow>
          </View>
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
        <ErrorState
          title="Garment not found"
          body="We couldn't load this piece. Pull down to try again."
          onRetry={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const saveDisabled = !isValid || submitting || !hydrated;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={tr('editGarment.action.cancel')}
            hitSlop={8}>
            <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.fg2 }}>
              {tr('editGarment.action.cancel')}
            </Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>{tr('editGarment.eyebrow')}</Eyebrow>
            <Text
              style={{
                fontFamily: fonts.displayMedium,
                fontStyle: 'italic',
                fontSize: 18,
                lineHeight: 22,
                fontWeight: '500',
                color: t.fg,
                letterSpacing: -0.18,
              }}>
              {tr('editGarment.title')}
            </Text>
          </View>
          <Pressable
            onPress={handleSave}
            disabled={saveDisabled}
            accessibilityLabel={tr('editGarment.action.save')}
            accessibilityRole="button"
            accessibilityState={{ disabled: saveDisabled, busy: submitting }}
            hitSlop={8}
            style={{ opacity: saveDisabled ? 0.5 : 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {submitting ? <ActivityIndicator size="small" color={t.accent} /> : null}
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 13, color: t.accent, fontWeight: '600' }}>
              {tr('editGarment.action.save')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Photo + Change photo overlay */}
          <View style={[s.photoWrap, { borderColor: t.border }]}>
            <GarmentImageTile garment={garment} iconSize={48} />
            <Pressable
              accessibilityLabel={tr('editGarment.changePhoto')}
              accessibilityRole="button"
              onPress={() =>
                showToast(
                  'info',
                  tr('editGarment.changePhoto.alert.title'),
                  tr('editGarment.changePhoto.alert.body'),
                )
              }
              style={({ pressed }) => [
                s.photoChange,
                {
                  backgroundColor: t.card,
                  borderColor: t.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <Text style={{ fontFamily: fonts.uiSemi, fontSize: 12, color: t.fg, letterSpacing: -0.1 }}>
                {tr('editGarment.changePhoto')}
              </Text>
            </Pressable>
          </View>

          {/* Details — shared metadata picker form */}
          <FormCard title={tr('editGarment.section.details')}>
            {initialForm ? (
              // Key by garment.id so a route param change (e.g. user opens
              // another piece while this screen is already mounted) remounts
              // the form and re-seeds its internal reducer from the new
              // `initialForm`. Without this, the inputs would stay on the
              // previous garment and the next save would write stale metadata
              // to the new row. The shared form only consumes `initial` in
              // its lazy useReducer initialiser, so a prop change alone
              // wouldn't re-seed it.
              <AddPieceStep3Form
                key={garment.id}
                initial={initialForm}
                onChange={setFormState}
              />
            ) : null}
          </FormCard>

          {/* Usage — wear count + price (edit-only) */}
          <FormCard title={tr('editGarment.section.usage')}>
            <FieldLabel label={tr('editGarment.field.wearCount')} />
            <View style={s.stepperRow}>
              <Pressable
                accessibilityLabel={tr('editGarment.a11y.decrementWear')}
                accessibilityRole="button"
                onPress={() => setWearCount((n) => Math.max(0, n - 1))}
                style={({ pressed }) => [
                  s.stepperBtn,
                  { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <MinusIcon color={t.fg} />
              </Pressable>
              <View style={[s.stepperValue, { backgroundColor: t.bg2, borderColor: t.border }]}>
                <Text
                  style={{
                    fontFamily: fonts.displayMedium,
                    fontStyle: 'italic',
                    fontSize: 22,
                    fontWeight: '500',
                    color: t.fg,
                    letterSpacing: -0.22,
                  }}>
                  {wearCount}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={tr('editGarment.a11y.incrementWear')}
                accessibilityRole="button"
                onPress={() => setWearCount((n) => n + 1)}
                style={({ pressed }) => [
                  s.stepperBtn,
                  { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <PlusIcon color={t.fg} />
              </Pressable>
            </View>

            <FieldLabel label={tr('editGarment.field.price')} topGap />
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor={t.fg3}
              keyboardType="numeric"
              inputMode="numeric"
              style={[s.input, { backgroundColor: t.bg2, borderColor: t.border, color: t.fg }]}
            />
          </FormCard>

          {/* Status — in-laundry toggle (edit-only) */}
          <FormCard title={tr('editGarment.section.status')}>
            <View style={s.statusRow}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 13.5,
                  color: t.fg,
                  flex: 1,
                  letterSpacing: -0.13,
                }}>
                {tr('editGarment.field.inLaundry')}
              </Text>
              <TogglePill
                label={inLaundry ? tr('editGarment.toggle.on') : tr('editGarment.toggle.off')}
                active={inLaundry}
                onToggle={setInLaundry}
              />
            </View>
          </FormCard>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('editGarment.delete')}
            onPress={handleDelete}
            disabled={deleteGarment.isPending}
            style={{ alignSelf: 'center', paddingVertical: 14, opacity: deleteGarment.isPending ? 0.5 : 1 }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 13,
                color: t.destructive,
                letterSpacing: -0.1,
              }}>
              {deleteGarment.isPending ? tr('editGarment.deleting') : tr('editGarment.delete')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTokens();
  return (
    <View
      style={[
        s.formCard,
        {
          backgroundColor: t.card,
          borderColor: t.border,
        },
      ]}>
      <Text
        style={{
          fontFamily: fonts.displayMedium,
          fontStyle: 'italic',
          fontSize: 16,
          fontWeight: '500',
          color: t.fg,
          letterSpacing: -0.16,
          marginBottom: 14,
        }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function FieldLabel({ label, topGap = false }: { label: string; topGap?: boolean }) {
  return <Eyebrow style={{ marginTop: topGap ? 14 : 0, marginBottom: 8 }}>{label}</Eyebrow>;
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  photoChange: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  formCard: {
    padding: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    fontFamily: fonts.uiMed,
    fontSize: 13,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
});
