import { describe, expect, it, vi } from 'vitest';
import { deleteStyleChatHistory, persistStyleChatMessages } from '@/lib/styleChatHistory';

describe('styleChatHistory', () => {
  it('throws when persisting history fails', async () => {
    const request = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));

    await expect(
      persistStyleChatMessages(
        request,
        'https://example.com/chat_messages',
        'user-1',
        [{ role: 'assistant', content: 'Hello there' }],
        { Authorization: 'Bearer token' },
      ),
    ).rejects.toThrow('Failed to persist stylist history');
  });

  it('throws when deleting history fails', async () => {
    const request = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));

    await expect(
      deleteStyleChatHistory(
        request,
        'https://example.com/chat_messages?user_id=eq.user-1&mode=eq.stylist',
        { Authorization: 'Bearer token' },
      ),
    ).rejects.toThrow('Failed to delete stylist history');
  });
});
