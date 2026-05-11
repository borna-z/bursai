// Edit garment — opened from GarmentDetail's edit button.
// Header: cancel left · italic eyebrow + title centered · save right (accent).
// Body: photo with "Change photo" pill overlay, then four Cards — Details / Style / Usage / Status —
// each holding a stack of fields, chip groups, color swatch row, stepper, etc. Bottom: red Delete row.
//
// W2 wires real Supabase data: useGarment pre-fills the form, useUpdateGarment saves, useDeleteGarment
// removes. The "Change photo" pill is a placeholder pending Wave 9 image-pick + upload.
//
// KeyboardAvoidingView wraps the whole scroll body so text inputs (Title, Subcategory, Price)
// don't get clipped on iOS. ScrollView, not FlatList — fields are heterogenous and short.

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
import { Chip } from '../components/Chip';
import { TogglePill } from '../components/TogglePill';
import { GarmentImageTile } from '../components/GarmentImageTile';
import { ErrorState } from '../components/ErrorState';
import { MinusIcon, PlusIcon } from '../components/icons';
import { useDeleteGarment, useGarment, useUpdateGarment } from '../hooks/useGarments';
import { t as tr } from '../lib/i18n';
import { showToast } from '../lib/toast';
import type { GarmentUpdate } from '../types/garment';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EditGarment'>;

// 30 named colors with hex values. Same swatch palette the legacy form used —
// keeping it as a data constant satisfies the "no hardcoded hex outside data
// constants" rule. The `id` is what we persist into `color_primary`.
const COLOR_SWATCHES: { id: string; label: string; color: string }[] = [
  { id: 'cream',     label: 'Cream',     color: '#F5EBD8' },
  { id: 'beige',     label: 'Beige',     color: '#D9C9A6' },
  { id: 'camel',     label: 'Camel',     color: '#B98E5A' },
  { id: 'rust',      label: 'Rust',      color: '#A85432' },
  { id: 'brown',     label: 'Brown',     color: '#5C3F2C' },
  { id: 'olive',     label: 'Olive',     color: '#6B6B3F' },
  { id: 'forest',    label: 'Forest',    color: '#2F4F33' },
  { id: 'sage',      label: 'Sage',      color: '#A4B89A' },
  { id: 'mustard',   label: 'Mustard',   color: '#C9A227' },
  { id: 'gold',      label: 'Gold',      color: '#C9A445' },
  { id: 'terracotta',label: 'Terracotta',color: '#C25B45' },
  { id: 'red',       label: 'Red',       color: '#9B2D26' },
  { id: 'pink',      label: 'Pink',      color: '#E1B5B0' },
  { id: 'rose',      label: 'Rose',      color: '#C58085' },
  { id: 'plum',      label: 'Plum',      color: '#5A3E5C' },
  { id: 'lavender',  label: 'Lavender',  color: '#B7A4C8' },
  { id: 'navy',      label: 'Navy',      color: '#1F2D4A' },
  { id: 'blue',      label: 'Blue',      color: '#3D5A80' },
  { id: 'sky',       label: 'Sky',       color: '#9CC0DD' },
  { id: 'teal',      label: 'Teal',      color: '#2E6E6B' },
  { id: 'mint',      label: 'Mint',      color: '#B6D7C2' },
  { id: 'slate',     label: 'Slate',     color: '#7A8089' },
  { id: 'charcoal',  label: 'Charcoal',  color: '#2A2622' },
  { id: 'black',     label: 'Black',     color: '#111111' },
  { id: 'white',     label: 'White',     color: '#F8F4EE' },
  { id: 'silver',    label: 'Silver',    color: '#C9C9C9' },
  { id: 'denim',     label: 'Denim',     color: '#3A4F66' },
  { id: 'mocha',     label: 'Mocha',     color: '#6B4F3B' },
  { id: 'sand',      label: 'Sand',      color: '#D7C4A1' },
  { id: 'ochre',     label: 'Ochre',     color: '#B0742F' },
];

