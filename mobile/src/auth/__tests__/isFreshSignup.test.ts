import type { User } from '@supabase/supabase-js';

import { isFreshSignup } from '../hydrateAuthFromStorage';

function makeUser(createdAt: string | undefined): User {
  return { id: 'u-1', created_at: createdAt } as unknown as User;
}

describe('isFreshSignup', () => {
  it('returns false for null/missing created_at', () => {
    expect(isFreshSignup(null)).toBe(false);
    expect(isFreshSignup(makeUser(undefined))).toBe(false);
  });

  it('returns true within 60s window', () => {
    const now = Date.parse('2026-01-01T00:00:30Z');
    expect(isFreshSignup(makeUser('2026-01-01T00:00:00Z'), now)).toBe(true);
  });

  it('returns false past 60s window', () => {
    const now = Date.parse('2026-01-01T00:01:01Z');
    expect(isFreshSignup(makeUser('2026-01-01T00:00:00Z'), now)).toBe(false);
  });

  it('returns false on unparsable timestamp', () => {
    expect(isFreshSignup(makeUser('not-a-date'))).toBe(false);
  });
});
