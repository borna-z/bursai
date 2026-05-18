// Phase 6 — AddPiece Step 3 picker form.
//
// Extracted from `AddPieceStep3.tsx` (the heaviest mobile screen). Owns the
// 11 metadata pickers + their layout. Uses a single `useReducer` so the
// orchestrator sees one onChange callback instead of 11 setters; the design
// spec called this out specifically to avoid prop-drilling 11 dispatch
// functions across the component boundary.
//
// What this component does NOT do:
//   - Duplicate detection (lives at the orchestrator — it is the source of
//     truth for the duplicate-warning UI per the spec).
//   - Save mutation / cleanup refs / batch handling (lives in
//     `AddPieceStep3SaveFlow`).
//   - Photo review, header, save bar (still in the orchestrator).
//
// Inputs:
//   - `initial`: snapshot to seed the reducer. The orchestrator builds it
//     from the analyzer prefill (using `matchCanonical` so out-of-set
//     values become '' and the user is prompted to pick something
//     wardrobe-filters recognise).
//   - `onChange`: fired on every reducer transition with the full snapshot.
//     The orchestrator caches the latest snapshot in a ref and reads it on
//     save.
//
// Visual contract: every chip / swatch / input style and label is preserved
// byte-for-byte from the pre-refactor screen.

import React, { useEffect, useReducer, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Eyebrow } from '../../components/Eyebrow';
import { Chip } from '../../components/Chip';
import {
  CATEGORIES,
  MATERIALS,
  FITS,
  PATTERNS,
  COLOR_SWATCHES,
  FORMALITY_OPTIONS,
} from '../../lib/garmentTaxonomy';
import { t as tr } from '../../lib/i18n';
import type {
  CategoryValue,
  FitValue,
  FormalityValue,
  GarmentFormState,
  GarmentFormValidation,
  MaterialValue,
  PatternValue,
} from './garmentMetadataForm.types';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_LABEL_KEYS: Record<string, string> = {
  spring: 'addpiece.step3.season.spring',
  summer: 'addpiece.step3.season.summer',
  autumn: 'addpiece.step3.season.autumn',
  winter: 'addpiece.step3.season.winter',
};

