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
  beforeEach(() => {
    localStorage.clear();
    clearQueue();
  });

  it('enqueues mutations to localStorage', () => {
    expect(getQueueLength()).toBe(0);
    enqueue({ table: 'garments', type: 'insert', payload: { title: 'Shirt' } });
    expect(getQueueLength()).toBe(1);
  });

  it('enqueues uploads', () => {
    enqueueUpload({ bucket: 'garments', path: 'test.jpg', base64: 'abc123', contentType: 'image/jpeg' });
    expect(getQueueLength()).toBe(1);
  });

  it('clears the queue', () => {
    enqueue({ table: 'garments', type: 'insert', payload: { title: 'Test' } });
    expect(getQueueLength()).toBe(1);
    clearQueue();
    expect(getQueueLength()).toBe(0);
  });

  it('replays mutations and returns success count', async () => {
    enqueue({ table: 'garments', type: 'insert', payload: { title: 'Shirt' } });
    enqueue({ table: 'garments', type: 'insert', payload: { title: 'Pants' } });
    const synced = await replayQueue();
    expect(synced).toBe(2);
    expect(getQueueLength()).toBe(0);
  });

  it('replays uploads', async () => {
    enqueueUpload({ bucket: 'garments', path: 'img.jpg', base64: btoa('data'), contentType: 'image/jpeg' });
    const synced = await replayQueue();
    expect(synced).toBe(1);
  });

  it('reports progress during replay', async () => {
    enqueue({ table: 'garments', type: 'insert', payload: { title: 'A' } });
    enqueue({ table: 'garments', type: 'insert', payload: { title: 'B' } });
    const progress: number[] = [];
    await replayQueue((completed) => progress.push(completed));
    expect(progress).toEqual([1, 2]);
  });
});
