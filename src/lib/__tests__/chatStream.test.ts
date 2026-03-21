import { describe, expect, it } from 'vitest';

import { getTextContent, mergeAssistantContent, type MessageContent } from '@/lib/chatStream';

describe('chatStream', () => {
  it('keeps text-only streaming content as a string', () => {
    let content: MessageContent = '';
    content = mergeAssistantContent(content, 'Hello');
    content = mergeAssistantContent(content, ' there');

    expect(content).toBe('Hello there');
  });

  it('preserves assistant multimodal parts when the stream emits structured content', () => {
    let content: MessageContent = '';
    content = mergeAssistantContent(content, 'Start');
    content = mergeAssistantContent(content, [
      { type: 'image_url', image_url: { url: 'https://example.com/look.jpg' } },
      { type: 'text', text: ' finish' },
    ]);

    expect(content).toEqual([
      { type: 'text', text: 'Start' },
      { type: 'image_url', image_url: { url: 'https://example.com/look.jpg' } },
      { type: 'text', text: ' finish' },
    ]);
    expect(getTextContent(content)).toBe('Start  finish');
  });

  it('ignores unsupported delta payloads', () => {
    expect(mergeAssistantContent('', { foo: 'bar' })).toBe('');
  });
});
