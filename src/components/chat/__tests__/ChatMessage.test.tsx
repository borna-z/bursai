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

const garmentMap = new Map();

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
});
