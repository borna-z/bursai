import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/components/chat/GarmentInlineCard', () => ({
  GarmentInlineCard: () => <div data-testid="garment-inline-card" />,
}));

vi.mock('@/components/chat/OutfitSuggestionCard', () => ({
  OutfitSuggestionCard: () => <div data-testid="outfit-suggestion-card" />,
}));

import { ChatMessage } from '../ChatMessage';

const garmentMap = new Map([
  [
    '11111111-1111-1111-1111-111111111111',
    { id: '11111111-1111-1111-1111-111111111111', title: 'White tee', image_path: null, category: 'top', subcategory: 't-shirt' },
  ],
  [
    '22222222-2222-2222-2222-222222222222',
    { id: '22222222-2222-2222-2222-222222222222', title: 'Blue jeans', image_path: null, category: 'bottom', subcategory: 'jeans' },
  ],
  [
    '33333333-3333-3333-3333-333333333333',
    { id: '33333333-3333-3333-3333-333333333333', title: 'White sneakers', image_path: null, category: 'shoes', subcategory: 'sneakers' },
  ],
  [
    '44444444-4444-4444-4444-444444444444',
    { id: '44444444-4444-4444-4444-444444444444', title: 'Black dress', image_path: null, category: 'dress', subcategory: 'slip dress' },
  ],
]);

function renderMessage(overrides: Partial<Parameters<typeof ChatMessage>[0]> = {}) {
  const defaults: Parameters<typeof ChatMessage>[0] = {
    message: { role: 'assistant', content: 'Hello there!' },
    isStreaming: false,
    garmentMap,
    ...overrides,
  };
  return render(<MemoryRouter><ChatMessage {...defaults} /></MemoryRouter>);
}

