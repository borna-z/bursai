// useStyleChat.helpers — N7 split unit coverage.
//
// Sanity checks the pure helpers that moved out of useStyleChat:
// persistedModeFor (mode → DB column mapping), parseStoredMessage
// (legacy + envelope rows), mergeShoppingResults / finalizeEnvelopeForMode
// (M23 envelope synthesis).

import {
  finalizeEnvelopeForMode,
  mergeShoppingResults,
  parseStoredMessage,
  persistedModeFor,
} from '../useStyleChat.helpers';

describe('useStyleChat.helpers', () => {
  describe('persistedModeFor', () => {
    it('maps style → "stylist" and shopping → "shopping"', () => {
      expect(persistedModeFor('style')).toBe('stylist');
      expect(persistedModeFor('shopping')).toBe('shopping');
    });
  });

  describe('parseStoredMessage', () => {
    it('parses a legacy plain-text row as raw bubble text', () => {
      const row = {
        role: 'user' as const,
        content: 'plain hello',
        created_at: '2026-05-09T00:00:00.000Z',
      };
      const out = parseStoredMessage(row, 0);
      expect(out.content).toBe('plain hello');
      expect(out.role).toBe('user');
      expect(out.stylistMeta).toBeUndefined();
    });

    it('parses a stylist envelope row and extracts the assistant text', () => {
      const envelope = {
        kind: 'stylist_message',
        content: 'rendered text',
        stylistMeta: null,
      };
      const row = {
        role: 'assistant' as const,
        content: JSON.stringify(envelope),
        created_at: '2026-05-09T00:00:00.000Z',
      };
      const out = parseStoredMessage(row, 1);
      expect(out.content).toBe('rendered text');
      expect(out.stylistMeta).toBeNull();
    });
  });

  describe('mergeShoppingResults', () => {
    it('returns null when envelope is null', () => {
      expect(mergeShoppingResults(null, null)).toBeNull();
    });

    it('returns the envelope unchanged when results array is empty', () => {
      const env = { kind: 'stylist_response' } as unknown as Parameters<typeof mergeShoppingResults>[0];
      expect(mergeShoppingResults(env, [])).toBe(env);
    });
  });

  describe('finalizeEnvelopeForMode', () => {
    it('returns null in style mode when no envelope arrived', () => {
      expect(finalizeEnvelopeForMode('style', null, 'fallback', null)).toBeNull();
    });

    it('synthesizes a SHOPPING envelope when shopping mode + no server envelope', () => {
      const out = finalizeEnvelopeForMode('shopping', null, 'final text', null);
      expect(out?.mode).toBe('SHOPPING');
      expect(out?.assistant_text).toBe('final text');
    });
  });
});
