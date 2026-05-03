// Display helpers for outfits. Centralised so HomeScreen / PlanScreen /
// OutfitsScreen / OutfitDetail / MonthCalendar all derive the same name and
// gradient hue from a given row — keeps the visual rhythm consistent across
// the app and means a future schema change to the display-name source list
// only touches one place.
//
// Name resolution order: occasion → style_vibe → family_label → explanation
// (truncated). The `outfits` schema doesn't carry a single canonical
// human-readable name, so we walk a fallback chain. `explanation` is the
// AI-generated long-form description so we cap it at 40 chars to avoid
// cards filled with prose.
//
// `outfitGradientHue` mirrors the djb2 hash used in GarmentCard's id-based
// fallback so an outfit and its garments share the same colour family when
// no real photo is loaded yet.

type OutfitDisplaySource = {
  occasion?: string | null;
  style_vibe?: string | null;
  family_label?: string | null;
  explanation?: string | null;
} | null | undefined;

export function outfitDisplayName(outfit: OutfitDisplaySource, fallback = 'Outfit'): string {
  if (!outfit) return fallback;
  const occasion = outfit.occasion?.trim();
  if (occasion) return occasion;
  const vibe = outfit.style_vibe?.trim();
  if (vibe) return vibe;
  const family = outfit.family_label?.trim();
  if (family) return family;
  const explanation = outfit.explanation?.trim();
  if (explanation) return explanation.length > 40 ? `${explanation.slice(0, 40)}…` : explanation;
  return fallback;
}

export function outfitGradientHue(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

// Local-date YYYY-MM-DD. Mirrors the helper inlined in PlanScreen / MonthCalendar
// — exported here so the hook layer can use it without each screen redeclaring.
// `Date.prototype.toISOString().slice(0,10)` converts to UTC first, so a local
// midnight in CET (UTC+1) returns yesterday's date — wrong for hydrating
// queries against the day the user actually sees.
export function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
