import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { RevealStep } from '@/components/onboarding/RevealStep';

function humanizedLastSegment(key: string): string {
  const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  const humanized = segment.replace(/[_-]/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => humanizedLastSegment(key),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));

// Stub LazyImage so jsdom renders the path without trying to set src on a
// real <img> (matches the pattern used by other onboarding test files).
vi.mock('@/components/ui/lazy-image', () => ({
  LazyImage: ({ src, alt }: { src?: string; alt?: string }) => (
    <img data-testid="lazy-image" src={src ?? ''} alt={alt ?? ''} />
  ),
}));

// ──────────────────────────────────────────────────────────────────────────
// Supabase + enqueueRenderJob mocks. The component reads `render_jobs`
// (for watched IDs) and `garments` (for full image data), subscribes to
// realtime UPDATEs on `garments`, and fires `enqueueRenderJob(id, 'retry')`
// for any garment whose render_status is 'failed'.
// ──────────────────────────────────────────────────────────────────────────

interface RenderJobRow {
  garment_id: string;
  status: string;
}
interface GarmentRow {
  id: string;
  image_path: string | null;
  original_image_path: string | null;
  rendered_image_path: string | null;
  render_status: string | null;
}

const renderJobsResponseRef = vi.hoisted(() => ({
  current: { data: [] as RenderJobRow[], error: null as Error | null },
}));
const garmentsResponseRef = vi.hoisted(() => ({
  current: { data: [] as GarmentRow[], error: null as Error | null },
}));

const enqueueRenderJobMock = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
vi.mock('@/lib/garmentIntelligence', () => ({
  enqueueRenderJob: enqueueRenderJobMock,
}));

type ChannelCallback = (payload: { new?: GarmentRow }) => void;

interface MockChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  __callback?: ChannelCallback;
  __filterArgs?: { event: string; schema: string; table: string; filter: string };
}

const createdChannels: MockChannel[] = [];
const channelMock = vi.hoisted(() => vi.fn());
const removeChannelMock = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'render_jobs') {
        // Wave 7.9 — RevealStep adds `.in('status', [...])` between `.eq()`
        // and `.order()` (audit D.P1.3 status filter parity with CoachTour).
        // Builder includes `.in()` so the chain stays terminal at `.limit()`.
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          order: () => builder,
          limit: () => Promise.resolve(renderJobsResponseRef.current),
        };
        return builder;
      }
      if (table === 'garments') {
        const builder = {
          select: () => builder,
          in: () => Promise.resolve(garmentsResponseRef.current),
        };
        return builder;
      }
      throw new Error(`Unexpected supabase.from(${table}) in RevealStep test`);
    },
    channel: (...args: unknown[]) => channelMock(...args),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  },
}));

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  renderJobsResponseRef.current = {
    data: [
      { garment_id: 'g1', status: 'pending' },
      { garment_id: 'g2', status: 'pending' },
      { garment_id: 'g3', status: 'pending' },
    ],
    error: null,
  };
  garmentsResponseRef.current = {
    data: [
      {
        id: 'g1',
        image_path: 'orig/g1.jpg',
        original_image_path: 'orig/g1.jpg',
        rendered_image_path: null,
        render_status: 'pending',
      },
      {
        id: 'g2',
        image_path: 'orig/g2.jpg',
        original_image_path: 'orig/g2.jpg',
        rendered_image_path: null,
        render_status: 'pending',
      },
      {
        id: 'g3',
        image_path: 'orig/g3.jpg',
        original_image_path: 'orig/g3.jpg',
        rendered_image_path: null,
        render_status: 'pending',
      },
    ],
    error: null,
  };

  enqueueRenderJobMock.mockReset();
  enqueueRenderJobMock.mockResolvedValue({ ok: true });

  createdChannels.length = 0;
  channelMock.mockReset();
  channelMock.mockImplementation(() => {
    const ch: MockChannel = {
      on: vi.fn().mockImplementation((event, args, cb) => {
        ch.__filterArgs = args;
        ch.__callback = cb;
        return ch;
      }),
      subscribe: vi.fn().mockImplementation((cb) => {
        cb?.('SUBSCRIBED');
        return ch;
      }),
    };
    createdChannels.push(ch);
    return ch;
  });

  removeChannelMock.mockReset();
});

