import type { StyleChatResponseEnvelope } from './styleChatContract';

export interface ChatMessageLike {
  role: 'user' | 'assistant';
  stylistMeta?: StyleChatResponseEnvelope | null;
}

export function getLatestActiveLook(
  messages: readonly ChatMessageLike[],
): StyleChatResponseEnvelope | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;
    const meta = message.stylistMeta;
    if (!meta) continue;
    if ((meta.active_look?.garment_ids?.length ?? 0) > 0) {
      return meta;
    }
  }
  return null;
}

export function hasRenderableActiveLook(
  meta: StyleChatResponseEnvelope | null | undefined,
): boolean {
  return Boolean(meta?.render_outfit_card && (meta?.active_look?.garment_ids?.length ?? 0) > 0);
}
