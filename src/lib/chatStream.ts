export type MultimodalPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type MessageContent = string | MultimodalPart[];

function isTextPart(part: unknown): part is { type: 'text'; text: string } {
  return !!part && typeof part === 'object' && (part as { type?: unknown }).type === 'text' && typeof (part as { text?: unknown }).text === 'string';
}

function isImageUrlPart(part: unknown): part is { type: 'image_url'; image_url: { url: string } } {
  return !!part
    && typeof part === 'object'
    && (part as { type?: unknown }).type === 'image_url'
    && typeof (part as { image_url?: { url?: unknown } }).image_url?.url === 'string';
}

function isMultimodalPart(part: unknown): part is MultimodalPart {
  return isTextPart(part) || isImageUrlPart(part);
}

function normalizeParts(content: unknown): MultimodalPart[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : [];
  }

  if (Array.isArray(content)) {
    return content.filter(isMultimodalPart);
  }

  return [];
}

export function getTextContent(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content.filter(isTextPart).map((part) => part.text).join(' ');
}

export function mergeAssistantContent(current: MessageContent, delta: unknown): MessageContent {
  if (typeof current === 'string' && typeof delta === 'string') {
    return current + delta;
  }

  const nextParts = normalizeParts(delta);
  if (nextParts.length === 0) return current;

  const mergedParts = [...normalizeParts(current), ...nextParts];
  return mergedParts.some(isImageUrlPart) ? mergedParts : getTextContent(mergedParts);
}
