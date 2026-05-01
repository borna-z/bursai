// Edit garment — opened from GarmentDetail's edit button.
// Header: cancel left · italic eyebrow + title centered · save right (accent).
// Body: photo with "Change photo" pill overlay, then four Cards — Details / Style / Usage / Status —
// each holding a stack of fields, chip groups, color swatch row, stepper, etc. Bottom: red Delete row.
//
// KeyboardAvoidingView wraps the whole scroll body so text inputs (Title, Subcategory, Price)
// don't get clipped on iOS. ScrollView, not FlatList — fields are heterogenous and short.
//
// Source of truth: design_handoff_burs_rn/source/audit-screens.jsx EditGarmentScreen + the user
// brief for this PR (which is the canonical spec — handoff is shorter).

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from '../components/Eyebrow';
import { Chip } from '../components/Chip';
import { TogglePill } from '../components/TogglePill';
import { MinusIcon, PlusIcon } from '../components/icons';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EditGarment'>;

// Tiny seed map of known garment ids → form defaults. Lets EditGarment open with the right
// title / category / wear count when launched from GarmentDetail's edit affordance, and falls
// back to a generic placeholder for any other id. Codex P1 round 3 #1: route param `id` is
// now received instead of dropped to undefined. When the backend hook lands this becomes
// `useGarment(id)` and seeds every form field from the real row.
const SEED_BY_ID: Record<string, { title: string; category: string; subcategory: string; wearCount: number; colorId: string }> = {
  g1: { title: 'Cream tee',         category: 'Top',    subcategory: 'Tee',       wearCount: 31, colorId: 'cream' },
  g2: { title: 'Navy blazer',       category: 'Outer',  subcategory: 'Blazer',    wearCount: 3,  colorId: 'navy' },
  g3: { title: 'Linen trouser',     category: 'Bottom', subcategory: 'Trouser',   wearCount: 14, colorId: 'cream' },
  g4: { title: 'Leather loafer',    category: 'Shoes',  subcategory: 'Loafer',    wearCount: 5,  colorId: 'beige' },
  g5: { title: 'Wool overshirt',    category: 'Outer',  subcategory: 'Overshirt', wearCount: 23, colorId: 'beige' },
  g6: { title: 'Striped oxford',    category: 'Top',    subcategory: 'Shirt',     wearCount: 9,  colorId: 'white' },
  g7: { title: 'Black denim',       category: 'Bottom', subcategory: 'Jean',      wearCount: 11, colorId: 'black' },
  g8: { title: 'Cashmere knit',     category: 'Top',    subcategory: 'Knit',      wearCount: 7,  colorId: 'rust' },
  g9: { title: 'Suede boot',        category: 'Shoes',  subcategory: 'Chelsea',   wearCount: 4,  colorId: 'brown' },
};

