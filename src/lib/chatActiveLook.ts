import { getTextContent, type MessageContent } from '@/lib/chatStream';
import { parseOutfitTags } from '@/lib/garmentTokens';
import { collectStyleChatGarmentIds, type StyleChatResponseEnvelope } from '@/lib/styleChatContract';

export interface ChatActiveLookMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
  stylistMeta?: StyleChatResponseEnvelope | null;
}

function getResolvedOutfitIds(meta?: StyleChatResponseEnvelope | null): string[] {
  if (!meta) return [];
  return meta.active_look?.garment_ids?.length
    ? meta.active_look.garment_ids
    : meta.outfit_ids;
}

function getResolvedOutfitExplanation(meta?: StyleChatResponseEnvelope | null): string {
  if (!meta) return '';
  return meta.active_look?.explanation || meta.outfit_explanation || '';
}

function buildResolvedActiveLook(meta: StyleChatResponseEnvelope, garmentIds: string[], explanation: string) {
  return {
    garment_ids: garmentIds,
    explanation,
    source: meta.active_look?.source || meta.active_look_status || 'preserved',
    status: meta.active_look?.status || meta.active_look_status || 'preserved',
    card_state: meta.active_look?.card_state || meta.card_state || 'preserved',
    anchor_garment_id: meta.active_look?.anchor_garment_id ?? null,
    anchor_locked: meta.active_look?.anchor_locked ?? false,
  };
}

export function hasRenderableActiveLook(meta?: StyleChatResponseEnvelope | null): boolean {
  return Boolean(meta?.render_outfit_card && getResolvedOutfitIds(meta).length > 0);
}

export function findLatestActiveLookMessageIndex(messages: ChatActiveLookMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;

    if (hasRenderableActiveLook(message.stylistMeta)) {
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
  if (message.stylistMeta && getResolvedOutfitIds(message.stylistMeta).length) {
    const resolvedIds = getResolvedOutfitIds(message.stylistMeta);
    const resolvedExplanation = getResolvedOutfitExplanation(message.stylistMeta);
    return {
      ...message.stylistMeta,
      response_kind: message.stylistMeta.response_kind || 'style_result',
      card_policy: message.stylistMeta.card_policy || 'required',
      card_state: message.stylistMeta.card_state || 'preserved',
      outfit_ids: resolvedIds,
      outfit_explanation: resolvedExplanation,
      active_look: buildResolvedActiveLook(message.stylistMeta, resolvedIds, resolvedExplanation),
    };
  }

  const text = getTextContent(message.content);
  const parsed = parseOutfitTags(text)[0];
  if (!parsed) return null;

  return {
    kind: 'stylist_response',
    mode: 'OUTFIT_GENERATION',
    response_kind: 'style_result',
    card_policy: 'required',
    card_state: 'preserved',
    assistant_text: text,
    outfit_ids: parsed.ids,
    outfit_explanation: parsed.explanation,
    garment_mentions: parsed.ids,
    suggestion_chips: [],
    truncated: false,
    active_look_status: 'preserved',
    active_look: {
      garment_ids: parsed.ids,
      explanation: parsed.explanation,
      source: 'assistant_outfit_tag',
      status: 'preserved',
      card_state: 'preserved',
      anchor_garment_id: null,
      anchor_locked: false,
    },
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
