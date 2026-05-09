// In-memory @supabase/supabase-js mock — N4 boundary mock.
//
// Tests import the real `mobile/src/lib/supabase.ts` (which imports
// `createClient` from this module). Each test resets the per-table store
// and any per-call overrides via the helpers below; the default behaviour
// returns empty rows / no errors so a smoke test that doesn't care about
// the database layer doesn't have to wire it up.

type Row = Record<string, unknown>;

type QueryFilter = { column: string; value: unknown };

interface TableState {
  rows: Row[];
}

const stores = new Map<string, TableState>();

function table(name: string): TableState {
  let s = stores.get(name);
  if (!s) {
    s = { rows: [] };
    stores.set(name, s);
  }
  return s;
}

function matchesFilters(row: Row, filters: QueryFilter[]): boolean {
  return filters.every((f) => row[f.column] === f.value);
}

// Builder returned from supabase.from(...). Methods are chainable; the
// terminal awaitable (`maybeSingle()`, `single()`, `select()` chained
// terminator, `insert().select().single()`) returns a Promise via
// `.then`.
function makeBuilder(tableName: string) {
  let action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let inserted: Row[] = [];
  const filters: QueryFilter[] = [];
  let mode: 'single' | 'maybeSingle' | 'list' = 'list';

  const builder: any = {
    select: jest.fn(function select(_cols?: string) {
      // No-op for column selection — the in-memory store doesn't project.
      return builder;
    }),
    insert: jest.fn(function insert(rows: Row | Row[]) {
      action = 'insert';
      inserted = Array.isArray(rows) ? rows : [rows];
      return builder;
    }),
    update: jest.fn(function update(patch: Row) {
      action = 'update';
      inserted = [patch];
      return builder;
    }),
    delete: jest.fn(function del() {
      action = 'delete';
      return builder;
    }),
    eq: jest.fn(function eq(col: string, val: unknown) {
      filters.push({ column: col, value: val });
      return builder;
    }),
    order: jest.fn(function order() {
      return builder;
    }),
    limit: jest.fn(function limit() {
      return builder;
    }),
    single: jest.fn(function single() {
      mode = 'single';
      return builder;
    }),
    maybeSingle: jest.fn(function maybeSingle() {
      mode = 'maybeSingle';
      return builder;
    }),
    then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve(execute()).then(resolve);
    },
  };

  function execute(): { data: unknown; error: unknown } {
    const t = table(tableName);
    if (action === 'insert') {
      // Generate a synthetic id when missing so .select().single() round-
      // trips look sane.
      const enriched = inserted.map((r) => ({ id: `mock-${Math.random().toString(36).slice(2, 9)}`, ...r }));
      t.rows.push(...enriched);
      if (mode === 'single') return { data: enriched[0] ?? null, error: null };
      return { data: enriched, error: null };
    }
    if (action === 'delete') {
      t.rows = t.rows.filter((r) => !matchesFilters(r, filters));
      return { data: null, error: null };
    }
    if (action === 'update') {
      const patch = inserted[0] ?? {};
      t.rows = t.rows.map((r) =>
        matchesFilters(r, filters) ? { ...r, ...patch } : r,
      );
      return { data: null, error: null };
    }
    // select
    const matched = t.rows.filter((r) => matchesFilters(r, filters));
    if (mode === 'single') return { data: matched[0] ?? null, error: null };
    if (mode === 'maybeSingle') return { data: matched[0] ?? null, error: null };
    return { data: matched, error: null };
  }

  return builder;
}

// Storage layer — returns a stable signed URL the cache tests can
// assert against. The url includes the path so different paths produce
// distinguishable URLs.
function makeStorageBucket() {
  return {
    createSignedUrl: jest.fn(async (path: string, _expiresIn: number) => ({
      data: { signedUrl: `https://signed.example/${path}?token=t` },
      error: null,
    })),
    createSignedUrls: jest.fn(async (paths: string[], _expiresIn: number) => ({
      data: paths.map((p) => ({ path: p, signedUrl: `https://signed.example/${p}?token=t` })),
      error: null,
    })),
  };
}

const authMock = {
  getSession: jest.fn(async () => ({
    data: { session: { access_token: 'mock-access', user: { id: 'user-1' } } },
    error: null,
  })),
  signOut: jest.fn(async () => ({ error: null })),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
};

export function createClient(_url: string, _key: string, _options?: unknown) {
  return {
    from: jest.fn(makeBuilder),
    auth: authMock,
    storage: { from: jest.fn(makeStorageBucket) },
  };
}

// ─── Test helpers ─────────────────────────────────────────────────────
// Tests import these via `jest.requireMock('@supabase/supabase-js')` to
// seed rows, override behaviour, or reset between cases.

export function __resetSupabaseMock(): void {
  stores.clear();
  authMock.getSession.mockClear();
  authMock.getSession.mockResolvedValue({
    data: { session: { access_token: 'mock-access', user: { id: 'user-1' } } },
    error: null,
  });
}

export function __seedTable(name: string, rows: Row[]): void {
  table(name).rows = [...rows];
}

export function __getTable(name: string): Row[] {
  return [...table(name).rows];
}
