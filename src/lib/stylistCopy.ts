/**
 * Stylist micro-copy — contextual editorial tips that make BURS
 * feel like a personal stylist, not a utility app.
 */

interface StylistTip {
  text: string;
  category: 'weather' | 'general' | 'wardrobe' | 'occasion' | 'seasonal';
}

const MORNING_TIPS: StylistTip[] = [
  { text: 'Start the day with intention — your outfit sets the tone.', category: 'general' },
  { text: 'A well-chosen outfit is the easiest confidence boost.', category: 'general' },
  { text: 'Dress for the day you want, not just the one you have.', category: 'general' },
];

const AFTERNOON_TIPS: StylistTip[] = [
  { text: 'Plan tomorrow\'s outfit tonight — morning decisions are overrated.', category: 'general' },
  { text: 'The best outfits feel effortless. That takes preparation.', category: 'general' },
  { text: 'Style isn\'t about having more. It\'s about knowing what works.', category: 'general' },
];

const EVENING_TIPS: StylistTip[] = [
  { text: 'Great style repeats what works. Review today\'s outfit.', category: 'general' },
  { text: 'Tomorrow is a fresh canvas. Plan something intentional.', category: 'general' },
  { text: 'Your wardrobe already has everything you need.', category: 'general' },
];

const RAIN_TIPS: StylistTip[] = [
  { text: 'Rain calls for layers. Think structured over relaxed today.', category: 'weather' },
  { text: 'Dark tones and water-resistant pieces — elegant rain dressing.', category: 'weather' },
];

const COLD_TIPS: StylistTip[] = [
  { text: 'Layering is an art. Start light, build up, stay polished.', category: 'weather' },
  { text: 'Cold weather is your best excuse for textured, structured pieces.', category: 'weather' },
];

const HOT_TIPS: StylistTip[] = [
  { text: 'Less fabric, more intention. Light colors, breathable materials.', category: 'weather' },
  { text: 'Heat calls for simplicity. One statement piece, clean lines.', category: 'weather' },
];

const SMALL_WARDROBE_TIPS: StylistTip[] = [
  { text: 'A focused wardrobe is a powerful wardrobe. Quality over quantity.', category: 'wardrobe' },
  { text: 'Every piece should earn its place. Keep adding intentionally.', category: 'wardrobe' },
];

const LARGE_WARDROBE_TIPS: StylistTip[] = [
  { text: 'You have range. Let\'s make sure you\'re using it.', category: 'wardrobe' },
  { text: 'With this many pieces, the secret is rotation — not repetition.', category: 'wardrobe' },
];

const DNA_TIPS: Record<string, StylistTip[]> = {
  Minimalist: [
    { text: 'Your minimalist instinct is your superpower — lean into it.', category: 'wardrobe' },
    { text: 'Fewer choices, sharper looks. Your DNA knows the way.', category: 'wardrobe' },
  ],
  Classic: [
    { text: 'Classic never fades. Your style DNA proves it.', category: 'wardrobe' },
    { text: 'Timeless taste is rare — yours is consistent.', category: 'wardrobe' },
  ],
  'Casual Creative': [
    { text: 'Effortless and expressive — your DNA is all about creative comfort.', category: 'wardrobe' },
    { text: 'Relaxed doesn\'t mean random. Your style has a clear signature.', category: 'wardrobe' },
  ],
  'Sharp Dresser': [
    { text: 'Polished every time — your wardrobe DNA is built to impress.', category: 'wardrobe' },
    { text: 'You dress with precision. Your style DNA confirms it.', category: 'wardrobe' },
  ],
  'Color Explorer': [
    { text: 'Bold palette choices set you apart. Keep experimenting.', category: 'wardrobe' },
    { text: 'Your color instincts are your signature — trust them.', category: 'wardrobe' },
  ],
  'Uniform Builder': [
    { text: 'A personal uniform is peak efficiency. Yours is dialled in.', category: 'wardrobe' },
    { text: 'Repetition isn\'t boring when it\'s intentional. Own your formula.', category: 'wardrobe' },
  ],
};

function pickRandom<T>(arr: T[]): T {
  // Use day-of-year as seed for daily consistency
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return arr[dayOfYear % arr.length];
}

export interface StylistContext {
  weather?: { temperature?: number; precipitation?: string };
  garmentCount?: number;
  hasPlannedOutfit?: boolean;
  styleDNA?: { archetype: string };
}

/**
 * Returns a contextual stylist tip based on time, weather, and wardrobe state.
 */
export function getStylistTip(ctx: StylistContext = {}): string {
  const hour = new Date().getHours();

  // Weather-specific tips take priority
  if (ctx.weather?.precipitation === 'rain' || ctx.weather?.precipitation === 'snow') {
    return pickRandom(RAIN_TIPS).text;
  }
  if (ctx.weather?.temperature != null && ctx.weather.temperature < 5) {
    return pickRandom(COLD_TIPS).text;
  }
  if (ctx.weather?.temperature != null && ctx.weather.temperature > 28) {
    return pickRandom(HOT_TIPS).text;
  }

  // Wardrobe-size tips
  if (ctx.garmentCount != null && ctx.garmentCount < 15) {
    return pickRandom(SMALL_WARDROBE_TIPS).text;
  }
  if (ctx.garmentCount != null && ctx.garmentCount > 80) {
    return pickRandom(LARGE_WARDROBE_TIPS).text;
  }

  // Style DNA tips
  if (ctx.styleDNA?.archetype && DNA_TIPS[ctx.styleDNA.archetype]) {
    return pickRandom(DNA_TIPS[ctx.styleDNA.archetype]).text;
  }

  // Time-based
  if (hour < 10) return pickRandom(MORNING_TIPS).text;
  if (hour < 18) return pickRandom(AFTERNOON_TIPS).text;
  return pickRandom(EVENING_TIPS).text;
}

/**
 * Stylist-grade section headers — replace generic labels.
 */
export const STYLIST_HEADERS = {
  ai_suggestions: 'Your stylist picks',
  wardrobe_gap: 'What\'s missing',
  mood_outfit: 'Dress for how you feel',
  plan_tomorrow: 'Plan tomorrow',
  quick_actions: 'Your next move',
  style_dna: 'Your style signature',
  top_garments: 'Your hardest workers',
  unused: 'Forgotten gems',
} as const;
