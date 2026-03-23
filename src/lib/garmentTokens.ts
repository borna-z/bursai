export const GARMENT_TAG_RE = /\[\[garment:([a-f0-9-]+)(?:\|([^\]]+))?\]\]/gi;
export const OUTFIT_TAG_RE = /\[\[outfit:([a-f0-9-,]+)\|([^\]]*)\]\]/gi;
const ANY_DOUBLE_BRACKET_TAG_RE = /\[\[[\s\S]*?\]\]/g;

export type GarmentTextSegment =
  | { type: 'text'; value: string }
  | { type: 'garment'; id: string; label?: string };

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

export function stripUnknownGarmentMarkup(text: string): string {
  return text.replace(ANY_DOUBLE_BRACKET_TAG_RE, (match) => {
    GARMENT_TAG_RE.lastIndex = 0;
    OUTFIT_TAG_RE.lastIndex = 0;
    if (GARMENT_TAG_RE.test(match) || OUTFIT_TAG_RE.test(match)) return match;
    return "";
  }).replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}
