// Mobile's `t()` helper interpolates {name}-style tokens. LLMs occasionally
// drop, rename, or fabricate them; the translate_locale handler compares the
// placeholder sets per key and falls back to English when they don't match.

const RE = /\{(\w+)\}/g;

export function extractPlaceholders(s: string): Set<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  RE.lastIndex = 0;
  while ((m = RE.exec(s)) !== null) out.add(m[1]);
  return out;
}

export function placeholderSetsMatch(source: string, target: string): boolean {
  const a = extractPlaceholders(source);
  const b = extractPlaceholders(target);
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}