describe('ChatMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    const { container } = renderMessage();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders message content text', () => {
    renderMessage({ message: { role: 'assistant', content: 'Try this outfit!' } });
    expect(screen.getByText('Try this outfit!')).toBeInTheDocument();
  });

  it('applies correct alignment for user messages', () => {
    const { container } = renderMessage({
      message: { role: 'user', content: 'Show me outfits' },
    });
    expect(container.querySelector('.justify-end')).toBeInTheDocument();
  });

  it('applies correct alignment for assistant messages', () => {
    const { container } = renderMessage({
      message: { role: 'assistant', content: 'Here are some options' },
    });
    // Assistant messages don't have justify-end
    expect(container.querySelector('.justify-end')).not.toBeInTheDocument();
  });

  it('renders without crashing when content is empty', () => {
    const { container } = renderMessage({
      message: { role: 'assistant', content: '' },
    });
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders garment cards for legacy garment tags without labels', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: 'Wear this [[garment:11111111-1111-1111-1111-111111111111]] tonight.',
      },
    });

    expect(screen.getByText('Wear this')).toBeInTheDocument();
    expect(screen.getByText('tonight.')).toBeInTheDocument();
    expect(screen.getByTestId('garment-inline-card')).toBeInTheDocument();
  });

  it('renders garment cards for labeled garment tags', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: 'Wear this [[garment:11111111-1111-1111-1111-111111111111|Navy blazer]] tonight.',
      },
    });

    expect(screen.getByText('Wear this')).toBeInTheDocument();
    expect(screen.getByText('tonight.')).toBeInTheDocument();
    expect(screen.getByTestId('garment-inline-card')).toBeInTheDocument();
  });



  it('renders assistant image_url parts alongside text and garment cards', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Try the blazer' },
          { type: 'image_url', image_url: { url: 'https://example.com/look-1.jpg' } },
          { type: 'text', text: 'with [[garment:11111111-1111-1111-1111-111111111111]].' },
        ],
      },
    });

    expect(screen.getByText(/Try the blazer with/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Stylist reference' })).toHaveAttribute('src', 'https://example.com/look-1.jpg');
    expect(screen.getByTestId('garment-inline-card')).toBeInTheDocument();
  });

  it('renders assistant image_url parts alongside outfit suggestion cards', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: [
          { type: 'image_url', image_url: { url: 'https://example.com/look-2.jpg' } },
          { type: 'text', text: '[[outfit:11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,33333333-3333-3333-3333-333333333333|Clean tonal layering]]' },
        ],
      },
    });

    expect(screen.getByRole('img', { name: 'Stylist reference' })).toHaveAttribute('src', 'https://example.com/look-2.jpg');
    expect(screen.getByTestId('outfit-suggestion-card')).toBeInTheDocument();
  });

  it('renders an outfit card from structured stylist metadata even without an outfit tag in the text', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: 'This is the sharper version.',
        stylistMeta: {
          kind: 'stylist_response',
          mode: 'ACTIVE_LOOK_REFINEMENT',
          response_kind: 'style_result',
          card_policy: 'required',
          card_state: 'updated',
          assistant_text: 'This is the sharper version.',
          outfit_ids: [
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333333',
          ],
          outfit_explanation: 'Sharper finish',
          garment_mentions: [],
          suggestion_chips: [],
          truncated: false,
          active_look_status: 'updated',
          active_look: {
            garment_ids: [
              '11111111-1111-1111-1111-111111111111',
              '22222222-2222-2222-2222-222222222222',
              '33333333-3333-3333-3333-333333333333',
            ],
            explanation: 'Sharper finish',
            source: 'unified_stylist_engine',
            status: 'updated',
            card_state: 'updated',
            anchor_garment_id: null,
            anchor_locked: false,
          },
          fallback_used: false,
          degraded_reason: null,
          render_outfit_card: true,
        },
      },
    });

    expect(screen.getByTestId('outfit-suggestion-card')).toBeInTheDocument();
    // Unique assistant prose (not duplicate of card explanation) stays visible.
    // Here the card explanation is 'Sharper finish' but assistant_text is
    // 'This is the sharper version.' — different strings, so prose renders.
    expect(screen.getByText(/This is the sharper version\./)).toBeInTheDocument();
  });

  it('shows a loading-safe fallback card when stylist metadata arrives before garment data', () => {
    renderMessage({
      garmentMap: new Map(),
      message: {
        role: 'assistant',
        content: 'Sharpened it.',
        stylistMeta: {
          kind: 'stylist_response',
          mode: 'ACTIVE_LOOK_REFINEMENT',
          response_kind: 'style_result',
          card_policy: 'required',
          card_state: 'updated',
          assistant_text: 'Sharpened it.',
          outfit_ids: [
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333333',
          ],
          outfit_explanation: 'Sharper finish',
          garment_mentions: [],
          suggestion_chips: [],
          truncated: false,
          active_look_status: 'updated',
          active_look: {
            garment_ids: [
              '11111111-1111-1111-1111-111111111111',
              '22222222-2222-2222-2222-222222222222',
              '33333333-3333-3333-3333-333333333333',
            ],
            explanation: 'Sharper finish',
            source: 'unified_stylist_engine',
            status: 'updated',
            card_state: 'updated',
            anchor_garment_id: null,
            anchor_locked: false,
          },
          fallback_used: false,
          degraded_reason: null,
          render_outfit_card: true,
        },
      },
    });

    expect(screen.getByText('Sharper finish')).toBeInTheDocument();
    expect(screen.queryByTestId('outfit-suggestion-card')).not.toBeInTheDocument();
  });

  it('can keep rendering the last confirmed look while a new assistant turn is still text-empty', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: '',
      },
      displayMetaOverride: {
        kind: 'stylist_response',
        mode: 'LOOK_EXPLANATION',
        response_kind: 'style_explanation',
        card_policy: 'preserve_if_exists',
        card_state: 'preserved',
        assistant_text: 'Keeping the look live.',
        outfit_ids: [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333',
        ],
        outfit_explanation: 'Current live look',
        garment_mentions: [],
        suggestion_chips: [],
        truncated: false,
        active_look_status: 'preserved',
        active_look: {
          garment_ids: [
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333333',
          ],
          explanation: 'Current live look',
          source: 'preserved_active_look',
          status: 'preserved',
          card_state: 'preserved',
          anchor_garment_id: null,
          anchor_locked: false,
        },
        fallback_used: true,
        degraded_reason: 'request_timeout',
        render_outfit_card: true,
      },
    });

    expect(screen.getByTestId('outfit-suggestion-card')).toBeInTheDocument();
  });

  it('does not render outfit suggestion cards for incomplete outfits', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: 'Try this [[outfit:11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222|Missing shoes]].',
      },
    });

    expect(screen.queryByTestId('outfit-suggestion-card')).not.toBeInTheDocument();
  });

  it('renders complete dress-led outfit suggestion cards', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: 'Event look [[outfit:44444444-4444-4444-4444-444444444444,33333333-3333-3333-3333-333333333333|Clean evening dress look]].',
      },
    });

    expect(screen.getByTestId('outfit-suggestion-card')).toBeInTheDocument();
  });

  it('falls back to the garment label when the garment is not loaded', () => {
    renderMessage({
      garmentMap: new Map(),
      message: {
        role: 'assistant',
        content: 'Pair it with [[garment:99999999-9999-9999-9999-999999999999|Black loafers]].',
      },
    });

    expect(screen.getByText('Pair it with')).toBeInTheDocument();
    expect(screen.getByText('Black loafers')).toBeInTheDocument();
  });


  it('can hide superseded outfit and garment cards while keeping the prose visible', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: 'Updated look [[outfit:11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222,33333333-3333-3333-3333-333333333333|Clean tonal layering]] with [[garment:44444444-4444-4444-4444-444444444444|Navy blazer]].',
      },
      showStyleCards: false,
    });

    expect(screen.getByText(/Updated look/)).toBeInTheDocument();
    expect(screen.queryByTestId('outfit-suggestion-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('garment-inline-card')).not.toBeInTheDocument();
  });

  it('hides incomplete raw garment tags from assistant prose', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: 'Change the pants [[garment:11111111-1111-1111-1111-111111111111 and make it sharper.',
      },
    });

    expect(screen.getByText('Change the pants')).toBeInTheDocument();
    expect(screen.queryByText(/\[\[garment:/)).not.toBeInTheDocument();
  });

  it('hides malformed raw bracket markup from assistant prose', () => {
    renderMessage({
      message: {
        role: 'assistant',
        content: 'Keep the hoodie [[Givenchy Logo Tape Hoodie: relaxed fit]] and switch the shoes.',
      },
    });

    expect(screen.getByText('Keep the hoodie and switch the shoes.')).toBeInTheDocument();
    expect(screen.queryByText(/\[\[/)).not.toBeInTheDocument();
  });
});
