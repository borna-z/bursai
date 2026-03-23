export const GARMENT_TAG_RE = /\[\[garment:([a-f0-9-]+)(?:\|([^\]]+))?\]\]/gi;
export const OUTFIT_TAG_RE = /\[\[outfit:([a-f0-9-,]+)\|([^\]]*)\]\]/gi;
const ANY_DOUBLE_BRACKET_TAG_RE = /\[\[[\s\S]*?\]\]/g;
const PARTIAL_TAG_START_RE = /\[\[(?:garment|outfit):/i;
const PARTIAL_TAG_CHAR_RE = /[a-z0-9,\-|]/i;

export type GarmentTextSegment =
  | { type: 'text'; value: string }
  | { type: 'garment'; id: string; label?: string };

export interface ParsedOutfitTag {
  fullMatch: string;
  ids: string[];
  explanation: string;
}

export function extractGarmentIdsFromText(text: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;

  GARMENT_TAG_RE.lastIndex = 0;
  while ((match = GARMENT_TAG_RE.exec(text)) !== null) {
    ids.add(match[1]);
  }

  OUTFIT_TAG_RE.lastIndex = 0;
  while ((match = OUTFIT_TAG_RE.exec(text)) !== null) {
    match[1].split(',').forEach((id) => ids.add(id.trim()));
  }

  return Array.from(ids);
}

export function parseOutfitTags(text: string): ParsedOutfitTag[] {
  const outfits: ParsedOutfitTag[] = [];
  let match: RegExpExecArray | null;

  OUTFIT_TAG_RE.lastIndex = 0;
  while ((match = OUTFIT_TAG_RE.exec(text)) !== null) {
    outfits.push({
      fullMatch: match[0],
      ids: match[1].split(',').map((id) => id.trim()).filter(Boolean),
      explanation: match[2].trim(),
    });
  }

  return outfits;
}

export function parseGarmentTextSegments(text: string): GarmentTextSegment[] {
  const segments: GarmentTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  GARMENT_TAG_RE.lastIndex = 0;
  while ((match = GARMENT_TAG_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const value = text.slice(lastIndex, match.index).trim();
      if (value) segments.push({ type: 'text', value });
    }

    segments.push({
      type: 'garment',
      id: match[1],
      label: match[2]?.trim() || undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const value = text.slice(lastIndex).trim();
    if (value) segments.push({ type: 'text', value });
  }

  return segments;
}

function stripPartialTagStarts(text: string): string {
  let output = '';
  let index = 0;

  while (index < text.length) {
    const nextStart = text.indexOf('[[', index);
    if (nextStart === -1) {
      output += text.slice(index);
      break;
    }

    output += text.slice(index, nextStart);
    const remainder = text.slice(nextStart);
    if (!PARTIAL_TAG_START_RE.test(remainder)) {
      output += '[[';
      index = nextStart + 2;
      continue;
    }

    const closeIndex = text.indexOf(']]', nextStart + 2);
    if (closeIndex !== -1) {
      output += text.slice(nextStart, closeIndex + 2);
      index = closeIndex + 2;
      continue;
    }

    let cursor = nextStart + 2;
    while (cursor < text.length && text[cursor] !== ':' ) cursor += 1;
    if (cursor < text.length && text[cursor] === ':') cursor += 1;
    while (cursor < text.length && PARTIAL_TAG_CHAR_RE.test(text[cursor])) {
      cursor += 1;
    }
    index = cursor;
  }

  return output;
}

export function stripUnknownGarmentMarkup(text: string): string {
  return stripPartialTagStarts(
    text.replace(ANY_DOUBLE_BRACKET_TAG_RE, (match) => {
      GARMENT_TAG_RE.lastIndex = 0;
      OUTFIT_TAG_RE.lastIndex = 0;
      if (GARMENT_TAG_RE.test(match) || OUTFIT_TAG_RE.test(match)) return match;
      return '';
    }),
  )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}
