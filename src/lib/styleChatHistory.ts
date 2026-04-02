import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { MessageContent } from '@/lib/chatStream';
import type { PersistedStyleChatMessage, StyleChatResponseEnvelope } from '@/lib/styleChatContract';

type StyleChatSupabaseClient = Pick<SupabaseClient<Database>, 'from'>;
type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert'];

export interface StyleChatHistoryMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
  stylistMeta?: StyleChatResponseEnvelope | null;
}

export interface PersistedStyleChatHistoryRow {
  role: 'user' | 'assistant';
  content: string;
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

function formatSupabaseErrorDetails(error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null): string {
  if (!error) return '';

  const parts = [error.code, error.message, error.details, error.hint]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .map((part) => String(part).trim());

  return parts.length > 0 ? `: ${parts.join(' | ')}` : '';
}

function assertSupabaseSuccess(
  error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null,
  action: 'load' | 'persist' | 'delete',
): void {
  if (!error) return;
  throw new Error(`Failed to ${action} stylist history${formatSupabaseErrorDetails(error)}`);
}

export async function loadStyleChatMessages(
  client: StyleChatSupabaseClient,
  userId: string,
): Promise<PersistedStyleChatHistoryRow[]> {
  const { data, error } = await client
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', userId)
    .eq('mode', 'stylist')
    .order('created_at', { ascending: true })
    .limit(100);

  assertSupabaseSuccess(error, 'load');
  return (data || []) as PersistedStyleChatHistoryRow[];
}

export async function persistStyleChatMessages(
  client: StyleChatSupabaseClient,
  userId: string,
  messages: StyleChatHistoryMessage[],
): Promise<void> {
  const payload: ChatMessageInsert[] = messages.map((message) => ({
    user_id: userId,
    role: message.role,
    content: serializeMessageContent(message),
    mode: 'stylist',
  }));

  const { error } = await client
    .from('chat_messages')
    .insert(payload);

  assertSupabaseSuccess(error, 'persist');
}

export async function deleteStyleChatHistory(
  client: StyleChatSupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('chat_messages')
    .delete()
    .eq('user_id', userId)
    .eq('mode', 'stylist');

  assertSupabaseSuccess(error, 'delete');
}
