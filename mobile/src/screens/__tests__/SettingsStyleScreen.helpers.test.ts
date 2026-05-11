// SettingsStyleScreen.helpers — N13 split unit coverage.
//
// Sanity checks the two pure helpers extracted from SettingsStyleScreen:
// the "Updated Nh ago" bucket formatter and the profile-preferences reader.

import {
  formatUpdatedAgo,
  readCurrentV4FromProfile,
} from '../SettingsStyleScreen.helpers';
import { defaultStyleProfileV4 } from '../../lib/styleProfileV4';

describe('SettingsStyleScreen.helpers', () => {
  describe('formatUpdatedAgo', () => {
    it('returns null for missing or unparseable timestamps', () => {
      expect(formatUpdatedAgo(null)).toBeNull();
      expect(formatUpdatedAgo('not-a-date')).toBeNull();
    });

    it('returns "Updated just now" for under 60s', () => {
      const recent = new Date(Date.now() - 30_000).toISOString();
      expect(formatUpdatedAgo(recent)).toBe('Updated just now');
    });

    it('buckets in minutes < 60', () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000).toISOString();
      expect(formatUpdatedAgo(fifteenMinutesAgo)).toBe('Updated 15 min ago');
    });

    it('buckets in hours < 24', () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60_000).toISOString();
      expect(formatUpdatedAgo(sixHoursAgo)).toBe('Updated 6h ago');
    });

    it('buckets in days otherwise', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
      expect(formatUpdatedAgo(threeDaysAgo)).toBe('Updated 3d ago');
    });
  });

  describe('readCurrentV4FromProfile', () => {
    it('returns defaults when prefs is missing or not an object', () => {
      expect(readCurrentV4FromProfile(null)).toEqual(defaultStyleProfileV4());
      expect(readCurrentV4FromProfile(undefined)).toEqual(defaultStyleProfileV4());
      expect(readCurrentV4FromProfile('not-an-object')).toEqual(defaultStyleProfileV4());
    });

    it('returns defaults when neither style_profile_v4_jsonb nor style_profile_v4 is present', () => {
      expect(readCurrentV4FromProfile({})).toEqual(defaultStyleProfileV4());
      expect(readCurrentV4FromProfile({ other_field: true })).toEqual(defaultStyleProfileV4());
    });

    it('parses style_profile_v4_jsonb when present', () => {
      const seeded = { ...defaultStyleProfileV4(), formalityFloor: 30, formalityCeiling: 80 };
      const out = readCurrentV4FromProfile({ style_profile_v4_jsonb: seeded });
      expect(out.formalityFloor).toBe(30);
      expect(out.formalityCeiling).toBe(80);
    });

    it('falls back to style_profile_v4 (without _jsonb) when only that key exists', () => {
      const seeded = { ...defaultStyleProfileV4(), formalityFloor: 25 };
      const out = readCurrentV4FromProfile({ style_profile_v4: seeded });
      expect(out.formalityFloor).toBe(25);
    });
  });
});
