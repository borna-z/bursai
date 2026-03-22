export type MannequinPresentation = 'male' | 'female' | 'mixed';

export function normalizeMannequinPresentation(value: unknown): MannequinPresentation {
  if (value === 'male' || value === 'female' || value === 'mixed') {
    return value;
  }

  return 'mixed';
}

export function mannequinPresentationInstruction(value: MannequinPresentation): string {
  switch (value) {
    case 'male':
      return 'Use a male shadow mannequin presentation for the garment render.';
    case 'female':
      return 'Use a female shadow mannequin presentation for the garment render.';
    case 'mixed':
    default:
      return 'Use a mixed shadow mannequin presentation for the garment render.';
  }
}
