// OutfitDetailScreen.helpers — N13 split unit coverage.

import {
  ANCHOR_STORAGE_PREFIX,
  anchorStorageKey,
} from '../OutfitDetailScreen.helpers';

describe('OutfitDetailScreen.helpers', () => {
  describe('anchorStorageKey', () => {
    it('namespaces by user id and outfit id', () => {
      expect(anchorStorageKey('user-123', 'outfit-abc')).toBe(
        `${ANCHOR_STORAGE_PREFIX}user-123:outfit-abc`,
      );
    });

    it('produces distinct keys for different outfits under the same user', () => {
      const a = anchorStorageKey('u1', 'o1');
      const b = anchorStorageKey('u1', 'o2');
      expect(a).not.toBe(b);
    });

    it('produces distinct keys for different users on the same outfit', () => {
      expect(anchorStorageKey('u1', 'shared')).not.toBe(
        anchorStorageKey('u2', 'shared'),
      );
    });
  });
});
