import { getTextContent, type MessageContent } from '@/lib/chatStream';
import type { StyleChatResponseEnvelope } from '@/lib/styleChatContract';

export interface StyleChatConversationMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
  stylistMeta?: StyleChatResponseEnvelope | null;
}

export interface StyleChatRequestPayload {
  messages: Array<Pick<StyleChatConversationMessage, 'role' | 'content'>>;
  conversationSummary: string | null;
}

const MAX_RECENT_MESSAGES = 12;
const FULL_RECENT_MESSAGES = 6;
const COMPACT_TEXT_LIMIT = 480;
const SUMMARY_TEXT_LIMIT = 900;
const SUMMARY_LINE_LIMIT = 180;

function truncate(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function describeAssistantDirection(message: StyleChatConversationMessage): string | null {
  const meta = message.stylistMeta;
  if (meta?.outfit_ids?.length) {
    return truncate(
      `Suggested a ${meta.mode.toLowerCase().replace(/_/g, ' ')} look with ${meta.outfit_ids.length} garments: ${meta.assistant_text || getTextContent(message.content)}`,
      SUMMARY_LINE_LIMIT,
    );
  }

  const text = getTextContent(message.content);
  if (!text) return null;
  return truncate(`Stylist direction: ${text}`, SUMMARY_LINE_LIMIT);
}

function buildConversationSummary(messages: StyleChatConversationMessage[]): string | null {
  const olderMessages = messages.slice(0, -MAX_RECENT_MESSAGES);
  if (!olderMessages.length) return null;

  const earlierUserGoals = olderMessages
    .filter((message) => message.role === 'user')
    .map((message) => truncate(getTextContent(message.content), SUMMARY_LINE_LIMIT))
    .filter(Boolean);
  const earlierStylistDirections = olderMessages
    .filter((message) => message.role === 'assistant')
    .map(describeAssistantDirection)
    .filter((value): value is string => Boolean(value));

  const imageReferences = olderMessages.filter((message) =>
    Array.isArray(message.content) && message.content.some((part) => part.type === 'image_url'),
  ).length;

  const lines = [
    earlierUserGoals.length > 0
      ? `Earlier user goals: ${earlierUserGoals.slice(-3).join(' | ')}`
      : '',
    earlierStylistDirections.length > 0
      ? `Earlier stylist direction: ${earlierStylistDirections.slice(-2).join(' | ')}`
      : '',
    imageReferences > 0
      ? `Reference images shared earlier in the thread: ${imageReferences}.`
      : '',
  ].filter(Boolean);

  if (!lines.length) return null;
  return truncate(lines.join('\n'), SUMMARY_TEXT_LIMIT);
}

export function buildStyleChatRequest(messages: StyleChatConversationMessage[]): StyleChatRequestPayload {
  const filtered = messages.filter((message, index) => {
    const text = getTextContent(message.content).trim();
    if (!text && typeof message.content === 'string') return false;
    if (index === 0 && message.role === 'assistant') return false;
    return true;
  });

  const conversationSummary = buildConversationSummary(filtered);
  const recentMessages = filtered.slice(-MAX_RECENT_MESSAGES).map((message, index, list) => {
    const text = getTextContent(message.content);
    const keepFull = index >= list.length - FULL_RECENT_MESSAGES;
    const compactText = !keepFull && text.length > COMPACT_TEXT_LIMIT
      ? `${text.slice(0, COMPACT_TEXT_LIMIT - 3).trim()}...`
      : text;

    return {
      role: message.role,
      content: typeof message.content === 'string' ? compactText : message.content,
    };
  });

  return {
    messages: recentMessages,
    conversationSummary,
  };
}