// 30 named colors with hex/hsl values. Keeping these as a data constant (not tokens) — the
// "no hardcoded hex" rule has a carve-out for data/color constants. Same convention as the
// design's Insights palette.
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
const MATERIALS = ['Cotton', 'Linen', 'Wool', 'Silk', 'Leather', 'Denim', 'Synthetic'];
const FITS = ['Slim', 'Regular', 'Loose', 'Oversized'];
const PATTERNS = ['Solid', 'Striped', 'Checked', 'Floral', 'Other'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const FORMALITIES = ['Casual', 'Smart', 'Business', 'Formal'];

export function EditGarmentScreen() {
  const t = useTokens();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;
  // Seed the form fields from the matching SEED_BY_ID entry when the route id is known; fall
  // back to the wool-overshirt default for unknown / missing ids so the form is still demoable
  // without a backend. Codex P1 round 3 #1: route param is now read instead of dropped.
  // Use an explicit ternary (not `editingId && SEED_BY_ID[editingId]`) so TypeScript narrows
  // the seed type cleanly — `&&` would let an empty-string id propagate as `""` into the union.
  const seed = (editingId ? SEED_BY_ID[editingId] : undefined) ?? SEED_BY_ID.g5!;

  const [title, setTitle] = React.useState(seed.title);
  const [category, setCategory] = React.useState(seed.category);
  const [subcategory, setSubcategory] = React.useState(seed.subcategory);
  const [primaryColor, setPrimaryColor] = React.useState(seed.colorId);
  const [materials, setMaterials] = React.useState<string[]>(['Wool']);
  const [fit, setFit] = React.useState('Regular');
  const [pattern, setPattern] = React.useState('Solid');
  const [seasons, setSeasons] = React.useState<string[]>(['Spring', 'Autumn']);
  const [formalities, setFormalities] = React.useState<string[]>(['Smart']);
  const [wearCount, setWearCount] = React.useState(seed.wearCount);
  const [price, setPrice] = React.useState('189');
  const [inLaundry, setInLaundry] = React.useState(false);
  const [archive, setArchive] = React.useState(false);

  const togglePick = <T,>(val: T, list: T[], setList: (xs: T[]) => void) =>
    setList(list.includes(val) ? list.filter((v) => v !== val) : [...list, val]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View style={[s.headerRow, { borderBottomColor: t.border }]}>
          <Pressable
            onPress={() => nav.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={8}>
            <Text
              style={{
                fontFamily: fonts.uiMed,
                fontSize: 13,
                color: t.fg2,
              }}>
              Cancel
            </Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Eyebrow>Edit</Eyebrow>
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
              Edit piece
            </Text>
          </View>
          <Pressable
            onPress={() => nav.goBack()}
            accessibilityLabel="Save"
            accessibilityRole="button"
            hitSlop={8}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 13,
                color: t.accent,
                fontWeight: '600',
              }}>
              Save
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Photo + Change photo overlay */}
          <View style={[s.photoWrap, { borderColor: t.border }]}>
            <LinearGradient
              colors={['hsl(32, 38%, 78%)', 'hsl(62, 30%, 62%)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
            <Pressable
              accessibilityLabel="Change photo"
              accessibilityRole="button"
              style={({ pressed }) => [
                s.photoChange,
                {
                  backgroundColor: t.card,
                  borderColor: t.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 12,
                  color: t.fg,
                  letterSpacing: -0.1,
                }}>
                Change photo
              </Text>
            </Pressable>
          </View>

          {/* Section: Details */}
          <FormCard title="Details">
            <FieldLabel label="Title" />
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={t.fg3}
              style={[s.input, { backgroundColor: t.bg2, borderColor: t.border, color: t.fg }]}
            />

            <FieldLabel label="Category" topGap />
            <ChipRow values={CATEGORIES} active={[category]} onTap={(v) => setCategory(v)} />

            <FieldLabel label="Subcategory" topGap />
            <TextInput
              value={subcategory}
              onChangeText={setSubcategory}
              placeholderTextColor={t.fg3}
              style={[s.input, { backgroundColor: t.bg2, borderColor: t.border, color: t.fg }]}
            />
          </FormCard>

          {/* Section: Style */}
          <FormCard title="Style">
            <FieldLabel label="Primary color" />
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

            <FieldLabel label="Material" topGap />
            <ChipRow
              values={MATERIALS}
              active={materials}
              onTap={(v) => togglePick(v, materials, setMaterials)}
            />

            <FieldLabel label="Fit" topGap />
            <ChipRow values={FITS} active={[fit]} onTap={(v) => setFit(v)} />

            <FieldLabel label="Pattern" topGap />
            <ChipRow values={PATTERNS} active={[pattern]} onTap={(v) => setPattern(v)} />
          </FormCard>

          {/* Section: Usage */}
          <FormCard title="Usage">
            <FieldLabel label="Seasons" />
            <ChipRow
              values={SEASONS}
              active={seasons}
              onTap={(v) => togglePick(v, seasons, setSeasons)}
            />

            <FieldLabel label="Formality" topGap />
            <ChipRow
              values={FORMALITIES}
              active={formalities}
              onTap={(v) => togglePick(v, formalities, setFormalities)}
            />

            <FieldLabel label="Wear count" topGap />
            <View style={s.stepperRow}>
              <Pressable
                accessibilityLabel="Decrement wear count"
                accessibilityRole="button"
                onPress={() => setWearCount((n) => Math.max(0, n - 1))}
                style={({ pressed }) => [
                  s.stepperBtn,
                  {
                    backgroundColor: t.card,
                    borderColor: t.border,
                    opacity: pressed ? 0.7 : 1,
                  },
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
                accessibilityLabel="Increment wear count"
                accessibilityRole="button"
                onPress={() => setWearCount((n) => n + 1)}
                style={({ pressed }) => [
                  s.stepperBtn,
                  {
                    backgroundColor: t.card,
                    borderColor: t.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <PlusIcon color={t.fg} />
              </Pressable>
            </View>

            <FieldLabel label="Price" topGap />
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

          {/* Section: Status */}
          <FormCard title="Status">
            <View style={s.statusRow}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 13.5,
                  color: t.fg,
                  flex: 1,
                  letterSpacing: -0.13,
                }}>
                In laundry
              </Text>
              <TogglePill
                label={inLaundry ? 'On' : 'Off'}
                active={inLaundry}
                onToggle={setInLaundry}
              />
            </View>
            <View style={[s.divider, { backgroundColor: t.border }]} />
            <View style={s.statusRow}>
              <Text
                style={{
                  fontFamily: fonts.uiSemi,
                  fontSize: 13.5,
                  color: t.fg,
                  flex: 1,
                  letterSpacing: -0.13,
                }}>
                Archive
              </Text>
              <TogglePill
                label={archive ? 'On' : 'Off'}
                active={archive}
                onToggle={setArchive}
              />
            </View>
          </FormCard>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete piece"
            style={{ alignSelf: 'center', paddingVertical: 14 }}>
            <Text
              style={{
                fontFamily: fonts.uiSemi,
                fontSize: 13,
                color: t.destructive,
                letterSpacing: -0.1,
              }}>
              Delete piece
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
        <Chip
          key={v}
          label={v}
          active={active.includes(v)}
          onPress={() => onTap(v)}
        />
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
  divider: {
    height: 1,
    marginVertical: 4,
  },
});
