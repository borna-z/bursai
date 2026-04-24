import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const createSignedUrl = vi.fn();
const fromMock = vi.fn();
const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (key: string) => key, locale: 'en' })),
}));

vi.mock('@/components/social/OutfitReactions', () => ({
  OutfitReactions: () => <div data-testid="outfit-reactions" />,
}));

vi.mock('@/lib/occasionLabel', () => ({
  getOccasionLabel: vi.fn((occasion: string) => occasion),
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

import ShareOutfitPage from '../ShareOutfit';

// P10 (Wave 2-A) — `ShareOutfitPage` now validates the URL `:id` as a UUID
// via `isUuid` before hitting Supabase. The fixture id has to be a real UUID
// shape or the component short-circuits to the not-found view and no DB call
// runs. The value is arbitrary — just needs to match the 8-4-4-4-12 hex shape.
const TEST_OUTFIT_ID = '11111111-1111-4111-8111-111111111111';

function createOutfitsQueryResult() {
  return {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: TEST_OUTFIT_ID,
        occasion: 'Dinner',
        style_vibe: null,
        explanation: 'Rendered look',
        share_enabled: true,
        outfit_items: [{
          id: 'item-1',
          slot: 'top',
          garment: {
            id: 'garment-1',
            title: 'Silk top',
            color_primary: 'black',
            image_path: 'raw.jpg',
            original_image_path: 'raw.jpg',
            rendered_image_path: 'rendered.png',
            render_status: 'ready',
          },
        }],
      },
      error: null,
    }),
  };
}

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/share/${TEST_OUTFIT_ID}`]}>
        <Routes>
          <Route path="/share/:id" element={<ShareOutfitPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('ShareOutfit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromMock.mockImplementation((table: string) => {
      if (table === 'analytics_events') {
        return { insert: insertMock };
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

  it('signs garment URLs from the canonical rendered path instead of raw image_path', async () => {
    renderPage();

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledWith('rendered.png', 3600);
    });

    expect(createSignedUrl).not.toHaveBeenCalledWith('raw.jpg', 3600);
    expect(await screen.findByAltText('Silk top')).toHaveAttribute('src', 'https://signed.example/rendered.png');
  });
});
