import { describe, expect, it } from 'vitest';
import {
  mannequinPresentationFromStyleProfileGender,
  normalizeMannequinPresentation,
} from '@/lib/mannequinPresentation';

describe('mannequinPresentation', () => {
  it('maps explicit male and female style profile values directly', () => {
    expect(mannequinPresentationFromStyleProfileGender('male')).toBe('male');
    expect(mannequinPresentationFromStyleProfileGender('female')).toBe('female');
  });

  it('maps unset or non-binary style profile values to mixed', () => {
    expect(mannequinPresentationFromStyleProfileGender(undefined)).toBe('mixed');
    expect(mannequinPresentationFromStyleProfileGender(null)).toBe('mixed');
    expect(mannequinPresentationFromStyleProfileGender('prefer_not')).toBe('mixed');
    expect(mannequinPresentationFromStyleProfileGender('nonbinary')).toBe('mixed');
  });

  it('normalizes invalid persisted values back to mixed', () => {
    expect(normalizeMannequinPresentation('mixed')).toBe('mixed');
    expect(normalizeMannequinPresentation('other')).toBe('mixed');
  });
});
