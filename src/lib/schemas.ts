/**
 * Zod schemas for Supabase query response validation.
 * Step 16: Data Validation Layer
 */
import { z } from 'zod';

// ── Preferences ──────────────────────────────────────────────

export const onboardingPrefsSchema = z.object({
  completed: z.boolean().optional().default(false),
  quiz: z.record(z.string(), z.unknown()).optional(),
});

export const profilePreferencesSchema = z.object({
  onboarding: onboardingPrefsSchema.optional(),
  accent_color: z.string().optional(),
  language: z.string().optional(),
  style_profile: z.record(z.string(), z.unknown()).optional(),
  notifications: z.record(z.string(), z.boolean()).optional(),
}).passthrough(); // allow future keys

export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;

// ── Profile ──────────────────────────────────────────────────

export const profileSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable().optional(),
  avatar_path: z.string().nullable().optional(),
  body_image_path: z.string().nullable().optional(),
  home_city: z.string().nullable().optional(),
  height_cm: z.number().nullable().optional(),
  weight_kg: z.number().nullable().optional(),
  is_premium: z.boolean().nullable().optional(),
  username: z.string().nullable().optional(),
  ics_url: z.string().nullable().optional(),
  stripe_customer_id: z.string().nullable().optional(),
  preferences: z.unknown().transform((v) => {
    const result = profilePreferencesSchema.safeParse(v);
    return result.success ? result.data : (v as ProfilePreferences);
  }).optional().nullable(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  last_calendar_sync: z.string().nullable().optional(),
});

export type ValidatedProfile = z.infer<typeof profileSchema>;

// ── Garment ──────────────────────────────────────────────────

export const garmentSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  category: z.string(),
  image_path: z.string(),
  color_primary: z.string(),
  color_secondary: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  pattern: z.string().nullable().optional(),
  material: z.string().nullable().optional(),
  fit: z.string().nullable().optional(),
  formality: z.number().nullable().optional(),
  season_tags: z.array(z.string()).nullable().optional(),
  wear_count: z.number().nullable().optional(),
  last_worn_at: z.string().nullable().optional(),
  in_laundry: z.boolean().nullable().optional(),
  condition_score: z.number().nullable().optional(),
  condition_notes: z.string().nullable().optional(),
  purchase_price: z.number().nullable().optional(),
  purchase_currency: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  imported_via: z.string().nullable().optional(),
  ai_analyzed_at: z.string().nullable().optional(),
  ai_provider: z.string().nullable().optional(),
  ai_raw: z.unknown().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export type ValidatedGarment = z.infer<typeof garmentSchema>;

// ── Outfit ───────────────────────────────────────────────────

export const outfitItemSchema = z.object({
  id: z.string().uuid(),
  outfit_id: z.string().uuid(),
  garment_id: z.string().uuid(),
  slot: z.string(),
  created_at: z.string().nullable().optional(),
  garment: garmentSchema.optional(),
});

export const outfitSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  occasion: z.string(),
  style_vibe: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  weather: z.unknown().nullable().optional(),
  rating: z.number().nullable().optional(),
  saved: z.boolean().nullable().optional(),
  share_enabled: z.boolean().nullable().optional(),
  planned_for: z.string().nullable().optional(),
  worn_at: z.string().nullable().optional(),
  flatlay_image_path: z.string().nullable().optional(),
  style_score: z.unknown().nullable().optional(),
  feedback: z.array(z.string()).nullable().optional(),
  generated_at: z.string().nullable().optional(),
  outfit_items: z.array(outfitItemSchema).optional(),
});

export type ValidatedOutfit = z.infer<typeof outfitSchema>;

// ── Style Score ──────────────────────────────────────────────

export const styleScoreSchema = z.object({
  overall: z.number().min(0).max(100).optional(),
  color_harmony: z.number().min(0).max(100).optional(),
  occasion_match: z.number().min(0).max(100).optional(),
  versatility: z.number().min(0).max(100).optional(),
});

export type StyleScore = z.infer<typeof styleScoreSchema>;

// ── Weather ──────────────────────────────────────────────────

export const weatherDataSchema = z.object({
  temp: z.number().optional(),
  feels_like: z.number().optional(),
  condition: z.string().optional(),
  icon: z.string().optional(),
  humidity: z.number().optional(),
  wind_speed: z.number().optional(),
}).passthrough();

export type WeatherData = z.infer<typeof weatherDataSchema>;

/**
 * Safely parse data with a Zod schema.
 * Returns parsed data on success, original data on failure (with console warning).
 */
export function safeParse<T>(schema: z.ZodType<T>, data: unknown, label?: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[Schema] Validation failed${label ? ` for ${label}` : ''}:`, result.error.issues);
    return data as T;
  }
  return result.data;
}
