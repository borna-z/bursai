import { describe, expect, it, vi } from 'vitest';
import { deleteStyleChatHistory, loadStyleChatMessages, persistStyleChatMessages } from '@/lib/styleChatHistory';

function createFluentQuery(result: { data?: unknown; error?: { code?: string; message?: string; details?: string | null; hint?: string | null } | null }) {
  const chain: Record<string, unknown> = {};
  const resolved = Promise.resolve({ data: result.data ?? null, error: result.error ?? null });

  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  chain.then = resolved.then.bind(resolved);
  chain.catch = resolved.catch.bind(resolved);
  chain.finally = resolved.finally.bind(resolved);

  return chain;
}

function createClientMock(config: {
  selectResult?: { data?: unknown; error?: { code?: string; message?: string; details?: string | null; hint?: string | null } | null };
  insertResult?: { error?: { code?: string; message?: string; details?: string | null; hint?: string | null } | null };
  deleteResult?: { error?: { code?: string; message?: string; details?: string | null; hint?: string | null } | null };
}) {
  const selectChain = createFluentQuery(config.selectResult || {});
  const deleteChain = createFluentQuery(config.deleteResult || {});
  const table = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockResolvedValue({ error: config.insertResult?.error ?? null }),
    delete: vi.fn().mockReturnValue(deleteChain),
  };

  return {
    client: {
      from: vi.fn().mockReturnValue(table),
    },
    table,
    selectChain,
    deleteChain,
  };
}

describe('styleChatHistory', () => {
  it('loads stylist history rows via supabase-js', async () => {
    const { client, table, selectChain } = createClientMock({
      selectResult: {
        data: [
          { role: 'assistant', content: 'Hello there' },
          { role: 'user', content: 'Need a sharper version' },
        ],
      },
    });

    const rows = await loadStyleChatMessages(client as never, 'user-1');

    expect(client.from).toHaveBeenCalledWith('chat_messages');
    expect(table.select).toHaveBeenCalledWith('role, content');
    expect(selectChain.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(selectChain.eq).toHaveBeenNthCalledWith(2, 'mode', 'stylist');
    expect(selectChain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(selectChain.limit).toHaveBeenCalledWith(100);
    expect(rows).toEqual([
      { role: 'assistant', content: 'Hello there' },
      { role: 'user', content: 'Need a sharper version' },
    ]);
  });

  it('serializes stylist metadata when persisting history', async () => {
    const { client, table } = createClientMock({});

    await persistStyleChatMessages(
      client as never,
      'user-1',
      [{
        role: 'assistant',
        content: 'Polished look',
        stylistMeta: {
          mode: 'GENERATE',
          assistant_text: 'Polished look',
          outfit_ids: ['g-1', 'g-2', 'g-3'],
          render_outfit_card: true,
          active_look_garment_ids: ['g-1', 'g-2', 'g-3'],
        },
      }],
    );

    expect(table.insert).toHaveBeenCalledTimes(1);
    expect(table.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'user-1',
        role: 'assistant',
        mode: 'stylist',
      }),
    ]);
    expect(table.insert.mock.calls[0][0][0].content).toContain('"kind":"stylist_message"');
  });

  it('throws when persisting history fails', async () => {
    const { client } = createClientMock({
      insertResult: {
        error: { code: '42501', message: 'permission denied' },
      },
    });

    await expect(
      persistStyleChatMessages(
        client as never,
        'user-1',
        [{ role: 'assistant', content: 'Hello there' }],
      ),
    ).rejects.toThrow('Failed to persist stylist history');
  });

  it('throws when deleting history fails', async () => {
    const { client } = createClientMock({
      deleteResult: {
        error: { code: '42501', message: 'permission denied' },
      },
    });

    await expect(
      deleteStyleChatHistory(client as never, 'user-1'),
    ).rejects.toThrow('Failed to delete stylist history');
  });
});
