import { getTextContent, type MessageContent } from '@/lib/chatStream';
import { parseOutfitTags } from '@/lib/garmentTokens';

export interface ChatActiveLookMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
}

export function findLatestActiveLookMessageIndex(messages: ChatActiveLookMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;

    const text = getTextContent(message.content);
    if (parseOutfitTags(text).length > 0) {
      return index;
    }
  }

  return -1;
}
