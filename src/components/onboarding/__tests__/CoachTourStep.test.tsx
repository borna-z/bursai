import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { CoachTourStep } from '@/components/onboarding/CoachTourStep';

// Mirror LanguageContext's no-provider safety net (humanized last segment of
// the key) so safeT() falls back to the component's explicit English strings.
// Same pattern as AchievementStep.test.tsx + StudioSelectionStep.test.tsx.
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

// ──────────────────────────────────────────────────────────────────────────
// Supabase mocks — the component reads from BOTH `render_jobs` (to derive
// the watched-IDs set) AND `garments` (for the synchronous already-ready
// check). Mock `supabase.from()` to return per-table builders, plus the
// realtime channel chain.
// ──────────────────────────────────────────────────────────────────────────

type RenderJobRow = { garment_id: string };
type GarmentRow = { id: string; render_status: string };

const renderJobsResponseRef = vi.hoisted(() => ({
  current: { data: [] as RenderJobRow[], error: null as Error | null },
}));
const garmentsResponseRef = vi.hoisted(() => ({
  current: { data: [] as GarmentRow[], error: null as Error | null },
}));

type ChannelCallback = (payload: { new?: { id?: string; render_status?: string } }) => void;

interface MockChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  __callback?: ChannelCallback;
  __filterArgs?: {
    event: string;
    schema: string;
    table: string;
    filter: string;
  };
  __subscribeArg?: (status: string, err?: Error) => void;
}

const createdChannels: MockChannel[] = [];
const channelMock = vi.hoisted(() => vi.fn());
const removeChannelMock = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'render_jobs') {
        // Builder chain: select(...).eq(...).in(...).order(...).limit(...).then(resolve).
        // Each chained method returns the same thenable; .limit(N) finally
        // resolves to the canonical { data, error } shape.
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
      throw new Error(`Unexpected supabase.from(${table}) in CoachTourStep test`);
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
  // Default: 3 watched render_jobs (g1, g2, g3) all pending.
  renderJobsResponseRef.current = {
    data: [
      { garment_id: 'g1' },
      { garment_id: 'g2' },
      { garment_id: 'g3' },
    ],
    error: null,
  };
  // Default: garments table returns the same 3 garments, all still pending
  // (no already-ready short-circuit).
  garmentsResponseRef.current = {
    data: [
      { id: 'g1', render_status: 'pending' },
      { id: 'g2', render_status: 'pending' },
      { id: 'g3', render_status: 'pending' },
    ],
    error: null,
  };

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
        ch.__subscribeArg = cb;
        // Fire SUBSCRIBED synchronously so the listener path is exercised.
        cb?.('SUBSCRIBED');
        return ch;
      }),
    };
    createdChannels.push(ch);
    return ch;
  });

  removeChannelMock.mockReset();
});

