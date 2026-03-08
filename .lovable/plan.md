
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

### Step 6: Multi-Dimensional Style Vector
Build a style embedding from user behavior: what they wear, when, what they rate highly. Track dimensions like color temperature preference, formality comfort zone, pattern tolerance, material affinity.

### Step 7: Wear Pattern Analysis
Track day-of-week and seasonal correlations. Learn that user wears casual on Fridays, always picks dark colors in winter, prefers light layers in spring.

### Step 8: Comfort vs Style Learning
Observe which garments get re-worn frequently (comfort signals) vs which get high ratings but low rewear (aspiration pieces). Balance both in suggestions.

### Step 9: Color Temperature Profiling
Automatically detect if user gravitates toward warm palette (earth tones, reds, oranges) or cool palette (blues, greys, lavender). Weight suggestions accordingly.

### Step 10: Body-Aware Fit Intelligence
Use height/weight data + fit preferences to recommend proportionally balanced outfits (e.g., oversized top + slim bottom).

---

## Phase 3: Contextual Intelligence 🔲

### Step 11: Multi-Event Day Planning
For days with multiple calendar events (e.g., work meeting → gym → dinner), suggest outfit transitions or versatile pieces that work across contexts.

### Step 12: Travel Capsule Generation
Given a trip duration + destination weather, generate a minimal set of garments that creates maximum outfit combinations.

### Step 13: Social Context Awareness
Track what was worn to events with recurring attendees (weekly team meetings, friend dinners). Avoid repeating outfits in front of the same people.

### Step 14: Laundry Cycle Integration
Factor in laundry schedules: suggest outfits from clean garments, predict when favorites will be available again, suggest wash timing.

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
