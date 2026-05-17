// Phase 5e — vitest specs for the extracted `render_garment_image`
// lifecycle helpers. Tests use a thin mock supabase client (no network,
// no real client surface) so contention + idempotency + error-log
// behaviour can be exercised in CI.
//
// Tests are vitest, not Deno (per `supabase/functions/CLAUDE.md` — the
// root vitest runner picks up `supabase/functions/**/*.test.ts`).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  claimGarmentRender,
  safeMarkRenderFailed,
  safeRestoreOrFailRender,
  updateGarmentRenderState,
} from '../render-garment-state';

// --- Mock supabase chain ---------------------------------------------------
// Each test seeds the responses for the chain methods the helper invokes:
//   .from('garments').update(...).eq(...)                                → updateGarmentRenderState
//   .from('garments').update(...).eq(...).in(...).select(...).maybeSingle() → claimGarmentRender
//   .from('garments').update(...).eq(...)                                → safeMarkRenderFailed
//   .from('garments').update(...).eq(...)                                → safeRestoreOrFailRender

type Response = { data?: unknown; error?: { message: string } | null };

function makeClient(responses: {
  update?: Response;
  maybeSingle?: Response;
  updateError?: unknown; // override: make .update() throw
}) {
  const updateCalls: Record<string, unknown>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.update = vi.fn((patch: Record<string, unknown>) => {
    updateCalls.push(patch);
    if (responses.updateError) {
      throw responses.updateError;
    }
    return chain;
  });
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => responses.maybeSingle ?? { data: null, error: null });
  // The unconditional update path awaits the eq() chain directly.
  chain.then = (resolve: (v: Response) => unknown) =>
    Promise.resolve(responses.update ?? { error: null }).then(resolve);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = { from: vi.fn(() => chain) };
  return { client, updateCalls, chain };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('updateGarmentRenderState', () => {
  it('resolves silently on a successful update', async () => {
    const { client, updateCalls } = makeClient({ update: { error: null } });
    await expect(
      updateGarmentRenderState(client, 'g1', { render_status: 'ready' }, 'ctx'),
    ).resolves.toBeUndefined();
    expect(updateCalls).toEqual([{ render_status: 'ready' }]);
  });

  it('throws with the context prefix when the update errors', async () => {
    const { client } = makeClient({ update: { error: { message: 'fk_violation' } } });
    await expect(
      updateGarmentRenderState(client, 'g1', { render_status: 'ready' }, 'finalize'),
    ).rejects.toThrow('finalize: fk_violation');
  });
});

describe('claimGarmentRender', () => {
  it('returns true when the atomic claim matched a row', async () => {
    const { client, chain } = makeClient({
      maybeSingle: { data: { id: 'g1' }, error: null },
    });
    const ok = await claimGarmentRender(client, 'g1', 'feminine');
    expect(ok).toBe(true);
    // Allowed-status filter is the non-force list.
    expect(chain.in).toHaveBeenCalledWith('render_status', ['pending', 'failed', 'none']);
  });

  it('returns false when another invocation already won the race', async () => {
    // The atomic UPDATE filtered out by `in('render_status', ...)` → no row
    // matched → `maybeSingle()` resolves with `{ data: null }`. The helper's
    // boolean contract is what the orchestrator uses as the if-claimed gate.
    const { client } = makeClient({ maybeSingle: { data: null, error: null } });
    const ok = await claimGarmentRender(client, 'g1', 'feminine');
    expect(ok).toBe(false);
  });

  it('expands the allowed-status set when `force` is true', async () => {
    const { client, chain } = makeClient({
      maybeSingle: { data: { id: 'g1' }, error: null },
    });
    await claimGarmentRender(client, 'g1', 'masculine', true);
    expect(chain.in).toHaveBeenCalledWith(
      'render_status',
      ['pending', 'failed', 'none', 'skipped', 'ready'],
    );
  });

  it('throws on a DB error from the atomic UPDATE', async () => {
    const { client } = makeClient({
      maybeSingle: { data: null, error: { message: 'deadlock_detected' } },
    });
    await expect(claimGarmentRender(client, 'g1', 'feminine')).rejects.toMatchObject({
      message: 'deadlock_detected',
    });
  });
});

