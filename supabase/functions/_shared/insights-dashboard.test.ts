import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildInsightsDashboard,
  INSIGHTS_METRIC_VERSION,
  type GarmentInsightRow,
  type InsightsDashboardInput,
  type OutfitInsightRow,
  type PlannedOutfitInsightRow,
  type WearLogInsightRow,
} from "./insights-dashboard";

function makeGarment(overrides: Partial<GarmentInsightRow> = {}): GarmentInsightRow {
  return {
    id: overrides.id ?? "garment-1",
    title: overrides.title ?? "Black Tee",
    image_path: overrides.image_path ?? null,
    category: overrides.category ?? "tops",
    subcategory: overrides.subcategory ?? null,
    color_primary: overrides.color_primary ?? "black",
    color_secondary: overrides.color_secondary ?? null,
    material: overrides.material ?? null,
    fit: overrides.fit ?? null,
    formality: overrides.formality ?? 2,
    season_tags: overrides.season_tags ?? ["spring"],
    wear_count: overrides.wear_count ?? 0,
    last_worn_at: overrides.last_worn_at ?? null,
    created_at: overrides.created_at ?? "2026-01-01",
    purchase_price: overrides.purchase_price ?? null,
    purchase_currency: overrides.purchase_currency ?? null,
  };
}

function makeOutfit(overrides: Partial<OutfitInsightRow> = {}): OutfitInsightRow {
  return {
    id: overrides.id ?? "outfit-1",
    occasion: overrides.occasion ?? "casual",
    worn_at: overrides.worn_at ?? null,
    generated_at: overrides.generated_at ?? "2026-03-20T10:00:00.000Z",
    saved: overrides.saved ?? true,
  };
}

function makeWearLog(overrides: Partial<WearLogInsightRow> = {}): WearLogInsightRow {
  return {
    garment_id: overrides.garment_id ?? "garment-1",
    outfit_id: overrides.outfit_id ?? null,
    worn_at: overrides.worn_at ?? "2026-03-20",
    occasion: overrides.occasion ?? null,
    event_title: overrides.event_title ?? null,
  };
}

function makePlannedOutfit(overrides: Partial<PlannedOutfitInsightRow> = {}): PlannedOutfitInsightRow {
  return {
    date: overrides.date ?? "2026-03-24",
    status: overrides.status ?? "planned",
    outfit_id: overrides.outfit_id ?? null,
  };
}

function makeInput(overrides: Partial<InsightsDashboardInput> = {}): InsightsDashboardInput {
  return {
    generated_at: overrides.generated_at ?? "2026-03-28T12:00:00.000Z",
    garments: overrides.garments ?? [],
    wear_logs_last_30_days: overrides.wear_logs_last_30_days ?? [],
    wear_logs_last_90_days: overrides.wear_logs_last_90_days ?? [],
    wear_logs_last_180_days: overrides.wear_logs_last_180_days ?? [],
    wear_logs_recent_500: overrides.wear_logs_recent_500 ?? [],
    wear_logs_for_outfit_history: overrides.wear_logs_for_outfit_history ?? [],
    outfits: overrides.outfits ?? [],
    planned_outfits_last_90_days: overrides.planned_outfits_last_90_days ?? [],
  };
}

describe("buildInsightsDashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the canonical metric version and overview planning metrics", () => {
    const payload = buildInsightsDashboard(makeInput({
      planned_outfits_last_90_days: [makePlannedOutfit()],
    }));

    expect(payload.metric_version).toBe(INSIGHTS_METRIC_VERSION);
    expect(payload.overview).toMatchObject({
      planned_this_week: 1,
      total_garments: 0,
      total_saved_outfits: 0,
    });
    expect(payload.value).toMatchObject({
      spending: null,
      sustainability: null,
    });
  });

  it("keeps spending nullable but still returns sustainability when garments exist", () => {
    const payload = buildInsightsDashboard(makeInput({
      garments: [
        makeGarment({
          id: "garment-1",
          wear_count: 4,
          last_worn_at: "2026-03-20",
          purchase_price: null,
        }),
      ],
      wear_logs_last_30_days: [makeWearLog({ garment_id: "garment-1", worn_at: "2026-03-20" })],
    }));

    expect(payload.value).toMatchObject({
      spending: null,
      sustainability: {
        total_garments: 1,
        utilization_rate: 100,
      },
    });
  });

  it("counts outfit repeats by distinct worn dates instead of raw garment logs", () => {
    const payload = buildInsightsDashboard(makeInput({
      outfits: [makeOutfit({ id: "outfit-repeat" })],
      wear_logs_for_outfit_history: [
        { outfit_id: "outfit-repeat", worn_at: "2026-03-20" },
        { outfit_id: "outfit-repeat", worn_at: "2026-03-20" },
        { outfit_id: "outfit-repeat", worn_at: "2026-03-20" },
        { outfit_id: "outfit-repeat", worn_at: "2026-03-22" },
        { outfit_id: "outfit-repeat", worn_at: "2026-03-22" },
      ],
    }));

    expect(payload.behavior).toMatchObject({
      outfit_repeats: {
        repeats: [
          {
            id: "outfit-repeat",
            worn_count: 2,
            last_worn: "2026-03-22",
          },
        ],
      },
    });
  });
});