function titleCase(value: string | null | undefined): string {
  if (!value) return tr('common.empty');
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Discriminated reducer action set. One per picker field — keeps the type
// system pinning every dispatch site to a valid field/value combo.
type FormAction =
  | { type: 'setTitle'; value: string }
  | { type: 'setCategory'; value: CategoryValue }
  | { type: 'setSubcategory'; value: string }
  | { type: 'setPrimaryColor'; value: string }
  | { type: 'setSecondaryColor'; value: string }
  | { type: 'setMaterial'; value: MaterialValue }
  | { type: 'setFit'; value: FitValue }
  | { type: 'setPattern'; value: PatternValue }
  | { type: 'toggleSeason'; value: string }
  | { type: 'setFormality'; value: FormalityValue }
  | { type: 'setPrice'; value: string };

function reducer(state: GarmentFormState, action: FormAction): GarmentFormState {
  switch (action.type) {
    case 'setTitle':
      return { ...state, title: action.value };
    case 'setCategory':
      return { ...state, category: state.category === action.value ? '' : action.value };
    case 'setSubcategory':
      return { ...state, subcategory: action.value };
    case 'setPrimaryColor':
      return {
        ...state,
        primaryColor: state.primaryColor === action.value ? '' : action.value,
      };
    case 'setSecondaryColor':
      return {
        ...state,
        secondaryColor: state.secondaryColor === action.value ? '' : action.value,
      };
    case 'setMaterial':
      return { ...state, material: state.material === action.value ? '' : action.value };
    case 'setFit':
      return { ...state, fit: state.fit === action.value ? '' : action.value };
    case 'setPattern':
      return { ...state, pattern: state.pattern === action.value ? '' : action.value };
    case 'toggleSeason': {
      const lower = action.value.toLowerCase();
      const hasIt = state.seasons.map((s) => s.toLowerCase()).includes(lower);
      return {
        ...state,
        seasons: hasIt
          ? state.seasons.filter((s) => s.toLowerCase() !== lower)
          : [...state.seasons, action.value],
      };
    }
    case 'setFormality':
      // 3-stop selector is non-toggleable. Tapping the active chip is a no-op
      // because persistGarment treats `null` as "fall back to analysis", so a
      // clear-to-null would silently restore the AI value the user just
      // removed. Preserves Codex P2 round 1 fix on PR #725.
      return state.formality === action.value
        ? state
        : { ...state, formality: action.value };
    case 'setPrice':
      return { ...state, price: action.value };
    default:
      return state;
  }
}

// Default validator — title required, category required. The legacy
// AddPieceStep3 didn't surface inline validation (it always fell back to the
// analyzer title / 'top' category in handleSave), so this acts as an opt-in
// signal for future Edit-form consumers. The current orchestrator ignores it
// and preserves the prior fall-through behaviour.
export function validateGarmentForm(state: GarmentFormState): GarmentFormValidation {
  const errors: GarmentFormValidation['errors'] = {};
  // Plain English fallbacks — i18n/locales is append-only and the legacy
  // AddPieceStep3 didn't surface inline validation, so wiring locale keys
  // here would touch every dictionary. The orchestrator currently passes
  // `showValidation={false}`; EditGarmentScreen adopts these keys when it
  // migrates to this form in a follow-up phase.
  if (state.title.trim().length === 0) {
    errors.title = 'Title is required';
  }
  if (state.category.length === 0) {
    errors.category = 'Category is required';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export interface AddPieceStep3FormProps {
  initial: GarmentFormState;
  onChange: (state: GarmentFormState) => void;
  // Optional inline validation surface. The AddPieceStep3 orchestrator
  // currently passes `false` to preserve the pre-refactor UX (analyzer
  // fallthrough handles missing fields at save time); EditGarmentScreen can
  // pass `true` when it adopts this form in a follow-up.
  showValidation?: boolean;
  /** Optional opt-out for individual pickers. Today only `formality` is
   * gateable — that's the picker EditGarmentScreen hides behind its
   * "advanced" toggle (pre-#860 the legacy edit screen hid it entirely;
   * the toggle gives the user the choice without widening the default
   * edit surface). Adding a new gateable picker requires extending BOTH
   * `HideablePickerKey` here AND the corresponding `!hidePickers?.includes(...)`
   * guard in the JSX below — the narrow type makes that intent
   * explicit. Per
   * `docs/modularization/2026-05-17-edit-garment-screen-picker-visibility-design.md`
   * (Option B). */
  hidePickers?: readonly HideablePickerKey[];
}

/** Form-state keys for which a `hidePickers` opt-out is currently wired
 * in the JSX. Keep in sync with the conditional render guards inside
 * `AddPieceStep3Form` — TypeScript narrows callers to a valid subset.
 *
 * `price` is hideable because EditGarmentScreen already renders its own
 * purchase-price input alongside wear-count and laundry toggles; showing
 * a second price field via the shared form there would duplicate the UI. */
export type HideablePickerKey = 'formality' | 'price';

export function AddPieceStep3Form({
  initial,
  onChange,
  showValidation = false,
  hidePickers,
}: AddPieceStep3FormProps) {
  const t = useTokens();
  // Single reducer for all 11 pickers. The lazy initialiser keeps the seed
  // stable across renders so a parent re-render with a fresh `initial` object
  // identity doesn't reset user edits.
  const [state, dispatch] = useReducer(reducer, initial, (seed) => seed);

  // Fire onChange after each commit. Using a ref to skip the initial-state
  // emit would change observable behaviour for Edit consumers that want to
  // hydrate validation immediately, so we emit eagerly and let the consumer
  // dedupe by identity if it cares. The orchestrator caches the latest
  // snapshot in a ref so its save handler reads the current value without
  // adding a re-render dependency.
  const lastEmittedRef = useRef<GarmentFormState | null>(null);
  useEffect(() => {
    if (lastEmittedRef.current === state) return;
    lastEmittedRef.current = state;
    onChange(state);
  }, [state, onChange]);

  const validation = validateGarmentForm(state);
  const seasonsLower = state.seasons.map((s) => s.toLowerCase());

  return (
    <View style={{ gap: 14 }}>
      {/* ============ TITLE INPUT ============ */}
      <View style={{ gap: 6 }}>
        <Text
          style={{
            fontFamily: fonts.uiSemi,
            fontSize: 10,
            letterSpacing: 1.4,
            color: t.fg2,
            textTransform: 'uppercase',
          }}>
          {tr('addpiece.step3.titleLabel')}
        </Text>
        <TextInput
          value={state.title}
          onChangeText={(value) => dispatch({ type: 'setTitle', value })}
          placeholder={initial.title || tr('addpiece.step3.titlePlaceholder')}
          placeholderTextColor={t.fg3}
          style={[
            s.titleInput,
            { borderColor: t.border, backgroundColor: t.card, color: t.fg },
          ]}
          maxLength={60}
          returnKeyType="done"
          accessibilityLabel={tr('addpiece.step3.titleLabel')}
        />
        {showValidation && validation.errors.title ? (
          <Text style={[s.errorText, { color: t.destructive }]}>
            {validation.errors.title}
          </Text>
        ) : null}
      </View>

      {/* ============ EDITABLE PICKERS ============ */}
      <View style={{ gap: 14 }}>
        <View>
          <Eyebrow style={{ marginBottom: 8 }}>
            {tr('addpiece.step3.field.category')}
          </Eyebrow>
          <ChipRow
            values={CATEGORIES as readonly string[]}
            active={state.category ? [state.category] : []}
            onTap={(v) => dispatch({ type: 'setCategory', value: v as CategoryValue })}
            getLabel={titleCase}
          />
          {showValidation && validation.errors.category ? (
            <Text style={[s.errorText, { color: t.destructive }]}>
              {validation.errors.category}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 6 }}>
          <Eyebrow>{tr('addpiece.step3.field.subcategory')}</Eyebrow>
          <TextInput
            value={state.subcategory}
            onChangeText={(value) => dispatch({ type: 'setSubcategory', value })}
            placeholder={tr('addpiece.step3.subcategory.placeholder')}
            placeholderTextColor={t.fg3}
            style={[
              s.titleInput,
              { borderColor: t.border, backgroundColor: t.card, color: t.fg },
            ]}
            maxLength={40}
            returnKeyType="done"
          />
        </View>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>
            {tr('addpiece.step3.field.colorPrimary')}
          </Eyebrow>
          <SwatchRow
            activeId={state.primaryColor}
            onPick={(id) => dispatch({ type: 'setPrimaryColor', value: id })}
          />
        </View>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>
            {tr('addpiece.step3.field.colorSecondary')}
          </Eyebrow>
          <SwatchRow
            activeId={state.secondaryColor}
            onPick={(id) => dispatch({ type: 'setSecondaryColor', value: id })}
            allowNone
          />
        </View>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>
            {tr('addpiece.step3.field.material')}
          </Eyebrow>
          <ChipRow
            values={MATERIALS as readonly string[]}
            active={state.material ? [state.material] : []}
            onTap={(v) => dispatch({ type: 'setMaterial', value: v as MaterialValue })}
            getLabel={titleCase}
          />
        </View>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>
            {tr('addpiece.step3.field.fit')}
          </Eyebrow>
          <ChipRow
            values={FITS as readonly string[]}
            active={state.fit ? [state.fit] : []}
            onTap={(v) => dispatch({ type: 'setFit', value: v as FitValue })}
            getLabel={titleCase}
          />
        </View>

        <View>
          <Eyebrow style={{ marginBottom: 8 }}>
            {tr('addpiece.step3.field.pattern')}
          </Eyebrow>
          <ChipRow
            values={PATTERNS as readonly string[]}
            active={state.pattern ? [state.pattern] : []}
            onTap={(v) => dispatch({ type: 'setPattern', value: v as PatternValue })}
            getLabel={titleCase}
          />
        </View>
      </View>

      {/* ============ SEASONS — multi-chip ============ */}
      <View>
        <Eyebrow style={{ marginBottom: 8 }}>{tr('addpiece.step3.seasonsEyebrow')}</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SEASONS.map((season) => {
            const active = seasonsLower.includes(season);
            return (
              <Chip
                key={season}
                label={tr(SEASON_LABEL_KEYS[season])}
                active={active}
                onPress={() => dispatch({ type: 'toggleSeason', value: season })}
              />
            );
          })}
        </View>
      </View>

      {/* ============ FORMALITY — 3-stop selector ============ */}
      {!hidePickers?.includes('formality') && (
        <View>
          <Eyebrow style={{ marginBottom: 8 }}>
            {tr('addpiece.step3.field.formality')}
          </Eyebrow>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {FORMALITY_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={tr(opt.key)}
                active={state.formality === opt.value}
                onPress={() => dispatch({ type: 'setFormality', value: opt.value })}
              />
            ))}
          </View>
        </View>
      )}

      {/* ============ PRICE — optional numeric input ============ */}
      {/* Audit FIX 7 (2026-05-18). The DB column `garments.purchase_price`
          already exists and persistGarmentRaw accepts `params.price`, but
          AddPiece never offered a place to enter it — so every new garment
          shipped with `purchase_price: null` and downstream wardrobe-value
          analytics had no data to render. Hidden in EditGarmentScreen via
          `hidePickers={['price']}` since that screen has its own price
          input alongside wear-count + laundry toggle. */}
      {!hidePickers?.includes('price') && (
        <View style={{ gap: 6 }}>
          <Eyebrow>{tr('addpiece.step3.field.price')}</Eyebrow>
          <TextInput
            value={state.price}
            onChangeText={(value) => dispatch({ type: 'setPrice', value })}
            placeholder={tr('addpiece.step3.field.price.placeholder')}
            placeholderTextColor={t.fg3}
            keyboardType="decimal-pad"
            style={[
              s.titleInput,
              { borderColor: t.border, backgroundColor: t.card, color: t.fg },
            ]}
            maxLength={12}
            returnKeyType="done"
            accessibilityLabel={tr('addpiece.step3.field.price')}
          />
        </View>
      )}
    </View>
  );
}

