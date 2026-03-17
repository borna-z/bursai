import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/chat/GarmentInlineCard', () => ({
  GarmentInlineCard: ({ garment }: { garment: { id: string; title: string } }) => (
    <div data-testid={`garment-card-${garment.id}`}>{garment.title}</div>
  ),
}));

vi.mock('@/components/chat/OutfitSuggestionCard', () => ({
  OutfitSuggestionCard: ({ explanation }: { explanation: string }) => (
    <div data-testid="outfit-suggestion">{explanation}</div>
  ),
}));

import { ChatMessage } from '../ChatMessage';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

const emptyMap = new Map<string, GarmentBasic>();

function renderMessage(props: Parameters<typeof ChatMessage>[0]) {
  return render(
    <MemoryRouter>
      <ChatMessage {...props} />
    </MemoryRouter>,
  );
}

describe('ChatMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing for a user message', () => {
    renderMessage({
      message: { role: 'user', content: 'Hello there' },
      isStreaming: false,
      garmentMap: emptyMap,
    });
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('renders without crashing for an assistant message', () => {
    renderMessage({
      message: { role: 'assistant', content: 'Hi! How can I help?' },
      isStreaming: false,
      garmentMap: emptyMap,
    });
    expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument();
  });

  it('shows user message text with correct styling', () => {
    const { container } = renderMessage({
      message: { role: 'user', content: 'Style me' },
      isStreaming: false,
      garmentMap: emptyMap,
    });
    expect(container.querySelector('.bg-primary\\/10')).toBeInTheDocument();
  });

  it('shows streaming cursor when assistant is streaming with no text', () => {
    const { container } = renderMessage({
      message: { role: 'assistant', content: '' },
      isStreaming: true,
      garmentMap: emptyMap,
    });
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows streaming cursor inline when streaming with text', () => {
    const { container } = renderMessage({
      message: { role: 'assistant', content: 'Working on it' },
      isStreaming: true,
      garmentMap: emptyMap,
    });
    expect(screen.getByText('Working on it')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('does not show streaming cursor when not streaming', () => {
    const { container } = renderMessage({
      message: { role: 'assistant', content: 'Done' },
      isStreaming: false,
      garmentMap: emptyMap,
    });
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('renders garment inline cards when garment references are in text', () => {
    const garmentMap = new Map<string, GarmentBasic>([
      ['abc-123', { id: 'abc-123', title: 'White Sneakers', category: 'shoes', color_primary: 'white', image_path: null }],
    ]);
    renderMessage({
      message: { role: 'assistant', content: 'Try these: [[garment:abc-123]]' },
      isStreaming: false,
      garmentMap,
    });
    expect(screen.getByTestId('garment-card-abc-123')).toBeInTheDocument();
    expect(screen.getByText('White Sneakers')).toBeInTheDocument();
  });

  it('renders outfit suggestion cards for outfit references', () => {
    const id1 = 'aaa00000-0000-0000-0000-000000000001';
    const id2 = 'bbb00000-0000-0000-0000-000000000002';
    const garmentMap = new Map<string, GarmentBasic>([
      [id1, { id: id1, title: 'Tee', category: 'tshirt', color_primary: 'black', image_path: null }],
      [id2, { id: id2, title: 'Jeans', category: 'pants', color_primary: 'blue', image_path: null }],
    ]);
    renderMessage({
      message: { role: 'assistant', content: `Here is an outfit: [[outfit:${id1},${id2}|Casual weekend look]]` },
      isStreaming: false,
      garmentMap,
    });
    expect(screen.getByTestId('outfit-suggestion')).toBeInTheDocument();
    expect(screen.getByText('Casual weekend look')).toBeInTheDocument();
  });

  it('renders user images from multimodal content', () => {
    renderMessage({
      message: {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'https://example.com/img.jpg' } },
        ],
      },
      isStreaming: false,
      garmentMap: emptyMap,
    });
    expect(screen.getByText('What is this?')).toBeInTheDocument();
    expect(screen.getByAltText('Upload')).toBeInTheDocument();
  });

  it('returns null-like output when assistant has empty text and no garments', () => {
    const { container } = renderMessage({
      message: { role: 'assistant', content: '' },
      isStreaming: false,
      garmentMap: emptyMap,
    });
    // Should still render the wrapper div but no meaningful text content
    expect(container.querySelector('.animate-fade-in')).toBeInTheDocument();
  });
});
