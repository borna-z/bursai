import { getTextContent, type MessageContent } from '@/lib/chatStream';
import { parseOutfitTags } from '@/lib/garmentTokens';
import { collectStyleChatGarmentIds, type StyleChatResponseEnvelope } from '@/lib/styleChatContract';

export interface ChatActiveLookMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
  stylistMeta?: StyleChatResponseEnvelope | null;
}

export function findLatestActiveLookMessageIndex(messages: ChatActiveLookMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;

    if (message.stylistMeta?.render_outfit_card && message.stylistMeta.outfit_ids.length > 0) {
      return index;
    }

    const text = getTextContent(message.content);
    if (parseOutfitTags(text).length > 0) {
      return index;
    }
  }

  return -1;
}

export function getLatestActiveLook(messages: ChatActiveLookMessage[]): StyleChatResponseEnvelope | null {
  const index = findLatestActiveLookMessageIndex(messages);
  if (index === -1) return null;

  const message = messages[index];
  if (message.stylistMeta?.outfit_ids.length) {
    return message.stylistMeta;
  }

  const text = getTextContent(message.content);
  const parsed = parseOutfitTags(text)[0];
  if (!parsed) return null;

  return {
    kind: 'stylist_response',
    mode: 'OUTFIT_GENERATION',
    assistant_text: text,
    outfit_ids: parsed.ids,
    outfit_explanation: parsed.explanation,
    garment_mentions: parsed.ids,
    suggestion_chips: [],
    truncated: false,
    active_look_status: 'preserved',
    fallback_used: false,
    degraded_reason: null,
    render_outfit_card: true,
  };
}

export function collectActiveLookGarmentIds(messages: ChatActiveLookMessage[]): string[] {
  const latest = getLatestActiveLook(messages);
  if (!latest) return [];
  return collectStyleChatGarmentIds(latest);
}