describe('CoachTourStep', () => {
  it('renders all five tip card titles', async () => {
    renderWithQueryClient(<CoachTourStep onComplete={vi.fn()} />);

    expect(await screen.findByText(/Home — your daily plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Wardrobe — every piece you own/i)).toBeInTheDocument();
    expect(screen.getByText(/Outfits — saved looks/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Stylist — chat with the engine/i)).toBeInTheDocument();
    expect(screen.getByText(/Studio renders — your three picks/i)).toBeInTheDocument();
  });

  it('calls onComplete when the primary CTA is pressed', () => {
    const onComplete = vi.fn();
    renderWithQueryClient(<CoachTourStep onComplete={onComplete} />);

    const cta = screen.getByRole('button', { name: /I.?m ready/i });
    fireEvent.click(cta);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('subscribes to render_status updates on the user-scoped channel after fetching watched render_jobs', async () => {
    renderWithQueryClient(<CoachTourStep onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(channelMock).toHaveBeenCalledWith('coach-tour-u1');
      expect(createdChannels.length).toBeGreaterThan(0);
    });

    const ch = createdChannels[0];
    expect(ch.on).toHaveBeenCalled();
    expect(ch.__filterArgs).toEqual({
      event: 'UPDATE',
      schema: 'public',
      table: 'garments',
      filter: 'user_id=eq.u1',
    });
    expect(ch.subscribe).toHaveBeenCalled();
  });

  it('shows the celebratory CTA copy when a watched garment flips to ready', async () => {
    renderWithQueryClient(<CoachTourStep onComplete={vi.fn()} />);

    await waitFor(() => expect(createdChannels.length).toBeGreaterThan(0));
    const ch = createdChannels[0];
    expect(ch.__callback).toBeDefined();

    expect(screen.getByRole('button', { name: /I.?m ready/i })).toBeInTheDocument();

    act(() => {
      ch.__callback!({ new: { id: 'g1', render_status: 'ready' } });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Show me my renders/i })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/first render is ready/i);
    });
  });

  it('ignores updates for garments outside the watched-3 set (driven by render_jobs, not by recency)', async () => {
    // Code-reviewer P1 round 1: the watched set comes from `render_jobs`,
    // not "3 most-recent garments". Here we set the watched set to g3/g4/g5
    // (older garments the user picked in P49 from a larger wardrobe). A
    // realtime update on g1 (the newest garment, but NOT in the watched
    // set) must not trigger firstRenderReady.
    renderJobsResponseRef.current = {
      data: [
        { garment_id: 'g3' },
        { garment_id: 'g4' },
        { garment_id: 'g5' },
      ],
      error: null,
    };
    garmentsResponseRef.current = {
      data: [
        { id: 'g3', render_status: 'pending' },
        { id: 'g4', render_status: 'pending' },
        { id: 'g5', render_status: 'pending' },
      ],
      error: null,
    };

    renderWithQueryClient(<CoachTourStep onComplete={vi.fn()} />);

    await waitFor(() => expect(createdChannels.length).toBeGreaterThan(0));
    const ch = createdChannels[0];

    // g1 is the newest garment in the wardrobe but NOT one of the picked
    // 3. Updates to g1 must not flip the CTA — they're a different render.
    act(() => {
      ch.__callback!({ new: { id: 'g1', render_status: 'ready' } });
    });

    expect(screen.getByRole('button', { name: /I.?m ready/i })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Now flip one of the actually-watched garments (g3) — CTA should
    // celebrate.
    act(() => {
      ch.__callback!({ new: { id: 'g3', render_status: 'ready' } });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Show me my renders/i })).toBeInTheDocument();
    });
  });

  it('cleans up the channel on unmount', async () => {
    const { unmount } = renderWithQueryClient(<CoachTourStep onComplete={vi.fn()} />);

    await waitFor(() => expect(createdChannels.length).toBeGreaterThan(0));

    unmount();

    expect(removeChannelMock).toHaveBeenCalledTimes(1);
  });

  it('treats already-ready watched garments on first fetch as firstRenderReady=true', async () => {
    // Edge case: the user's renders finished while they were tapping
    // through the StudioSelection submit (or a hot retry surfaced an
    // already-ready row). The realtime UPDATE event won't fire (nothing
    // changes after mount), so the synchronous garments query covers it.
    garmentsResponseRef.current = {
      data: [
        { id: 'g1', render_status: 'ready' },
        { id: 'g2', render_status: 'pending' },
        { id: 'g3', render_status: 'pending' },
      ],
      error: null,
    };

    renderWithQueryClient(<CoachTourStep onComplete={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Show me my renders/i })).toBeInTheDocument();
    });
  });

  it('handles zero watched render_jobs gracefully (no subscription, CTA still works)', async () => {
    // If render_jobs returns 0 rows (e.g., everything already terminal,
    // or the query failed and we returned []), the component must not
    // subscribe to the channel and the CTA must still advance the user.
    renderJobsResponseRef.current = { data: [], error: null };
    garmentsResponseRef.current = { data: [], error: null };

    const onComplete = vi.fn();
    renderWithQueryClient(<CoachTourStep onComplete={onComplete} />);

    // Give react-query + the synchronous effect a microtask flush.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /I.?m ready/i })).toBeInTheDocument(),
    );

    expect(channelMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /I.?m ready/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
