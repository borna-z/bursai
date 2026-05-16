// Phase 6 — AddPieceStep3Form smoke + validation coverage.
//
// Two passes:
//   1. Smoke render — the form mounts with a sensible initial snapshot and
//      emits the expected GarmentFormState through its onChange.
//   2. Validation — `validateGarmentForm` surfaces an error when the title
//      is blank or the category is missing; both required.
//
// The form uses a single useReducer so the onChange is exercised by simulating
// chip taps and confirming the next emit carries the toggled value.

import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { AddPieceStep3Form, validateGarmentForm } from '../AddPieceStep3/AddPieceStep3Form';
import type { GarmentFormState } from '../AddPieceStep3/garmentMetadataForm.types';
import { ThemeProvider } from '../../theme/ThemeProvider';

const baseInitial: GarmentFormState = {
  title: 'Linen shirt',
  category: 'top',
  subcategory: '',
  primaryColor: '',
  secondaryColor: '',
  material: '',
  fit: '',
  pattern: '',
  seasons: [],
  formality: null,
};

function renderForm(initial: GarmentFormState = baseInitial) {
  const onChange = jest.fn();
  const utils = render(
    <ThemeProvider>
      <AddPieceStep3Form initial={initial} onChange={onChange} />
    </ThemeProvider>,
  );
  return { ...utils, onChange };
}

describe('AddPieceStep3Form — smoke render', () => {
  it('mounts and emits the initial snapshot on first render', () => {
    const { onChange, getByDisplayValue } = renderForm();

    // The initial title flows through the TextInput as a visible value.
    expect(getByDisplayValue('Linen shirt')).toBeTruthy();

    // onChange fires once with the initial state — the reducer's lazy
    // initialiser preserves identity, and the effect emits on first mount
    // so consumers get a deterministic snapshot to mirror into their state.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'Linen shirt',
        category: 'top',
      }),
    );
  });

  it('emits an updated snapshot when the title input changes', () => {
    const { onChange, getByDisplayValue } = renderForm();

    const input = getByDisplayValue('Linen shirt');
    act(() => {
      fireEvent.changeText(input, 'Navy blazer');
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Navy blazer' }),
    );
  });
});

describe('validateGarmentForm', () => {
  it('returns isValid=true for a complete picker snapshot', () => {
    const result = validateGarmentForm(baseInitial);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('surfaces a validation error when the title is blank', () => {
    const result = validateGarmentForm({ ...baseInitial, title: '   ' });
    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBeDefined();
  });

  it('surfaces a validation error when the category is missing', () => {
    const result = validateGarmentForm({ ...baseInitial, category: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.category).toBeDefined();
  });

  it('reports both errors when title and category are missing', () => {
    const result = validateGarmentForm({ ...baseInitial, title: '', category: '' });
    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['category', 'title']);
  });
});

describe('AddPieceStep3Form — validation surface', () => {
  it('renders inline error copy when showValidation=true and the title is blank', () => {
    const { queryByText } = render(
      <ThemeProvider>
        <AddPieceStep3Form
          initial={{ ...baseInitial, title: '' }}
          onChange={() => {}}
          showValidation
        />
      </ThemeProvider>,
    );
    expect(queryByText('Title is required')).toBeTruthy();
  });

  it('hides validation copy when showValidation defaults to false', () => {
    const { queryByText } = render(
      <ThemeProvider>
        <AddPieceStep3Form
          initial={{ ...baseInitial, title: '' }}
          onChange={() => {}}
        />
      </ThemeProvider>,
    );
    expect(queryByText('Title is required')).toBeNull();
  });
});

// Compile-time guard: the type contract must remain consumable by callers
// that mix and match optional pickers. Renders inside <Text> to keep this
// inert at runtime.
function _typeContract() {
  const state: GarmentFormState = baseInitial;
  return <Text>{state.title}</Text>;
}
