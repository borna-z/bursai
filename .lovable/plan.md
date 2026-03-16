# BURS Prompt Pack v2 — Full Roadmap (33 Tasks + Intelligence Blueprint)

**Global rule:** BURS must remain on Lovable. Use burs.me/welcome as the visual source of truth.

---

## Phase 1 — Foundation ✅

| Task | Title | Status |
|------|-------|--------|
| 1 | Full product audit | ✅ Done |
| 2 | Unify the design system | ✅ Done |
| 3 | Premium app feel pass | ✅ Done |
| 4 | Protect critical flows while refactoring | ✅ Done |

## Phase 2 — Core Stylist Quality ✅

| Task | Title | Status |
|------|-------|--------|
| 5 | Best-in-class scan flow | ✅ Done |
| 6 | Expand garment intelligence | ✅ Done |
| 7 | Real outfit engine experience | ✅ Done |
| 8 | Hard outfit quality rules | ✅ Done |
| 9 | Editorial result screen | ✅ Done |
| 10 | Smart swaps | ✅ Done |
| 11 | Elite stylist chat | ✅ Done |
| 12 | Sharper stylist language system | ✅ Done |

## Phase 3 — Personalization ✅

| Task | Title | Status |
|------|-------|--------|
| 13 | Stronger style profile | ✅ Done |
| 14 | Better onboarding | ✅ Done |
| 15 | Better feedback learning | ✅ Done |
| 16 | Personal uniform / style DNA | ✅ Done |
| 17 | Make the app feel like a stylist, not a tool | ✅ Done |

## Phase 4 — Retention and Habit ✅

| Task | Title | Status |
|------|-------|--------|
| 18 | Weekly stylist planner | ✅ Done |
| 19 | Daily "What should I wear?" flow | ✅ Done |
| 20 | High-end wardrobe insights | ✅ Done |
| 21 | Wardrobe health dashboard | ✅ Done |
| 22 | Retention loops | ✅ Done |

## Phase 5 — Premium Conversion and Trust ✅

| Task | Title | Status |
|------|-------|--------|
| 23 | Real Stylist Mode | ✅ Done |
| 24 | Stronger premium subscription experience | ✅ Done |
| 25 | Trust pass | ✅ Done |
| 26 | Reduce feature chaos | ✅ Done |

## Phase 6 — Final Polish ✅

| Task | Title | Status |
|------|-------|--------|
| 27 | Premium empty states | ✅ Done |
| 28 | Premium loading states | ✅ Done |
| 29 | Make the app feel more native | ✅ Done |
| 30 | World-class garment detail screen | ✅ Done |
| 31 | Lookbook-level visual polish | ✅ Done |
| 32 | Full polish pass | ✅ Done |
| 33 | Final 90+ market-leader pass | ✅ Done |

---

## Intelligence Blueprint — AI Stylist Upgrade

### IB Phase 1 — Unlock Enrichment Data in Style Engine ✅

| Task | Title | Status |
|------|-------|--------|
| IB-1a | Expand GarmentRow with enrichment fields (silhouette, visual_weight, texture_intensity, layering_role, versatility_score, occasion_tags, style_archetype) | ✅ Done |
| IB-1b | Hydrate enrichment from ai_raw with safe defaults | ✅ Done |
| IB-1c | Upgrade scoreGarment: occasion tag matching, layering role vs weather, versatility boost | ✅ Done |
| IB-1d | Upgrade scoreCombo: silhouette balance scoring, texture depth scoring | ✅ Done |
| IB-1e | Add texture monotony rule to quality gate | ✅ Done |

### IB Phase 2 — Travel Capsule Constrained Optimizer ✅

| Task | Title | Status |
|------|-------|--------|
| IB-2a | Score pack-worthiness per garment (versatility, material, weather, pairing potential) | ✅ Done |
| IB-2b | Pre-filter to top 40 most packable garments before AI call | ✅ Done |
| IB-2c | Matrix coverage validation after AI response | 🔲 Todo |

### IB Phase 3 — Planner Week Intelligence ✅

| Task | Title | Status |
|------|-------|--------|
| IB-3a | Add plan_week mode to style engine (sequential generation with used_garments carry-forward) | ✅ Done |
| IB-3b | Inter-day repetition penalty (hero garments heavy, accessories light) | ✅ Done |
| IB-3c | Formality variation across planned days | ✅ Done |
| IB-3d | Expose backup outfit (2nd-ranked combo) per day | ✅ Done |
| IB-3e | Laundry-aware generation with dirty garment warnings | ✅ Done |

### IB Phase 4 — Chat Intelligence Upgrade

| Task | Title | Status |
|------|-------|--------|
| IB-4a | Include enrichment data in wardrobe context sent to chat | 🔲 Todo |
| IB-4b | Add wardrobe composition summary (style clusters, gaps) | 🔲 Todo |
| IB-4c | Include recent rejection/swap context in chat prompt | 🔲 Todo |

### IB Phase 5 — Learning & Signal Refinement

| Task | Title | Status |
|------|-------|--------|
| IB-5a | Track rejection reasons (swapped garment + slot, ignored outfits) | 🔲 Todo |
| IB-5b | Weight "wore it" 3x over "saved it", add planned-but-not-worn negative signal | 🔲 Todo |
| IB-5c | Personal uniform detection (>60% same silhouette formula → boost) | 🔲 Todo |

### IB Phase 6 — UI Trust & Polish

| Task | Title | Status |
|------|-------|--------|
| IB-6a | Audit and fix raw enum/key exposure in UI (occasion labels, categories) | 🔲 Todo |
| IB-6b | Per-attribute confidence indicators on garment detail | 🔲 Todo |
| IB-6c | Editorial formatting for limitation_note and gap strings | 🔲 Todo |

---

## Intelligence Blueprint Priority Order

| Phase | Scope | Risk | Priority |
|-------|-------|------|----------|
| IB-1 | Style engine enrichment | Low — additive scoring | ✅ Complete |
| IB-2 | Travel capsule optimizer | Medium — changes AI input | ✅ Complete (validation pending) |
| IB-3 | Planner week intelligence | Medium — new mode | ✅ Complete |
| IB-4 | Chat intelligence | Low — prompt changes | Medium |
| IB-5 | Learning refinement | Low — additive | Medium |
| IB-6 | UI polish | Low — frontend only | Medium |
