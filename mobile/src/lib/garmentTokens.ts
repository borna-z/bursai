// Garment-tag parser — mirrors `src/lib/garmentTokens.ts` on web.
//
// The stylist server embeds two kinds of bracketed tags in assistant prose
// so the client can swap them for visual cards without paying for the
// extra round trip to fetch garment rows by name:
//   • `[[garment:<uuid>|<optional label>]]` — a single piece pill
//   • `[[outfit:<uuid>,<uuid>,…|<explanation>]]` — an outfit slot list
//
// `stripUnknownGarmentMarkup` removes any other `[[…]]` token so the user
// never sees raw markup if the server hallucinates an unknown tag. Both
// parsers reset `lastIndex` defensively because the regexes carry the `g`
// flag and would otherwise skip matches when called in succession.

export const GARMENT_TAG_RE = /\[\[garment:([a-f0-9-]+)(?:\|([^\]]+))?\]\]/gi;
export const OUTFIT_TAG_RE = /\[\[outfit:([a-f0-9-,]+)\|([^\]]*)\]\]/gi;
const ANY_DOUBLE_BRACKET_TAG_RE = /\[\[[\s\S]*?\]\]/g;
const PARTIAL_TAG_START_RE = /\[\[(?:garment|outfit):/i;

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

    // Dangling `[[garment:` mid-stream — swallow it so streaming bubbles
    // don't flash raw markup before the closing `]]` arrives.
    index = text.length;
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

// Bold-markdown helper — used by chat surfaces to render `**bold**` runs
// without pulling in a full markdown renderer. Returns a list of plain
// + bold segments so callers can interleave bold styles inline.
export type BoldSegment = { value: string; bold: boolean };

export function parseBoldSegments(text: string): BoldSegment[] {
  if (!text) return [];
  const out: BoldSegment[] = [];
  const parts = text.split(/\*\*(.+?)\*\*/g);
  parts.forEach((part, i) => {
    if (!part) return;
    out.push({ value: part, bold: i % 2 === 1 });
  });
  return out;
}

// Sentence cues the stylist uses when explaining what it picked AGAINST
// ("kept the loafers over the trainers"). Matches web's heuristic at
// `src/components/chat/ChatMessage.tsx:17` byte-for-byte — divergence
// would mean a turn renders its rejection line on web but not mobile
// (or vice versa). Known false-positive: bare "kept the …" in non-
// rejection prose can match; web has the same edge case so the fix is
// cross-surface, not a mobile-parity concern.
const REJECTION_RE = /\b(over the|instead of|rather than|kept the)\b|(\bchose\b.*\bnot\b)/i;

// Extract a single "rejection" sentence from assistant prose — these are
// the editorial lines like "Kept the loafers over the trainers for a
// dressier line" that web renders in italic below the outfit card. The
// returned `remainder` strips the rejection sentence so the prose under
// the card doesn't repeat it.
export function extractRejectionSentence(
  text: string,
): { rejection: string; remainder: string } | null {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [];
  const idx = sentences.findIndex((s) => REJECTION_RE.test(s));
  if (idx === -1) return null;
  const rejection = sentences[idx].trim();
  const remainder = [...sentences.slice(0, idx), ...sentences.slice(idx + 1)]
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { rejection, remainder };
}
