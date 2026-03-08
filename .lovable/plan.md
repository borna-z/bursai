
# BURS AI Intelligence Roadmap — 25 Steps

## Phase 1: Foundation (Scoring Engine) — ✅ DONE

### Step 1: Feedback Learning v2 ✅
Exponential time-decay (14-day half-life) so recent feedback weighs more. Positive signal tracking. Context-aware tags (weather/formality/fit penalties separately).

### Step 2: Seasonal Color Palette ✅
Color harmony awards bonus when chromatic colors match the current season's palette (warm earth tones in autumn, cool pastels in spring, jewel tones in winter, fresh brights in summer).

### Step 3: Material Affinity Matrix ✅
Full 5×5 affinity scoring between material groups (refined, casual, technical, rugged, knit). Replaces simple clash detection with nuanced compatibility scoring.

### Step 4: Weather Microclimate Intelligence ✅
6 temperature bands using feels-like temp (wind chill). Wind awareness, precipitation-specific penalties (suede in rain), breathability scoring, layering piece detection, boot/sandal weather logic.

### Step 5: Occasion Intelligence ✅
30+ occasion types with style hints and confidence scoring. Expanded calendar keyword mapping. Style direction fed to AI refinement prompt.

---

## Phase 2: Personal Style DNA 🔲

### Step 6: Multi-Dimensional Style Vector ✅
Behavioral style embedding built from wear_logs: color temperature (-1 cool to +1 warm), formality center, pattern tolerance, material group affinities, category diversity, neutral-vs-chromatic ratio. Confidence-weighted so quiz preferences fade as real usage data grows.

### Step 7: Wear Pattern Analysis ✅
Track day-of-week and seasonal correlations. Analyzes 6 months of wear_logs to detect per-garment day affinity, seasonal preference, category-by-day patterns, and color-by-season trends. Feeds a `wearPatternScore` (12% weight) into composite scoring.

### Step 8: Comfort vs Style Learning ✅
Observe which garments get re-worn frequently (comfort signals) vs which get high ratings but low rewear (aspiration pieces). Builds a per-garment comfort/aspiration signal and detects user tendency. Feeds a `comfortStyleScore` (10% weight) into composite scoring, balancing both signals based on user behavior.

### Step 9: Color Temperature Profiling ✅
Automatically detects if user gravitates toward warm palette (earth tones, reds, oranges) or cool palette (blues, greys, lavender). Surfaces a visual color temperature widget on the Insights dashboard with gradient indicator, percentage breakdown, and palette label. Premium-gated.

### Step 10: Body-Aware Fit Intelligence ✅
Use height/weight data + fit preferences to build a BodyProfile. Applies proportional balance rules (e.g., oversized top + slim bottom), body-type fit preferences, and height-aware volume adjustments. Feeds a `fitProportionScore` (10% weight) into combo scoring.

---

## Phase 3: Contextual Intelligence 🔲

### Step 11: Multi-Event Day Planning ✅
For days with multiple calendar events (e.g., work meeting → gym → dinner), suggest outfit transitions or versatile pieces that work across contexts. The `summarize_day` edge function now returns a `transitions` object with time blocks, per-block style tips, transition tips between blocks, and versatile pieces. The `DaySummaryCard` renders a visual timeline with per-block generate buttons.

### Step 12: Travel Capsule Generation ✅
Given a trip duration + destination weather, the `travel_capsule` edge function selects the minimum garments from the user's wardrobe that maximize outfit combinations. A dedicated `/plan/travel-capsule` page lets users input destination, duration, and occasions. Results show a visual packing grid, day-by-day outfit plan with expandable details, and AI packing tips. Accessible via luggage icon in Plan header.

### Step 13: Social Context Awareness ✅
Track what was worn to events with recurring attendees. Added `event_title` column to `wear_logs`. When marking an outfit as worn, the top calendar event title is stored. The style engine normalizes event titles to detect recurring events (stripping dates/numbers) and applies a garment penalty (0.5-1.5 score points) when a piece was recently worn at the same recurring event. Stronger penalties for more recent repeats (< 2 weeks: 3×, < 1 month: 2×, < 2 months: 1×).

### Step 14: Laundry Cycle Integration ✅
Garments marked as in-laundry are automatically excluded from outfit generation (style engine filters `in_laundry = false`). A `useLaundryCycle` hook detects garments in laundry that are needed for upcoming planned outfits. The `LaundryAlertBanner` component on the Plan page warns users to wash specific garments before their planned date. The style engine now returns laundry metadata (count + items) in its response for client-side awareness. Translations added for sv/en.

### Step 15: Seasonal Transition Intelligence
During season changes (spring→summer), gradually shift suggestions. Detect transitional garments that bridge seasons.

---

## Phase 4: Visual & Advanced Intelligence 🔲

### Step 16: AI Flat-Lay Preview
Generate visual flat-lay mockups of suggested outfits using garment images.

### Step 17: Photo Feedback Loop
Let users snap a mirror selfie wearing the outfit. AI compares actual look to expectation and refines future suggestions.

### Step 18: Garment Condition Tracking
AI detects wear-and-tear from photos over time. Suggest replacing garments showing age.

### Step 19: Outfit DNA Cloning
When user loves an outfit, analyze its DNA (color ratios, formality balance, material mix) and generate similar-but-different variations.

### Step 20: Smart Accessory Pairing
Dedicated accessory intelligence: match scarves, watches, bags, jewelry to outfit mood and color palette.

---

## Phase 5: Ecosystem & Monetization 🔲

### Step 21: Wardrobe Gap Analysis
AI identifies missing pieces that would "unlock" the most new outfit combinations. E.g., "Adding a white sneaker would create 12 new outfits."

### Step 22: Cost-Per-Wear Tracking
Calculate value of each garment based on purchase price ÷ times worn. Surface insights about best and worst investments.

### Step 23: Sustainability Score
Track wardrobe utilization rate, highlight underused items, encourage rewearing, show environmental impact of outfit rotation.

### Step 24: Style Evolution Timeline
Visualize how user's style has evolved over time: color shifts, formality changes, new categories explored.

### Step 25: Predictive Styling
Predict what user will want to wear tomorrow based on historical patterns, upcoming calendar, weather forecast, and recent outfit history. Pre-generate suggestion before they even open the app.

---

## Previous Completed Work

### Localized Pricing — ✅ DONE
All pricing surfaces use `src/lib/localizedPricing.ts` for locale-appropriate amounts. Stripe checkout maps locale → currency-specific Price IDs.
