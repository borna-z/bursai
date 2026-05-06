// Outfit scoring against a `DayContext`. Pure function: takes today's
// day-intelligence context + the user's saved/generated outfit roster +
// the flat garment list, returns the top-ranked `ScoredOutfit[]` ordered
// best-first. Consumer (HomeScreen `SmartDayBanner` via
// `useSmartDayRecommendation`) takes `top1` for the hero + `top3` for the
// secondary picks.
//
// Scoring axes (each in [0, 10], weighted then summed):
//  - occasion match: outfit.occasion vs intelligence.dominant_occasion
//  - formality match: outfit.formality vs intelligence.dominant_formality
//  - weather fit: outfit's outerwear/season tags vs precipitation + temperature
//  - novelty: penalises outfits whose garments were worn in the last 7 days
//  - completeness: outfits with more `outfit_items` rank above thinner ones
//
// Defensive throughout — outfit/garment fields are optional in the schema
// and a partially-populated row is common (the engine never throws on a
// missing field; it just scores 0 for that axis).

import type { DayContext, DayIntelligence } from './dayIntelligence';
import type { OutfitWithItems } from '../types/outfit';
import type { Garment } from '../types/garment';

export interface ScoredOutfit {
  outfit: OutfitWithItems;
  score: number;
  /** Per-axis breakdown — handy for debugging and for surfaces that want to
   *  explain WHY this look ranked highest (deferred UX). */
  breakdown: {
    occasion: number;
    formality: number;
    weather: number;
    novelty: number;
    completeness: number;
  };
}

const WEIGHT_OCCASION = 3;
const WEIGHT_FORMALITY = 2.5;
const WEIGHT_WEATHER = 2;
const WEIGHT_NOVELTY = 1.5;
const WEIGHT_COMPLETENESS = 1;

function normalize(value: string | null | undefined): string {
  return String(value ?? '').toLowerCase().trim();
}

function scoreOccasion(outfit: OutfitWithItems, intel: DayIntelligence): number {
  const target = normalize(intel.dominant_occasion);
  const candidate = normalize(outfit.occasion);
  if (!candidate || !target) return 4; // neutral when either side is unknown
  if (candidate === target) return 10;
  // Substring match (e.g. "work meeting" against dominant "work").
  if (candidate.includes(target) || target.includes(candidate)) return 7;
  // Loose family match — formality buckets share neighbouring vibes.
  const social = new Set(['social', 'dinner', 'party']);
  if (social.has(candidate) && social.has(target)) return 6;
  return 2;
}

function scoreFormality(outfit: OutfitWithItems, intel: DayIntelligence): number {
  // `outfits` table has no formality column — derive an average formality
  // from the outfit's garments instead. Garments without a formality value
  // contribute nothing; a fully-untagged outfit falls back to neutral.
  const target = intel.dominant_formality;
  const items = outfit.outfit_items ?? [];
  const formalities: number[] = [];
  for (const item of items) {
    const f = item.garment?.formality;
    if (typeof f === 'number' && Number.isFinite(f)) formalities.push(f);
  }
  if (formalities.length === 0) return 4;
  const avg = formalities.reduce((acc, n) => acc + n, 0) / formalities.length;
  const distance = Math.abs(avg - target);
  if (distance < 0.5) return 10;
  if (distance < 1.25) return 7;
  if (distance < 2.25) return 4;
  return 1;
}

function scoreWeather(outfit: OutfitWithItems, ctx: DayContext): number {
  const intel = ctx.intelligence;
  const sensitivity = intel.weather_sensitivity;
  if (sensitivity === 'low') return 6; // weather doesn't gate, all outfits acceptable
  const items = outfit.outfit_items ?? [];
  let outerwearCount = 0;
  let warmCount = 0;
  let lightCount = 0;
  for (const item of items) {
    const g = item.garment;
    if (!g) continue;
    const cat = normalize(g.category);
    const subcat = normalize(g.subcategory);
    if (cat === 'outerwear' || subcat.includes('coat') || subcat.includes('jacket')) outerwearCount += 1;
    const seasons = (g.season_tags ?? []).map(normalize);
    if (seasons.includes('winter') || seasons.includes('autumn') || seasons.includes('fall')) warmCount += 1;
    if (seasons.includes('summer') || seasons.includes('spring')) lightCount += 1;
  }
  const temp = ctx.weather?.temperature;
  const precipitation = normalize(ctx.weather?.precipitation);
  const cold = typeof temp === 'number' && temp <= 8;
  const hot = typeof temp === 'number' && temp >= 29;
  const wet = precipitation.includes('rain') || precipitation.includes('snow');

  let score = 5;
  if (cold || wet) {
    score += outerwearCount > 0 ? 3 : -2;
    score += warmCount > 0 ? 1 : 0;
  }
  if (hot) {
    score += lightCount > 0 ? 3 : 0;
    score += outerwearCount > 0 ? -1 : 1;
  }
  return Math.max(0, Math.min(10, score));
}

function scoreNovelty(outfit: OutfitWithItems, recentlyWorn: Set<string>): number {
  if (recentlyWorn.size === 0) return 7;
  const items = outfit.outfit_items ?? [];
  if (items.length === 0) return 5;
  let overlap = 0;
  for (const item of items) {
    const id = item.garment?.id;
    if (id && recentlyWorn.has(id)) overlap += 1;
  }
  const ratio = overlap / items.length;
  if (ratio === 0) return 10;
  if (ratio < 0.34) return 7;
  if (ratio < 0.67) return 4;
  return 1;
}

function scoreCompleteness(outfit: OutfitWithItems): number {
  const items = outfit.outfit_items ?? [];
  if (items.length >= 4) return 10;
  if (items.length === 3) return 8;
  if (items.length === 2) return 5;
  if (items.length === 1) return 2;
  return 0;
}

export function buildSuggestions(
  context: DayContext,
  outfits: OutfitWithItems[],
  // Garments parameter is part of the documented signature so future scoring
  // axes (e.g. anchor-pinned garment, palette balance against the wardrobe)
  // can read the full inventory without re-querying. Currently unused — the
  // recently-worn set is already derived in the hook layer.
  _garments: Garment[],
): ScoredOutfit[] {
  if (!Array.isArray(outfits) || outfits.length === 0) return [];

  const scored: ScoredOutfit[] = outfits.map((outfit) => {
    const occasion = scoreOccasion(outfit, context.intelligence);
    const formality = scoreFormality(outfit, context.intelligence);
    const weather = scoreWeather(outfit, context);
    const novelty = scoreNovelty(outfit, context.recentlyWornGarmentIds);
    const completeness = scoreCompleteness(outfit);
    const total =
      occasion * WEIGHT_OCCASION +
      formality * WEIGHT_FORMALITY +
      weather * WEIGHT_WEATHER +
      novelty * WEIGHT_NOVELTY +
      completeness * WEIGHT_COMPLETENESS;
    return {
      outfit,
      score: total,
      breakdown: { occasion, formality, weather, novelty, completeness },
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
