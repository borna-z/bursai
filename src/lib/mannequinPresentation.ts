export type MannequinPresentation = 'male' | 'female' | 'mixed';

export function normalizeMannequinPresentation(value: unknown): MannequinPresentation {
  if (value === 'male' || value === 'female' || value === 'mixed') {
    return value;
  }

  return 'mixed';
}

export function mannequinPresentationFromStyleProfileGender(value: unknown): MannequinPresentation {
  if (value === 'male') return 'male';
  if (value === 'female') return 'female';
  return 'mixed';
}
