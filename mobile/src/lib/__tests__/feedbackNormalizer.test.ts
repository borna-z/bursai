import {
  adaptFeedback,
  deriveSummary,
  isLikelySelfieDetectorMessage,
} from '../feedbackNormalizer';

describe('feedbackNormalizer', () => {
  describe('deriveSummary', () => {
    it('returns null for null / empty input', () => {
      expect(deriveSummary(null)).toBeNull();
      expect(deriveSummary('')).toBeNull();
      expect(deriveSummary('   ')).toBeNull();
    });
    it('returns the first sentence under cap', () => {
      expect(deriveSummary('Nice fit. Try a belt next time.')).toBe('Nice fit.');
    });
    it('caps a long single-sentence input at word boundary', () => {
      const long = 'a'.repeat(60) + ' bbbbbbbbbbbbbb cccccc';
      const out = deriveSummary(long);
      expect(out).not.toBeNull();
      expect((out ?? '').length).toBeLessThanOrEqual(80);
    });
  });

  describe('adaptFeedback — standard outfit feedback', () => {
    it('maps commentary + overall_score and derives summary', () => {
      const out = adaptFeedback({
        commentary: 'Great proportions. Add a contrasting shoe.',
        overall_score: 82,
      });
      expect(out.fit_notes).toBe('Great proportions. Add a contrasting shoe.');
      expect(out.overall_score).toBe(82);
      expect(out.summary).toBe('Great proportions.');
      expect(out.color_callouts).toEqual([]);
      expect(out.swap_suggestions).toEqual([]);
    });
    it('mines color_callouts + swap_suggestions from ai_raw', () => {
      const out = adaptFeedback({
        commentary: 'Sharp.',
        ai_raw: {
          color_callouts: ['too much beige', 42],
          swap_suggestions: [
            { reason: 'Switch shoes', garment_id: 'g1' },
            { reason: '' },
            null,
          ],
        },
      });
      expect(out.color_callouts).toEqual(['too much beige']);
      expect(out.swap_suggestions).toEqual([
        { reason: 'Switch shoes', garment_id: 'g1' },
      ]);
    });
  });

  describe('adaptFeedback — empty payload', () => {
    it('produces empty arrays and null score', () => {
      const out = adaptFeedback({});
      expect(out.fit_notes).toBe('');
      expect(out.overall_score).toBeNull();
      expect(out.summary).toBeNull();
      expect(out.color_callouts).toEqual([]);
      expect(out.swap_suggestions).toEqual([]);
    });
  });

  describe('isLikelySelfieDetectorMessage — heuristic', () => {
    it('matches positive tokens', () => {
      expect(isLikelySelfieDetectorMessage('No face detected in selfie')).toBe(true);
      expect(isLikelySelfieDetectorMessage('mirror_selfie_required')).toBe(true);
      expect(isLikelySelfieDetectorMessage('person not found')).toBe(true);
    });
    it('rejects unrelated errors', () => {
      expect(isLikelySelfieDetectorMessage(null)).toBe(false);
      expect(isLikelySelfieDetectorMessage('HTTP 503')).toBe(false);
      expect(isLikelySelfieDetectorMessage('rate limited')).toBe(false);
    });
  });
});
