import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ match: vi.fn().mockResolvedValue({ error: null }) }),
      delete: vi.fn().mockReturnValue({ match: vi.fn().mockResolvedValue({ error: null }) }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { enqueue, enqueueUpload, getQueueLength, replayQueue, clearQueue } from '../offlineQueue';

describe('offlineQueue', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearQueue();
  });

  it('enqueues mutations to the queue', async () => {
    expect(getQueueLength()).toBe(0);
    await enqueue({ table: 'garments', type: 'insert', payload: { title: 'Shirt' } });
    expect(getQueueLength()).toBe(1);
  });

  it('enqueues uploads', async () => {
    await enqueueUpload({ bucket: 'garments', path: 'test.jpg', base64: btoa('abc123'), contentType: 'image/jpeg' });
    expect(getQueueLength()).toBe(1);
  });

  it('clears the queue', async () => {
    await enqueue({ table: 'garments', type: 'insert', payload: { title: 'Test' } });
    expect(getQueueLength()).toBe(1);
    await clearQueue();
    expect(getQueueLength()).toBe(0);
  });

  it('replays mutations and returns success count', async () => {
    await enqueue({ table: 'garments', type: 'insert', payload: { title: 'Shirt' } });
    await enqueue({ table: 'garments', type: 'insert', payload: { title: 'Pants' } });
    const synced = await replayQueue();
    expect(synced).toBe(2);
    expect(getQueueLength()).toBe(0);
  });

  it('replays uploads', async () => {
    await enqueueUpload({ bucket: 'garments', path: 'img.jpg', base64: btoa('data'), contentType: 'image/jpeg' });
    const synced = await replayQueue();
    expect(synced).toBe(1);
  });

  it('reports progress during replay', async () => {
    await enqueue({ table: 'garments', type: 'insert', payload: { title: 'A' } });
    await enqueue({ table: 'garments', type: 'insert', payload: { title: 'B' } });
    const progress: number[] = [];
    await replayQueue((completed) => progress.push(completed));
    expect(progress).toEqual([1, 2]);
  });
});