describe('RevealStep', () => {
  it('shows the cooking title + cooking subtitle when no render is ready yet', async () => {
    renderWithQueryClient(<RevealStep onComplete={vi.fn()} />);

    expect(
      await screen.findByText(/We're framing your first piece\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/usually takes a moment/i)).toBeInTheDocument();
    // Cooking shimmer overlay surfaces "Rendering…" status badge.
    expect(screen.getByText(/Rendering/)).toBeInTheDocument();
  });

  it('shows the celebratory title once a watched garment flips to ready via realtime', async () => {
    renderWithQueryClient(<RevealStep onComplete={vi.fn()} />);

    await waitFor(() => expect(createdChannels.length).toBeGreaterThan(0));
    const ch = createdChannels[0];

    // Initial state — cooking copy.
    expect(
      await screen.findByText(/We're framing your first piece\./i),
    ).toBeInTheDocument();

    // Realtime: g1 flips to ready with a rendered_image_path.
    act(() => {
      ch.__callback!({
        new: {
          id: 'g1',
          image_path: 'orig/g1.jpg',
          original_image_path: 'orig/g1.jpg',
          rendered_image_path: 'rendered/g1.jpg',
          render_status: 'ready',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Your studio shot is ready\./i)).toBeInTheDocument();
    });
  });

  it('subscribes on the user-scoped reveal channel with the correct filter', async () => {
    renderWithQueryClient(<RevealStep onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(channelMock).toHaveBeenCalledWith('reveal-u1');
      expect(createdChannels.length).toBeGreaterThan(0);
    });
    expect(createdChannels[0].__filterArgs).toEqual({
      event: 'UPDATE',
      schema: 'public',
      table: 'garments',
      filter: 'user_id=eq.u1',
    });
  });

  it('auto-retries failed renders ONCE per garment', async () => {
    // One of the watched garments is already 'failed' on first fetch.
    garmentsResponseRef.current = {
      data: [
        {
          id: 'g1',
          image_path: 'orig/g1.jpg',
          original_image_path: 'orig/g1.jpg',
          rendered_image_path: null,
          render_status: 'failed',
        },
        {
          id: 'g2',
          image_path: 'orig/g2.jpg',
          original_image_path: 'orig/g2.jpg',
          rendered_image_path: null,
          render_status: 'pending',
        },
        {
          id: 'g3',
          image_path: 'orig/g3.jpg',
          original_image_path: 'orig/g3.jpg',
          rendered_image_path: null,
          render_status: 'pending',
        },
      ],
      error: null,
    };

    renderWithQueryClient(<RevealStep onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(enqueueRenderJobMock).toHaveBeenCalledWith('g1', 'retry');
    });

    // A subsequent realtime update that re-flags g1 as 'failed' (e.g., the
    // retry itself failed) MUST NOT trigger a second retry — spec says
    // "auto-retry once".
    const ch = createdChannels[0];
    act(() => {
      ch.__callback!({
        new: {
          id: 'g1',
          image_path: 'orig/g1.jpg',
          original_image_path: 'orig/g1.jpg',
          rendered_image_path: null,
          render_status: 'failed',
        },
      });
    });

    // Give the auto-retry effect a microtask to fire (it shouldn't).
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(enqueueRenderJobMock).toHaveBeenCalledTimes(1);
  });

  it('does not auto-retry succeeded or pending garments', async () => {
    garmentsResponseRef.current = {
      data: [
        {
          id: 'g1',
          image_path: 'orig/g1.jpg',
          original_image_path: 'orig/g1.jpg',
          rendered_image_path: 'rendered/g1.jpg',
          render_status: 'ready',
        },
        {
          id: 'g2',
          image_path: 'orig/g2.jpg',
          original_image_path: 'orig/g2.jpg',
          rendered_image_path: null,
          render_status: 'pending',
        },
        {
          id: 'g3',
          image_path: 'orig/g3.jpg',
          original_image_path: 'orig/g3.jpg',
          rendered_image_path: null,
          render_status: 'rendering',
        },
      ],
      error: null,
    };

    renderWithQueryClient(<RevealStep onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Your studio shot is ready\./i)).toBeInTheDocument();
    });

    // No retry should fire — every garment is in a non-failed state.
    expect(enqueueRenderJobMock).not.toHaveBeenCalled();
  });

  it('calls onComplete when the primary CTA is pressed', () => {
    const onComplete = vi.fn();
    renderWithQueryClient(<RevealStep onComplete={onComplete} />);

    const cta = screen.getByRole('button', { name: /Start using BURS/i });
    fireEvent.click(cta);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cleans up the channel on unmount', async () => {
    const { unmount } = renderWithQueryClient(<RevealStep onComplete={vi.fn()} />);

    await waitFor(() => expect(createdChannels.length).toBeGreaterThan(0));
    unmount();

    expect(removeChannelMock).toHaveBeenCalledTimes(1);
  });

  // Wave 7.9 audit polish #1 — distinct copy when ALL 3 watched garments
  // are in the 'failed' state. Without the all-failed branch, the cooking
  // copy + shimmer would feel like a quiet lie.
  it('shows the all-failed title + subtitle when every watched garment is failed', async () => {
    garmentsResponseRef.current = {
      data: [
        {
          id: 'g1',
          image_path: 'orig/g1.jpg',
          original_image_path: 'orig/g1.jpg',
          rendered_image_path: null,
          render_status: 'failed',
        },
        {
          id: 'g2',
          image_path: 'orig/g2.jpg',
          original_image_path: 'orig/g2.jpg',
          rendered_image_path: null,
          render_status: 'failed',
        },
        {
          id: 'g3',
          image_path: 'orig/g3.jpg',
          original_image_path: 'orig/g3.jpg',
          rendered_image_path: null,
          render_status: 'failed',
        },
      ],
      error: null,
    };

    renderWithQueryClient(<RevealStep onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Your originals look great too\./i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/We had trouble rendering your studio shots/i),
    ).toBeInTheDocument();
    // Shimmer overlay must be hidden — auto-retry has already fired (one
    // per garment), there's nothing visibly cooking. The "Rendering…" badge
    // should not be on screen.
    expect(screen.queryByText('Rendering')).not.toBeInTheDocument();
  });

  // Wave 7.9 audit B.P0.2 — onComplete failure resets `advancing` so the CTA
  // re-enables for retry. Without this, a transient `completeOnboarding`
  // RPC failure left the button permanently disabled until page reload.
  it('resets the advancing flag if onComplete throws so the user can retry', async () => {
    const onComplete = vi
      .fn()
      .mockRejectedValueOnce(new Error('first attempt failed'))
      .mockResolvedValueOnce(undefined);

    renderWithQueryClient(<RevealStep onComplete={onComplete} />);

    const cta = screen.getByRole('button', { name: /Start using BURS/i });

    // First click: handler rejects. The advancing reset is async (await
    // chain inside handleAdvance), so we waitFor the button to re-enable.
    fireEvent.click(cta);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(cta).not.toBeDisabled());

    // Second click: succeeds. Advancing stays true on resolution because
    // the parent will navigate via the onboardingCompleted short-circuit;
    // we just confirm onComplete fired again.
    fireEvent.click(cta);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(2));
  });
});