const CATEGORIES = ['Top', 'Bottom', 'Shoes', 'Outer', 'Dress', 'Accessory'];
const MATERIALS = ['Cotton', 'Linen', 'Wool', 'Cashmere', 'Silk', 'Leather', 'Denim', 'Synthetic'];
const FITS = ['Slim', 'Regular', 'Loose', 'Oversized'];
const PATTERNS = ['Solid', 'Striped', 'Checked', 'Floral', 'Other'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export function EditGarmentScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;

  const { data: garment, isLoading, isError, refetch } = useGarment(editingId);
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();

  // Form state — initialised once garment loads. We avoid mirroring the
  // garment columns into state until the row is actually fetched, so a stale
  // prefill never overwrites a freshly-loaded value when the user navigates
  // back-and-forth between two garments quickly.
  const [hydrated, setHydrated] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [subcategory, setSubcategory] = React.useState('');
  const [primaryColor, setPrimaryColor] = React.useState<string>('');
  const [material, setMaterial] = React.useState<string>('');
  const [fit, setFit] = React.useState<string>('');
  const [pattern, setPattern] = React.useState<string>('');
  const [seasons, setSeasons] = React.useState<string[]>([]);
  const [wearCount, setWearCount] = React.useState(0);
  const [price, setPrice] = React.useState('');
  const [inLaundry, setInLaundry] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Pre-fill from the loaded garment ONCE per garment.id. We key the
  // hydration on garment.id so navigating to a different garment re-fills.
  const lastHydratedIdRef = React.useRef<string | null>(null);
  // Snapshot of the values pre-fill landed with — compared against current
  // form state to detect unsaved edits in the cancel-with-edits guard
  // below. Stringified seasons array because React state arrays change
  // identity on every toggle but we only care about content. (F-015 in
  // the N9 polish bundle.)
  const initialFormRef = React.useRef<string>('');
  React.useEffect(() => {
    if (!garment) return;
    if (lastHydratedIdRef.current === garment.id) return;
    lastHydratedIdRef.current = garment.id;
    const initialValues = {
      title: garment.title ?? '',
      category: garment.category ?? '',
      subcategory: garment.subcategory ?? '',
      primaryColor: garment.color_primary ?? '',
      material: garment.material ?? '',
      fit: garment.fit ?? '',
      pattern: garment.pattern ?? '',
      seasons: [...(garment.season_tags ?? [])].sort(),
      wearCount: garment.wear_count ?? 0,
      price: garment.purchase_price != null ? String(garment.purchase_price) : '',
      inLaundry: Boolean(garment.in_laundry),
    };
    setTitle(initialValues.title);
    setCategory(initialValues.category);
    setSubcategory(initialValues.subcategory);
    setPrimaryColor(initialValues.primaryColor);
    setMaterial(initialValues.material);
    setFit(initialValues.fit);
    setPattern(initialValues.pattern);
    setSeasons(garment.season_tags ?? []);
    setWearCount(initialValues.wearCount);
    setPrice(initialValues.price);
    setInLaundry(initialValues.inLaundry);
    initialFormRef.current = JSON.stringify(initialValues);
    setHydrated(true);
  }, [garment]);

  // Dirty check — recompute on every render against the snapshot ref
  // taken at hydration time. Cheap (one JSON.stringify per render) and
  // avoids a useState that would lag a frame behind the actual form
  // state. (F-015 in the N9 polish bundle.)
  const isDirty = React.useMemo(() => {
    if (!hydrated) return false;
    const current = JSON.stringify({
      title,
      category,
      subcategory,
      primaryColor,
      material,
      fit,
      pattern,
      seasons: [...seasons].sort(),
      wearCount,
      price,
      inLaundry,
    });
    return current !== initialFormRef.current;
  }, [
    hydrated,
    title,
    category,
    subcategory,
    primaryColor,
    material,
    fit,
    pattern,
    seasons,
    wearCount,
    price,
    inLaundry,
  ]);

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

  const togglePick = <T,>(val: T, list: T[], setList: (xs: T[]) => void) =>
    setList(list.includes(val) ? list.filter((v) => v !== val) : [...list, val]);

  const isValid = title.trim().length > 0 && category.length > 0;

  const handleSave = async () => {
    if (!garment || !isValid) return;
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
        // N3b — validation feedback; user retypes inline rather than
        // acknowledging a modal.
        showToast(
          'error',
          tr('editGarment.invalidPrice.title'),
          tr('editGarment.invalidPrice.body'),
        );
        return;
      }

      const updates: GarmentUpdate = {
        title: title.trim(),
        category,
        subcategory: subcategory.trim() || null,
        color_primary: primaryColor || null,
        material: material || null,
        fit: fit || null,
        pattern: pattern || null,
        season_tags: seasons,
        wear_count: wearCount,
        purchase_price: parsedPrice,
        in_laundry: inLaundry,
      };

      await updateGarment.mutateAsync({ id: garment.id, updates });
      nav.goBack();
    } catch (err) {
      // N3b — non-blocking; the form is still on screen so the user can retry.
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
              // N3b — confirmation above is the action gate; failure
              // becomes a toast so the user can retry without re-confirming.
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
                // N3b — informational ("photo upload coming soon"); toast.
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

          {/* Details */}
          <FormCard title={tr('editGarment.section.details')}>
            <FieldLabel label={tr('editGarment.field.title')} />
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={t.fg3}
              style={[s.input, { backgroundColor: t.bg2, borderColor: t.border, color: t.fg }]}
            />

            <FieldLabel label={tr('editGarment.field.category')} topGap />
            <ChipRow values={CATEGORIES} active={[category]} onTap={(v) => setCategory(v)} />

            <FieldLabel label={tr('editGarment.field.subcategory')} topGap />
            <TextInput
              value={subcategory}
              onChangeText={setSubcategory}
              placeholderTextColor={t.fg3}
              style={[s.input, { backgroundColor: t.bg2, borderColor: t.border, color: t.fg }]}
            />
          </FormCard>

          {/* Style */}
          <FormCard title={tr('editGarment.section.style')}>
            <FieldLabel label={tr('editGarment.field.primaryColor')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {COLOR_SWATCHES.map((c) => {
                const active = c.id === primaryColor;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={c.label}
                    onPress={() => setPrimaryColor(c.id)}
                    style={({ pressed }) => [
                      s.swatch,
                      {
                        borderColor: active ? t.accent : t.border,
                        borderWidth: active ? 2 : 1,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}>
                    <View style={[s.swatchInner, { backgroundColor: c.color }]} />
                  </Pressable>
                );
              })}
            </ScrollView>

            <FieldLabel label={tr('editGarment.field.material')} topGap />
            <ChipRow values={MATERIALS} active={material ? [material] : []} onTap={(v) => setMaterial(material === v ? '' : v)} />

            <FieldLabel label={tr('editGarment.field.fit')} topGap />
            <ChipRow values={FITS} active={fit ? [fit] : []} onTap={(v) => setFit(fit === v ? '' : v)} />

            <FieldLabel label={tr('editGarment.field.pattern')} topGap />
            <ChipRow values={PATTERNS} active={pattern ? [pattern] : []} onTap={(v) => setPattern(pattern === v ? '' : v)} />
          </FormCard>

          {/* Usage */}
          <FormCard title={tr('editGarment.section.usage')}>
            <FieldLabel label={tr('editGarment.field.seasons')} />
            <ChipRow
              values={SEASONS}
              active={seasons}
              onTap={(v) => togglePick(v, seasons, setSeasons)}
            />

            <FieldLabel label={tr('editGarment.field.wearCount')} topGap />
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

          {/* Status */}
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

function ChipRow({
  values,
  active,
  onTap,
}: {
  values: string[];
  active: string[];
  onTap: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {values.map((v) => (
        <Chip key={v} label={v} active={active.includes(v)} onPress={() => onTap(v)} />
      ))}
    </View>
  );
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
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 999,
    padding: 3,
  },
  swatchInner: {
    flex: 1,
    borderRadius: 999,
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
