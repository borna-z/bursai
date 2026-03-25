import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    limit: vi.fn().mockResolvedValue({
      data: [{
        id: 'outfit-1',
        occasion: 'Dinner',
        style_vibe: null,
        explanation: null,
        generated_at: '2026-03-22T00:00:00Z',
        outfit_items: [{
          id: 'item-1',
          slot: 'top',
          garment: {
            id: 'garment-1',
            title: 'Silk top',
            image_path: 'raw.jpg',
            original_image_path: 'raw.jpg',
            processed_image_path: 'processed.png',
            image_processing_status: 'ready',
            rendered_image_path: 'rendered.png',
            render_status: 'ready',
          },
        }],
      }],
      error: null,
    }),
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

describe('PublicProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromMock.mockImplementation((table: string) => {
      if (table === 'public_profiles') {
        return {
          select: vi.fn(() => createProfileQueryResult()),
        };
      }

      if (table === 'outfits') {
        return {
          select: vi.fn(() => createOutfitsQueryResult()),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    createSignedUrl.mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://signed.example/${path}` },
    }));
  });

  it('signs the canonical rendered garment path instead of raw image_path', async () => {
    renderPage();

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledWith('rendered.png', 3600);
    });

    expect(createSignedUrl).not.toHaveBeenCalledWith('raw.jpg', 3600);
    expect(await screen.findByAltText('Dinner')).toHaveAttribute('src', 'https://signed.example/rendered.png');
  });
});
