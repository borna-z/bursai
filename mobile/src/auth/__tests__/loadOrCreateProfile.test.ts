// Phase 1 audit coverage gap: `loadOrCreateProfile`'s 23503 (ghost session)
// and 23505 (insert race) branches were untested. These tests pin the
// branch behaviour so a future refactor of `hydrateAuthFromStorage.ts`
// can't silently regress the recovery paths.

/* eslint-disable import/first -- jest.mock() must be declared before
 * the production module imports `supabase`, so this file deliberately
 * mixes jest.mock() and imports out of the typical order. */

import type { User } from '@supabase/supabase-js';

// jest.mock factory variables MUST be prefixed `mock*` or be reset
// per-test via `jest.fn()`. We use jest.fn()s declared via the factory
// itself; the test reaches back into the mock with `jest.requireMock`.

jest.mock('../../lib/supabase', () => {
  const fromImpl = jest.fn();
  const signOutImpl = jest.fn(async () => ({ error: null }));
  return {
    __esModule: true,
    supabase: {
      from: fromImpl,
      auth: { signOut: signOutImpl },
    },
  };
});

import { loadOrCreateProfile } from '../hydrateAuthFromStorage';

type ChainResponse = { data: unknown; error: unknown };

const supabaseMock = jest.requireMock('../../lib/supabase').supabase as any;

/** Wires `supabaseMock.from` to return a FRESH builder per call. All
 * builders within a single test share `selects` (drained in order across
 * `from(...).select(...).maybeSingle()` invocations) and `insertResponse`
 * (consumed when the chain went through `.insert()`). Per-call freshness
 * resets the `mode` flag — without that, `loadOrCreateProfile`'s 23505
 * recovery flow (insert → 23505 → re-select winner) would leak the
 * insert-mode state into the recovery `selectProfile` call. */
function setupSupabaseChain(opts: {
  selects?: ChainResponse[];
  insertResponse?: ChainResponse;
}): void {
  const selects = [...(opts.selects ?? [])];
  supabaseMock.from.mockImplementation(() => {
    let mode: 'select' | 'insert' = 'select';
    const builder: any = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.insert = jest.fn(() => {
      mode = 'insert';
      return builder;
    });
    builder.maybeSingle = jest.fn(async () =>
      selects.shift() ?? { data: null, error: null },
    );
    builder.single = jest.fn(async () => {
      if (mode === 'insert') {
        return opts.insertResponse ?? { data: null, error: null };
      }
      return selects.shift() ?? { data: null, error: null };
    });
    return builder;
  });
}

function makeUser(id = 'user-1'): User {
  return { id, email: 'tester@example.com', user_metadata: {} } as unknown as User;
}

beforeEach(() => {
  supabaseMock.from.mockReset();
  supabaseMock.auth.signOut.mockClear();
});

describe('loadOrCreateProfile', () => {
  it('returns the existing profile without attempting an insert', async () => {
    setupSupabaseChain({
      selects: [{ data: { id: 'user-1', display_name: 'Test' }, error: null }],
    });
    const profile = await loadOrCreateProfile(makeUser());
    expect(profile).toEqual({ id: 'user-1', display_name: 'Test' });
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
    // Locks in single-call behaviour — pre-refactor this was asserted via
    // `builder.insert.not.toHaveBeenCalled()`, lost when `setupSupabaseChain`
    // moved to per-call fresh builders.
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it('inserts and returns a new profile when none exists', async () => {
    setupSupabaseChain({
      selects: [{ data: null, error: null }],
      insertResponse: { data: { id: 'user-1', display_name: 'tester' }, error: null },
    });
    const profile = await loadOrCreateProfile(makeUser());
    expect(profile).toEqual({ id: 'user-1', display_name: 'tester' });
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
  });

  it('signs the user out when insert hits 23503 (ghost session)', async () => {
    // FK violation: the auth.users row referenced by profile.id is gone —
    // a stale session against a deleted user. The recovery path must
    // signOut so the app drops back to the unauthenticated state cleanly.
    setupSupabaseChain({
      selects: [{ data: null, error: null }],
      insertResponse: {
        data: null,
        error: { code: '23503', message: 'foreign_key_violation' },
      },
    });
    const profile = await loadOrCreateProfile(makeUser());
    expect(profile).toBeNull();
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('re-selects the winning row when insert hits 23505 (race)', async () => {
    // Unique violation: a concurrent insert just landed (e.g. a refresh
    // racing with auth provider mount). The recovery path must NOT signOut
    // — it re-selects so we read whichever row won the race.
    setupSupabaseChain({
      selects: [
        { data: null, error: null }, // initial select empty
        { data: { id: 'user-1', display_name: 'racer' }, error: null }, // re-select after race
      ],
      insertResponse: {
        data: null,
        error: { code: '23505', message: 'unique_violation' },
      },
    });
    const profile = await loadOrCreateProfile(makeUser());
    expect(profile).toEqual({ id: 'user-1', display_name: 'racer' });
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
  });

  it('returns null on an unknown insert error without signing the user out', async () => {
    setupSupabaseChain({
      selects: [{ data: null, error: null }],
      insertResponse: {
        data: null,
        error: { code: 'P0001', message: 'rls_block' },
      },
    });
    const profile = await loadOrCreateProfile(makeUser());
    expect(profile).toBeNull();
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
  });
});