describe('safeMarkRenderFailed', () => {
  it('writes render_status="failed" on the normal path and does NOT log', async () => {
    const { client, updateCalls } = makeClient({ update: { error: null } });
    const consoleError = console.error as ReturnType<typeof vi.fn>;
    await safeMarkRenderFailed(client, 'g1', { render_error: 'oops' }, 'ctx');
    expect(updateCalls[0]).toMatchObject({
      render_status: 'failed',
      render_provider: 'gemini',
      render_error: 'oops',
    });
    // Normal-path success produces NO log entry — terminal "failed" is the
    // expected state for several legitimate code paths.
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('logs console.error when the failure-state UPDATE returns an error', async () => {
    const { client } = makeClient({ update: { error: { message: 'write_blocked' } } });
    const consoleError = console.error as ReturnType<typeof vi.fn>;
    await safeMarkRenderFailed(client, 'g1', { render_error: 'oops' }, 'finalize');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      'render_garment_image failed to persist failure state',
      expect.objectContaining({
        garmentId: 'g1',
        context: 'finalize',
        updateError: 'write_blocked',
        attemptedRenderError: 'oops',
      }),
    );
  });

  it('logs console.error when the .update() chain itself throws', async () => {
    const { client } = makeClient({ updateError: new Error('connection_reset') });
    const consoleError = console.error as ReturnType<typeof vi.fn>;
    await safeMarkRenderFailed(client, 'g1', { render_error: 'oops' }, 'finalize');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      'render_garment_image failure-state update crashed',
      expect.objectContaining({
        garmentId: 'g1',
        context: 'finalize',
        updateError: 'connection_reset',
      }),
    );
  });
});

describe('safeRestoreOrFailRender', () => {
  it('restores the prior rendered image on a force failure with a prior path', async () => {
    const { client, updateCalls } = makeClient({ update: { error: null } });
    await safeRestoreOrFailRender(
      client,
      'g1',
      { render_error: 'force_failed' },
      'force-restore',
      'users/u1/prior.jpg',
      true,
    );
    expect(updateCalls[0]).toMatchObject({
      render_status: 'ready',
      render_provider: 'gemini',
      rendered_image_path: 'users/u1/prior.jpg',
      image_path: 'users/u1/prior.jpg',
      render_error: null,
    });
  });

  it('falls back to safeMarkRenderFailed when no prior path exists', async () => {
    // Non-force OR force-with-null-prior → terminal failure write, NOT
    // restore. Test the force-with-null path explicitly.
    const { client, updateCalls } = makeClient({ update: { error: null } });
    await safeRestoreOrFailRender(
      client,
      'g1',
      { render_error: 'no_prior' },
      'fail-no-prior',
      null,
      true,
    );
    expect(updateCalls[0]).toMatchObject({
      render_status: 'failed',
      render_provider: 'gemini',
      render_error: 'no_prior',
    });
  });

  it('converges to the same row state when called twice in a row (idempotent)', async () => {
    // Calls 1 & 2 both write `render_status: 'ready'` with the same prior
    // path. The DB ends in the same state either way — restore is
    // idempotent by design (no row diff between successive calls).
    const { client, updateCalls } = makeClient({ update: { error: null } });
    await safeRestoreOrFailRender(client, 'g1', { render_error: 'x' }, 'a', 'p.jpg', true);
    await safeRestoreOrFailRender(client, 'g1', { render_error: 'x' }, 'a', 'p.jpg', true);
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0]).toEqual(updateCalls[1]);
  });

  it('logs on the restore branch when the .update() returns an error', async () => {
    const { client } = makeClient({ update: { error: { message: 'restore_blocked' } } });
    const consoleError = console.error as ReturnType<typeof vi.fn>;
    await safeRestoreOrFailRender(
      client,
      'g1',
      { render_error: 'x' },
      'force-restore',
      'p.jpg',
      true,
    );
    expect(consoleError).toHaveBeenCalledWith(
      'render_garment_image failed to restore prior render',
      // Includes `context` so a future refactor that drops it from the
      // log payload doesn't slip past CI silently.
      expect.objectContaining({
        garmentId: 'g1',
        context: 'force-restore',
        updateError: 'restore_blocked',
      }),
    );
  });

  it('logs on the restore branch when the .update() chain throws', async () => {
    // The outer try/catch in safeRestoreOrFailRender's restore branch
    // emits a DISTINCT log key ('prior-render restore crashed') vs the
    // inner '.update().error' path. Both are reachable in production
    // (the throw path covers transient connection failures during a
    // force re-render). Pin the key so observability tooling that
    // alerts on it doesn't regress.
    const { client } = makeClient({ updateError: new Error('connection_reset') });
    const consoleError = console.error as ReturnType<typeof vi.fn>;
    await safeRestoreOrFailRender(
      client,
      'g1',
      { render_error: 'x' },
      'force-restore',
      'p.jpg',
      true,
    );
    expect(consoleError).toHaveBeenCalledWith(
      'render_garment_image prior-render restore crashed',
      expect.objectContaining({
        garmentId: 'g1',
        context: 'force-restore',
        restoreError: 'connection_reset',
      }),
    );
  });
});
