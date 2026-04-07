import { describe, it, expect, vi } from 'vitest';
import {
  profileSchema,
  garmentSchema,
  outfitSchema,
  styleScoreSchema,
  weatherDataSchema,
  safeParse,
  profilePreferencesSchema,
} from '../schemas';

describe('schemas', () => {
  describe('profileSchema', () => {
    it('validates a valid profile', () => {
      const result = profileSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        display_name: 'Test',
        preferences: { onboarding: { completed: true } },
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid uuid', () => {
      const result = profileSchema.safeParse({ id: 'not-uuid', display_name: 'Test' });
      expect(result.success).toBe(false);
    });
  });

  describe('garmentSchema', () => {
    it('validates a valid garment', () => {
      const result = garmentSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Blue Shirt',
        category: 'top',
        image_path: '/images/shirt.jpg',
        color_primary: 'blue',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing required fields', () => {
      const result = garmentSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' });
      expect(result.success).toBe(false);
    });
  });

  describe('styleScoreSchema', () => {
    it('validates score within range', () => {
      const result = styleScoreSchema.safeParse({ overall: 85, color_harmony: 90 });
      expect(result.success).toBe(true);
    });

    it('rejects out of range values', () => {
      const result = styleScoreSchema.safeParse({ overall: 150 });
      expect(result.success).toBe(false);
    });
  });

  describe('weatherDataSchema', () => {
    it('validates weather data', () => {
      const result = weatherDataSchema.safeParse({ temp: 20, condition: 'sunny' });
      expect(result.success).toBe(true);
    });

    it('allows extra keys via passthrough', () => {
      const result = weatherDataSchema.safeParse({ temp: 15, extra_field: 'ok' });
      expect(result.success).toBe(true);
    });
  });

  describe('safeParse', () => {
    it('returns parsed data on success', () => {
      const result = safeParse(styleScoreSchema, { overall: 50 }, 'test');
      expect(result.overall).toBe(50);
    });

    it('returns original data on failure with warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const badData = { overall: 200 };
      const result = safeParse(styleScoreSchema, badData, 'test');
      expect(result).toBe(badData);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('profilePreferencesSchema', () => {
    it('allows passthrough of unknown keys', () => {
      const result = profilePreferencesSchema.safeParse({
        onboarding: { completed: true },
        future_key: 'value',
      });
      expect(result.success).toBe(true);
    });

    it('preserves onboarding coach progress fields', () => {
      const result = profilePreferencesSchema.safeParse({
        onboarding: {
          completed: true,
          toured: false,
          tour_step: 2,
          future_onboarding_key: 'kept',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data?.onboarding?.toured).toBe(false);
      expect(result.data?.onboarding?.tour_step).toBe(2);
      expect(result.data?.onboarding?.future_onboarding_key).toBe('kept');
    });
  });
});
