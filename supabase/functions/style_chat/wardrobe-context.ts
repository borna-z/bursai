/**
 * wardrobe-context.ts — Data retrieval for style chat: wardrobe, outfits,
 * rejections, taste memory, calendar, geocoding, weather.
 *
 * Extracted from style_chat/index.ts — zero logic changes.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCompleteOutfitIds } from "../_shared/complete-outfit-ids.ts";
import type {
  MessageInput,
  GarmentRecord,
  RawSignal,
  RetrievalResult,
  AnchorSelection,
} from "./index.ts";
import {
  getMessageText,
  normalizeTerm,
  tokenize,
  getGarmentSearchText,
  rankGarmentForPrompt,
  detectAnchorGarment,
  buildRankedGarmentSubset,
  getSlotKey,
} from "./index.ts";
import { formatGarmentLine } from "./prompt-builder.ts";

// ── helpers ────────────────────────────────────────────────────────────────

async function fetchJsonWithTimeout<T>(input: string, init: RequestInit = {}, timeoutMs = 2500): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── wardrobe retrieval ─────────────────────────────────────────────────────

export interface RecentOutfitsResult {
  text: string;
  occasions: string[];
  recentGarmentSets: string[][];
}

export async function getWardrobeContext(supabase: ReturnType<typeof createClient>, userId: string, messages: MessageInput[], selectedGarmentIds: string[] = []): Promise<RetrievalResult> {
  const { data: garments } = await supabase
    .from("garments")
    .select("id, title, category, subcategory, color_primary, color_secondary, material, fit, formality, pattern, season_tags, wear_count, last_worn_at, image_path, ai_raw")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(120);
  if (!garments?.length) {
    return {
      text: "The user has no garments in their wardrobe yet.",
      garmentCount: 0,
      dominantArchetype: null,
      rankedGarments: [],
      anchor: null,
      retrievalSummary: "No garments available.",
    };
  }

  const typedGarments = garments as GarmentRecord[];

  const catCounts: Record<string, number> = {};
  const styleClusters: Record<string, number> = {};
  const materialCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};
  let totalVersatility = 0;
  let versatilityCount = 0;

  for (const g of typedGarments) {
    catCounts[g.category] = (catCounts[g.category] || 0) + 1;
    if (g.color_primary) colorCounts[g.color_primary] = (colorCounts[g.color_primary] || 0) + 1;
    if (g.material) materialCounts[g.material] = (materialCounts[g.material] || 0) + 1;

    const aiRaw = g.ai_raw && typeof g.ai_raw === "object" ? g.ai_raw : {};
    const e = aiRaw.enrichment || aiRaw;
    if (e.style_archetype) styleClusters[e.style_archetype] = (styleClusters[e.style_archetype] || 0) + 1;
    if (typeof e.versatility_score === "number") { totalVersatility += e.versatility_score; versatilityCount++; }
  }

  const summary = Object.entries(catCounts).map(([cat, count]) => `${count} ${cat}`).join(", ");

  const gaps: string[] = [];
  const hasCat = (keyword: string) => Object.keys(catCounts).some((k) => k.toLowerCase().includes(keyword));
  if (!hasCat("shoes") && !hasCat("footwear")) gaps.push("shoes");
  if (!hasCat("outerwear") && !hasCat("jacket") && !hasCat("coat")) gaps.push("outerwear");
  if (!hasCat("bottom") && !hasCat("pants") && !hasCat("jeans")) gaps.push("bottoms");

  const topColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
  const topMaterials = Object.entries(materialCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);
  const topArchetypes = Object.entries(styleClusters).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, c]) => `${a} (${c})`);
  const avgVersatility = versatilityCount > 0 ? (totalVersatility / versatilityCount).toFixed(1) : null;

  let compositionBlock = `\nWARDROBE COMPOSITION:`;
  compositionBlock += `\nDominant colors: ${topColors.join(", ")}`;
  if (topMaterials.length) compositionBlock += `\nKey materials: ${topMaterials.join(", ")}`;
  if (topArchetypes.length) compositionBlock += `\nStyle clusters: ${topArchetypes.join(", ")}`;
  if (avgVersatility) compositionBlock += `\nAvg versatility: ${avgVersatility}/10`;
  if (gaps.length) compositionBlock += `\nWardrobe gaps: missing ${gaps.join(", ")}`;

  const sortedByWear = [...typedGarments].sort((a, b) => (b.wear_count ?? 0) - (a.wear_count ?? 0));
  const overused = sortedByWear.slice(0, 3).filter((g) => (g.wear_count ?? 0) >= 10);
  const unworn = typedGarments.filter((g) => (g.wear_count ?? 0) === 0);

  const combinedQuery = messages.map((m) => getMessageText(m.content)).join(" ");
  const queryTerms = tokenize(combinedQuery);
  const anchorSelection = detectAnchorGarment(typedGarments, messages, selectedGarmentIds);
  const explicitIds = new Set(anchorSelection.explicitIds);
  const ranked = [...typedGarments]
    .map((g) => ({ garment: g, ...rankGarmentForPrompt(g, queryTerms, anchorSelection.anchor, explicitIds) }))
    .sort((a, b) => b.score - a.score || (a.garment.title || "").localeCompare(b.garment.title || ""));

  const rankedGarments = buildRankedGarmentSubset(ranked, anchorSelection.anchor);
  const detailPool = rankedGarments.length ? rankedGarments : typedGarments.slice(0, 24);
  const details = detailPool.map(formatGarmentLine).join("\n");

  let insightLines = "";
  if (unworn.length > 0) {
    insightLines += `\nUnworn items (${unworn.length}): ${unworn.slice(0, 5).map((g) => g.title).join(", ")}`;
  }
  if (overused.length > 0) {
    insightLines += `\nMost worn: ${overused.map((g) => `${g.title} (${g.wear_count}x)`).join(", ")}`;
  }

  const dominantArchetype = topArchetypes.length > 0
    ? Object.entries(styleClusters).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const topRetrievalLines = ranked.slice(0, 8).map((entry, index) =>
    `${index + 1}. ${entry.garment.title} [ID:${entry.garment.id}] score ${entry.score}${entry.reasons.length ? ` — ${entry.reasons.slice(0, 4).join(", ")}` : ""}`
  );

  const retrievalSummary = [
    anchorSelection.anchor ? `Anchor garment: ${anchorSelection.anchor.title} [ID:${anchorSelection.anchor.id}] via ${anchorSelection.source}.` : "No anchor garment confirmed.",
    topRetrievalLines.length ? `Top retrieval set:\n${topRetrievalLines.join("\n")}` : "",
  ].filter(Boolean).join("\n");

  return {
    text: `Wardrobe (${typedGarments.length} garments: ${summary}):${compositionBlock}\n\nRETRIEVAL FOCUS:\n${retrievalSummary}\n\nRANKED GARMENT SUBSET FOR THIS CHAT:\n${details}${insightLines}`,
    garmentCount: typedGarments.length,
    dominantArchetype,
    rankedGarments,
    anchor: anchorSelection.anchor,
    retrievalSummary,
  };
}

export async function getRecentOutfitsContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<RecentOutfitsResult> {
  const { data: outfits } = await supabase
    .from("outfits")
    .select("id, occasion, style_vibe, explanation, worn_at, generated_at, outfit_items(slot, garment_id, garments(title, color_primary))")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .limit(5);
  if (!outfits?.length) return { text: "", occasions: [], recentGarmentSets: [] };

  const occasions = [...new Set(outfits.map((o: any) => o.occasion).filter(Boolean))] as string[];

  const lines = outfits.map((o: any) => {
    const items = (o.outfit_items || []).map((i: any) =>
      `${i.slot}: ${i.garments?.title || 'unknown'} (${i.garments?.color_primary || ''})`
    ).join(" + ");
    const wornStr = o.worn_at ? ` [worn ${o.worn_at.slice(0, 10)}]` : " [not worn]";
    return `- ${o.occasion}${o.style_vibe ? '/' + o.style_vibe : ''}: ${items}${wornStr}`;
  });

  const recentGarmentSets: string[][] = outfits.map((o: any) =>
    (o.outfit_items || []).map((i: any) => i.garment_id).filter(Boolean)
  ).filter((ids: string[]) => ids.length > 0);

  return { text: `\nRecent outfits:\n${lines.join("\n")}`, occasions, recentGarmentSets };
}

export async function getRejectionsContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ text: string; raw: RawSignal[] }> {
  const { data: signals } = await supabase
    .from("feedback_signals")
    .select("signal_type, value, metadata, created_at")
    .eq("user_id", userId)
    .in("signal_type", ["swap", "reject", "dislike", "thumbs_down"])
    .order("created_at", { ascending: false })
    .limit(8);
  if (!signals?.length) return { text: "", raw: [] };

  const lines = signals.map((s: any) => {
    const meta = s.metadata || {};
    const parts = [s.signal_type];
    if (s.value) parts.push(s.value);
    if (meta.slot) parts.push(`slot:${meta.slot}`);
    if (meta.reason) parts.push(`reason:${meta.reason}`);
    if (meta.swapped_garment_title) parts.push(`swapped:${meta.swapped_garment_title}`);
    if (meta.replacement_title) parts.push(`→${meta.replacement_title}`);
    return `- ${parts.join(' | ')} (${s.created_at?.slice(0, 10) || ''})`;
  });

  return {
    text: `\nRECENT REJECTIONS/SWAPS (avoid repeating these patterns):\n${lines.join("\n")}`,
    raw: signals as RawSignal[],
  };
}

export function buildTasteMemoryBlock(
  rawSignals: RawSignal[],
  garments: GarmentRecord[],
  dna: { archetype: string | null; formalityCenter: number | null },
): string {
  const insights: string[] = [];

  // 1. Slot swap/reject frequency — slot appearing 2+ times
  const slotCounts: Record<string, number> = {};
  for (const s of rawSignals) {
    const slot = s.metadata?.slot as string | undefined;
    if (slot) slotCounts[slot] = (slotCounts[slot] ?? 0) + 1;
  }
  const repeatedSlot = Object.entries(slotCounts)
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count >= 2);
  if (repeatedSlot) {
    insights.push(
      `User repeatedly swaps out ${repeatedSlot[0]} — avoid leading with low-formality ${repeatedSlot[0]} options`,
    );
  }

  // 2. Color avoidance — 3+ unworn garments share the same color_primary
  const colorCounts: Record<string, number> = {};
  for (const g of garments) {
    if ((g.wear_count ?? 0) === 0 && g.color_primary) {
      colorCounts[g.color_primary] = (colorCounts[g.color_primary] ?? 0) + 1;
    }
  }
  const avoidedColor = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count >= 3);
  if (avoidedColor) {
    insights.push(
      `User rejects ${avoidedColor[0]} items — avoid unless anchored by a strong request`,
    );
  }

  // 3. Signature archetype from DNA
  if (dna.archetype) {
    insights.push(`Signature move: ${dna.archetype} — lean into this pattern`);
  }

  // 4. Formality centre — casual lean if average worn-garment formality < 2.5
  if (dna.formalityCenter !== null && dna.formalityCenter < 2.5) {
    insights.push(
      `User consistently dresses casual — structured suggestions need strong justification`,
    );
  }

  return insights.slice(0, 4).join("\n");
}

export async function getCalendarContext(supabase: ReturnType<typeof createClient>, userId: string, lang: { todayLabel: string; tomorrowLabel: string }): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("calendar_events")
    .select("title, date, start_time")
    .eq("user_id", userId)
    .gte("date", today)
    .lte("date", sevenDaysFromNow)
    .order("date")
    .limit(15);
  if (!data?.length) return "";
  const lines = data.map((e: { title: string; date: string; start_time: string | null }) => {
    let dateLabel: string;
    if (e.date === today) {
      dateLabel = lang.todayLabel;
    } else if (e.date === tomorrow) {
      dateLabel = lang.tomorrowLabel;
    } else {
      dateLabel = new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
    }
    return `- ${dateLabel}: ${e.title}${e.start_time ? ` ${e.start_time.slice(0, 5)}` : ""}`;
  });
  return `\nCalendar events:\n${lines.join("\n")}`;
}

export async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const data = await fetchJsonWithTimeout<Array<{ lat?: string; lon?: string }>>(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
    { headers: { "User-Agent": "BURS-App/1.0" } },
    2500,
  );
  if (data?.[0]) return { lat: parseFloat(data[0].lat || "0"), lon: parseFloat(data[0].lon || "0") };
  return null;
}

export async function fetchWeather(lat: number, lon: number, lang: { weatherLabel: string }): Promise<string> {
  const weather = await fetchJsonWithTimeout<{ current?: { temperature_2m?: number; wind_speed_10m?: number; precipitation?: number; weather_code?: number } }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,wind_speed_10m,weather_code`,
    {},
    2500,
  );
  const current = weather?.current;
  if (!current) return "";
  return `${lang.weatherLabel}: ${current.temperature_2m}°C, wind ${current.wind_speed_10m} km/h, precipitation ${current.precipitation} mm, code ${current.weather_code}.`;
}
