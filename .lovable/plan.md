

# Restore AI Suggestions Block on Home Page

## What changed
The recent Home redesign made AISuggestions conditional — it only shows when `homeState` is `no_outfit` or `weather_alert`. When an outfit is already planned, the hero slot shows the outfit card instead, hiding AI suggestions entirely.

## Fix
Move `<AISuggestions>` out of the state-conditional hero block and place it as its own section below the hero, so it always renders regardless of home state. It keeps its original design (horizontal garment circles, swipe dots, occasion labels, Try It / Plan CTAs).

### File: `src/pages/Home.tsx`
- Keep the state-aware hero block as-is (empty wardrobe / outfit planned / weather alert)
- For the `no_outfit` state, replace `<AISuggestions>` with a simple "Generate Today's Outfit" CTA card (so the hero always has a clear primary action)
- Add `<AISuggestions isPremium={isPremium} />` as a standalone section after QuickActionsRow, always visible when the user has 3+ garments
- This restores the original placement pattern where AI suggestions were always accessible

