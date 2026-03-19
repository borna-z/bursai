import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

const garmentMap = new Map([[
  '11111111-1111-1111-1111-111111111111',
  { id: '11111111-1111-1111-1111-111111111111', title: 'Navy blazer', image_path: null, category: 'outerwear' },
]]);

function renderMessage(overrides: Partial<Parameters<typeof ChatMessage>[0]> = {}) {
  const defaults: Parameters<typeof ChatMessage>[0] = {
    message: { role: 'assistant', content: 'Hello there!' },
    isStreaming: false,
    garmentMap,
    ...overrides,
  };
  return render(<ChatMessage {...defaults} />);
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
});