// Inline picker helpers — preserved from the pre-refactor screen so the
// chip / swatch layout matches pixel-for-pixel. They live alongside the form
// because the form is their only consumer; the legacy file's "promote to
// `mobile/src/components/pickers/` once EditGarmentScreen migrates" comment
// still applies on a future phase.

function ChipRow({
  values,
  active,
  onTap,
  style,
  getLabel = (v) => v,
}: {
  values: readonly string[];
  active: string[];
  onTap: (v: string) => void;
  style?: StyleProp<ViewStyle>;
  getLabel?: (v: string) => string;
}) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, style]}>
      {values.map((v) => (
        <Chip key={v} label={getLabel(v)} active={active.includes(v)} onPress={() => onTap(v)} />
      ))}
    </View>
  );
}

function SwatchRow({
  activeId,
  onPick,
  allowNone = false,
}: {
  activeId: string;
  onPick: (id: string) => void;
  allowNone?: boolean;
}) {
  const t = useTokens();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {allowNone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('addpiece.step3.color.none')}
          onPress={() => onPick('')}
          style={({ pressed }) => [
            s.swatchNone,
            {
              borderColor: activeId === '' ? t.accent : t.border,
              borderWidth: activeId === '' ? 2 : 1,
              backgroundColor: t.card,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Text
            style={{
              fontFamily: fonts.uiSemi,
              fontSize: 9,
              letterSpacing: 0.8,
              color: t.fg2,
              textTransform: 'uppercase',
            }}>
            {tr('addpiece.step3.color.none.short')}
          </Text>
        </Pressable>
      ) : null}
      {COLOR_SWATCHES.map((c) => {
        const active = c.id === activeId;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            onPress={() => onPick(c.id)}
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
  );
}

const s = StyleSheet.create({
  titleInput: {
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: fonts.uiMed,
    fontSize: 14,
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
  swatchNone: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: fonts.uiMed,
    fontSize: 11,
    marginTop: 4,
  },
});
