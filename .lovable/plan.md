

# Fix: Travel capsule only generating 1 outfit per day

## Problem

Two issues combine to cause this:

1. **AI generation fails** — logs show "AI returned empty capsule payload", so the deterministic fallback runs every time
2. **Fallback generates 1 outfit per day** — it uses `day: i + 1` sequentially, so each outfit gets a unique day number instead of multiple outfits sharing the same day

The fallback loop creates `daysToGenerate` outfits total, each with an incrementing day number. When you request 4 outfits/day for 7 days, it should produce up to 28 outfits (capped at 20) across 7 days, but instead produces ~9 outfits each on a different "day".

## Fix — `supabase/functions/travel_capsule/index.ts`

Rewrite the fallback outfit generation to iterate **days × outfits-per-day**:

```ts
// Current (broken):
const daysToGenerate = Math.min(duration_days, ...);
const outfits = Array.from({ length: daysToGenerate }).map((_, i) => ({
  day: i + 1,  // always unique day
  ...
}));

// Fixed:
const totalOutfits = Math.min(targetOutfits, duration_days * outfitsPerDay);
const outfits: any[] = [];
for (let day = 1; day <= duration_days && outfits.length < totalOutfits; day++) {
  for (let slot = 0; slot < outfitsPerDay && outfits.length < totalOutfits; slot++) {
    const idx = outfits.length;
    const occasion = occasions?.[slot % Math.max(occasions?.length || 0, 1)] || "casual";
    const items = [
      tops[idx % tops.length]?.id,
      bottoms[idx % bottoms.length]?.id,
      shoes[idx % shoes.length]?.id,
    ].filter(Boolean);
    // ... weather/outerwear logic same as before
    outfits.push({ day, occasion, items, note: "..." });
  }
}
```

This produces multiple outfits per day, cycling through occasions within each day — matching what the user requested.

**1 file changed.** The `buildDeterministicFallback` function in the edge function.

