// StyleChatScreen.helpers — N13 split unit coverage.
//
// Sanity checks the pure helpers extracted from StyleChatScreen.

import { messageKey, modeLabel, STATIC_SUGGESTIONS } from '../StyleChatScreen.helpers';
import type { ChatMessage } from '../../hooks/useStyleChat';

describe('StyleChatScreen.helpers', () => {
  describe('STATIC_SUGGESTIONS', () => {
    it('exposes the 4 default suggestion chips', () => {
      expect(STATIC_SUGGESTIONS).toHaveLength(4);
      STATIC_SUGGESTIONS.forEach((s) => expect(typeof s).toBe('string'));
    });
  });

  describe('messageKey', () => {
    it('returns the message id', () => {
      const msg = { id: 'abc-123', role: 'user', content: 'hi' } as ChatMessage;
      expect(messageKey(msg)).toBe('abc-123');
    });
  });

  describe('modeLabel', () => {
    it('returns null when mode is missing', () => {
      expect(modeLabel(undefined)).toBeNull();
      expect(modeLabel(null)).toBeNull();
    });

    it('returns a non-empty string for a known mode', () => {
      const out = modeLabel('SHOPPING');
      expect(typeof out).toBe('string');
      expect(out!.length).toBeGreaterThan(0);
    });
  });
});
