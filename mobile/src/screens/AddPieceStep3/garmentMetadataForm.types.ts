// Phase 6 — shared input/output type for AddPieceStep3Form.
//
// The orchestrator owns navigation + photo review + save flow; the form owns
// the 11 metadata pickers and their validation. The contract here is the only
// surface between them, so the form can be reused by EditGarmentScreen in a
// follow-up without prop-drilling drift.
//
// `GarmentFormState` is the full snapshot the orchestrator needs to compute
// the `ai_overridden` audit map and feed the duplicate-detection query. The
// form emits the snapshot on every change via one onChange callback (the
// "single onChange" pattern from the design spec — collapses 11 setters
// into one).

import type { CATEGORIES, MATERIALS, FITS, PATTERNS } from '../../lib/garmentTaxonomy';

export type CategoryValue = typeof CATEGORIES[number] | '';
export type MaterialValue = typeof MATERIALS[number] | '';
export type FitValue = typeof FITS[number] | '';
export type PatternValue = typeof PATTERNS[number] | '';
export type FormalityValue = 1 | 2 | 3 | 4 | 5 | null;

// Full picker snapshot. Mirrors the 11 pieces of state that lived inline in
// AddPieceStep3 before the split.
export interface GarmentFormState {
  title: string;
  category: CategoryValue;
  subcategory: string;
  primaryColor: string;
  secondaryColor: string;
  material: MaterialValue;
  fit: FitValue;
  pattern: PatternValue;
  seasons: string[];
  formality: FormalityValue;
}

// Validation result. The orchestrator's save handler reads `isValid`; when the
// pickers gain hard validation rules (Phase 6+ scope), `errors` carries
// per-field messages that the form surfaces below the offending picker.
export interface GarmentFormValidation {
  isValid: boolean;
  errors: Partial<Record<keyof GarmentFormState, string>>;
}
