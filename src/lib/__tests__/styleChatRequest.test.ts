import { describe, expect, it } from 'vitest';
import { buildStyleChatRequest, type StyleChatConversationMessage } from '@/lib/styleChatRequest';

function makeMessage(overrides: Partial<StyleChatConversationMessage> = {}): StyleChatConversationMessage {
  return {
    role: 'user',
    content: 'Default message',
    ...overrides,
  };
}

describe('buildStyleChatRequest', () => {
  it('summarizes older context while keeping the recent turns', () => {
    const messages = Array.from({ length: 15 }, (_, index) =>
      makeMessage({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Turn ${index + 1} `.repeat(40),
      }),
    );

    const result = buildStyleChatRequest(messages);

    expect(result.messages).toHaveLength(12);
    expect(result.conversationSummary).toContain('Earlier user goals:');
    expect(result.conversationSummary).toContain('Earlier stylist direction:');
    expect(typeof result.messages[0].content).toBe('string');
    expect((result.messages[0].content as string).length).toBeLessThanOrEqual(480);
  });

  it('tracks earlier image references in the summary', () => {
    const messages: StyleChatConversationMessage[] = [
      makeMessage({
        content: [
          { type: 'image_url', image_url: { url: 'https://example.com/look-1.jpg' } },
          { type: 'text', text: 'Style around this coat' },
        ],
      }),
      ...Array.from({ length: 12 }, (_, index) =>
        makeMessage({
          role: index % 2 === 0 ? 'assistant' : 'user',
          content: `Recent turn ${index + 1}`,
        }),
      ),
    ];

    const result = buildStyleChatRequest(messages);

    expect(result.conversationSummary).toContain('Reference images shared earlier in the thread: 1.');
  });
});
