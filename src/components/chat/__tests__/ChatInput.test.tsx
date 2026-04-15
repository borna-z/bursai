import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatInput } from '../ChatInput';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

function renderInput(overrides: Partial<Parameters<typeof ChatInput>[0]> = {}) {
  const props: Parameters<typeof ChatInput>[0] = {
    input: '',
    onInputChange: vi.fn(),
    onSend: vi.fn(),
    onImageSelect: vi.fn(),
    pendingImage: null,
    onClearImage: vi.fn(),
    isStreaming: false,
    isUploading: false,
    ...overrides,
  };

  render(<ChatInput {...props} />);
  return props;
}

describe('ChatInput', () => {
  it('keeps chat actions accessible around the textarea', () => {
    renderInput();

    expect(screen.getByRole('textbox', { name: 'chat.message_input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chat.upload_image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chat.send' })).toBeDisabled();
  });

  it('sends on Enter but keeps Shift+Enter for multiline input', () => {
    const props = renderInput({ input: 'hello' });
    const textarea = screen.getByRole('textbox', { name: 'chat.message_input' });

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(props.onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it('renders and clears a pending image preview', () => {
    const props = renderInput({ pendingImage: { url: 'https://example.com/a.jpg', path: 'u/chat/a.jpg' } });

    expect(screen.getByRole('img', { name: 'chat.pending_image_alt' })).toHaveAttribute('src', 'https://example.com/a.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'chat.clear_image' }));
    expect(props.onClearImage).toHaveBeenCalledTimes(1);
  });
});
