import type { MessageContent } from '@/lib/chatStream';
import type { PersistedStyleChatMessage, StyleChatResponseEnvelope } from '@/lib/styleChatContract';

export interface StyleChatHistoryMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
  stylistMeta?: StyleChatResponseEnvelope | null;
}

function serializeMessageContent(message: StyleChatHistoryMessage): string {
  if (message.stylistMeta) {
    return JSON.stringify({
      kind: 'stylist_message',
      content: message.content,
      stylistMeta: message.stylistMeta,
    } satisfies PersistedStyleChatMessage);
  }

  return typeof message.content === 'string'
    ? message.content
    : JSON.stringify(message.content);
}

async function assertRestSuccess(response: Response, action: 'persist' | 'delete'): Promise<void> {
  if (response.ok) return;

  let details = '';
  try {
    details = await response.text();
  } catch {
    details = '';
  }

  throw new Error(`Failed to ${action} stylist history (${response.status})${details ? `: ${details}` : ''}`);
}

export async function persistStyleChatMessages(
  request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  url: string,
  userId: string,
  messages: StyleChatHistoryMessage[],
  headers: HeadersInit,
): Promise<void> {
  const response = await request(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(messages.map((message) => ({
      user_id: userId,
      role: message.role,
      content: serializeMessageContent(message),
      mode: 'stylist',
    }))),
  });

  await assertRestSuccess(response, 'persist');
}

export async function deleteStyleChatHistory(
  request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  url: string,
  headers: HeadersInit,
): Promise<void> {
  const response = await request(url, {
    method: 'DELETE',
    headers,
  });

  await assertRestSuccess(response, 'delete');
}
