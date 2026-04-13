import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';

const createSignedUrl = vi.fn();
const fromMock = vi.fn();

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (key: string) => key, locale: 'en' })),
}));

vi.mock('@/components/ui/animated-page', () => ({
  AnimatedPage: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/social/OutfitReactions', () => ({
  OutfitReactions: () => <div data-testid="outfit-reactions" />,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: {
      from: () => ({
        createSignedUrl,
      }),
    },
  },
}));

import PublicProfilePage from '../PublicProfile';

function createProfileQueryResult() {
  return {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        username: 'stylist',
        display_name: 'Style Test',
        avatar_path: null,
      },
      error: null,
    }),
  };
}

function createOutfitsQueryResult() {
  return {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
}

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/u/stylist']}>
        <Routes>
          <Route path="/u/:username" element={<PublicProfilePage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('PublicProfile header migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromMock.mockImplementation((table: string) => {
      if (table === 'public_profiles') {
        return { select: vi.fn(() => createProfileQueryResult()) };
      }
      if (table === 'outfits') {
        return { select: vi.fn(() => createOutfitsQueryResult()) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  // NOTE: PublicProfile has no hero image so the migration uses the default
  // `solid` variant, not overlay. White-on-transparent text would be invisible
  // against the cream page background.
  it('renders a PageHeader with data-variant="solid"', async () => {
    const { container } = renderPage();

    await waitFor(() => {
      const header = container.querySelector('header[data-variant="solid"]');
      expect(header).not.toBeNull();
    });
  });
});
