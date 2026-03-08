
# BURS Roadmap v2 — 25 Steps

## Phase 1: UX Polish & Performance (Steps 1–7)

### Step 1: Skeleton & Loading State Audit ✅
Audited all data-fetching views. Replaced raw `Loader2` spinners with contextual shimmer skeletons on Insights, Plan, Settings, and AIChat pages. Added `InsightsPageSkeleton`, `PlanPageSkeleton`, `SettingsPageSkeleton`, and `ChatPageSkeleton` to shared skeletons file. Home, Wardrobe, GarmentDetail, and OutfitDetail already had proper skeletons.

### Step 2: Haptic & Micro-Interaction Pass ✅
Added haptic feedback to: GarmentDetail (toggle laundry, mark worn, delete), OutfitDetail (save/unsave, rating, mark worn), DayCard (swap, mark worn, remove, plan, generate), PlanTomorrowCard, InsightsBanner, SmartInsightCard, SwipeableGarmentCard (swipe open). Replaced raw `navigator.vibrate` calls in LiveScan with standardized haptics. Added spring `whileTap` animations to SmartInsightCard.

### Step 3: Offline Mode & Queued Actions ✅
Created `lib/offlineQueue.ts` with localStorage-backed mutation queue (enqueue, replay, clear). Added `useOfflineQueue` hook for auto-replay on reconnect. Upgraded `OfflineBanner` to show queue count and syncing state. Configured React Query with `networkMode: 'offlineFirst'` and extended `gcTime` to 30 minutes for offline data access.

### Step 4: Pull-to-Refresh & Infinite Scroll 🔲
Implement native-feeling pull-to-refresh on Home, Wardrobe, and Plan pages. Add infinite scroll / virtualized lists for large wardrobes (100+ garments) using `@tanstack/react-virtual`.

### Step 5: Gesture Navigation 🔲
Swipe-left to archive/delete garments in wardrobe grid. Swipe-right on Today outfit card to mark as worn. Swipe between days in Plan page (already partially done, refine smoothness). Add gesture affordance hints for first-time users.

### Step 6: Accessibility Deep Pass 🔲
Full WCAG 2.1 AA audit: keyboard navigation for all flows, screen reader announcements for dynamic content (toast, sheet open, outfit generated), reduced-motion media query support, contrast ratio fixes.

### Step 7: Transition & Animation Polish 🔲
Refine route transitions with shared-element animations (garment card → detail page). Add staggered entrance animations to grid views. Smooth sheet/drawer open animations. Ensure 60fps on mid-range devices.

---

## Phase 2: Advanced Analytics & Insights (Steps 8–13)

### Step 8: Spending Dashboard 🔲
Track total wardrobe value from `purchase_price`. Monthly/yearly spending trends chart. Cost-per-category breakdown. Compare spending vs. wear value (most worn items vs. most expensive).

### Step 9: Seasonal Wardrobe Report 🔲
Quarterly auto-generated report: which garments were most/least worn, color palette shifts, formality trends, new additions vs. unused. Exportable as shareable image or PDF-style view.

### Step 10: Outfit Repeat Tracker 🔲
Visualize how often outfits are repeated. Show "outfit freshness" — days since last worn. Flag outfits that haven't been worn in 60+ days. Suggest remixing stale outfits with DNA cloning.

### Step 11: Wear Heatmap Calendar 🔲
Calendar view showing daily outfit status: wore planned outfit (green), improvised (yellow), no data (grey). Monthly wear consistency score. Streaks for planning ahead.

### Step 12: Category Balance Radar Chart 🔲
Radar/spider chart showing wardrobe balance across categories (tops, bottoms, outerwear, shoes, accessories). Highlight gaps and over-represented areas. Compare to "ideal" distribution.

### Step 13: Personal Style Report Card 🔲
AI-generated monthly style report: dominant style archetype, color confidence score, formality range, adventurousness rating (how often user tries new combos vs. repeats). Premium-gated with shareable card.

---

## Phase 3: Social & Community (Steps 14–19)

### Step 14: Public Style Profile 🔲
Optional public profile page showing curated outfits, style stats, and wardrobe size. Username-based URL (`/u/username`). Privacy controls: choose which outfits to showcase.

### Step 15: Outfit Inspiration Feed 🔲
Browse community outfits by occasion, style vibe, or season. Anonymous by default (no usernames unless profile is public). Filter by similar wardrobe size/style. "Save to inspiration board" feature.

### Step 16: Outfit Reactions & Kudos 🔲
Simple reaction system on shared outfits (🔥 styled, 💎 creative, 🌿 sustainable). No comments (keep it calm/non-toxic). Weekly "most styled" leaderboard for opted-in users.

### Step 17: Style Challenge System 🔲
Weekly opt-in challenges: "All neutrals week", "Rewear your least-used item", "Monochrome Monday". Track participation and show completion badges. Community-wide stats (X% completed).

### Step 18: Outfit Request / Style Advice 🔲
Users can post anonymous outfit requests: "Going to a wedding in June, warm weather, semi-formal". AI generates 3 suggestions from hypothetical pieces. Community can upvote best suggestion.

### Step 19: Friend Wardrobe Peek (Premium) 🔲
Connect with friends via invite code. See each other's public outfits. "Borrow" feature: mark a friend's garment as available for lending. Premium-only social feature.

---

## Phase 4: AI Intelligence v3 (Steps 20–25)

### Step 20: Visual Search & "Shop My Look" 🔲
Upload any inspiration photo (Instagram screenshot, magazine). AI identifies garment types, colors, and styles. Matches against user's wardrobe for closest alternatives. Highlights gaps where no match exists.

### Step 21: Mood-Based Outfit Generation 🔲
Generate outfits based on mood/energy: "I feel cozy", "I want to stand out", "Keep it invisible". Maps moods to formality, color temperature, material softness, and pattern boldness.

### Step 22: AI Outfit Mood Board 🔲
Given an event description, AI creates a visual mood board: color palette, style direction, 3 outfit options with explanations. Exportable as a shareable image. Uses `generate_flatlay` for each option.

### Step 23: Smart Shopping List 🔲
Based on gap analysis + style DNA + upcoming calendar events, AI generates a prioritized shopping list. Each item includes: why it's needed, what it unlocks (X new outfits), budget range, and style specifications.

### Step 24: Wardrobe Aging Predictions 🔲
Based on material, wear frequency, and condition scores, predict when each garment will need replacing. Timeline view showing expected garment "retirement dates". Proactive replacement suggestions.

### Step 25: Style Twin Matching 🔲
Analyze user's style vector (color temp, formality center, material preferences) and match with anonymous "style twins" — users with similar DNA. Show "Looks your style twin is wearing" as inspiration. Privacy-first: no identity revealed.

---

## Previous Completed Work

### AI Intelligence Roadmap v1 (Steps 1–25) — ✅ DONE
Feedback learning, seasonal palettes, material affinity, weather intelligence, occasion mapping, style vectors, wear patterns, comfort/style learning, color profiling, body-aware fit, multi-event planning, travel capsules, social context, laundry integration, seasonal transitions, flat-lay preview, photo feedback, condition tracking, outfit DNA cloning, accessory pairing, gap analysis, cost-per-wear, sustainability score, style evolution timeline, predictive styling.

### Localized Pricing — ✅ DONE
All pricing surfaces use `src/lib/localizedPricing.ts` for locale-appropriate amounts. Stripe checkout maps locale → currency-specific Price IDs.
