
# BURS – Next Steps Plan

## Overview
PWA native feel is solid. This plan focuses on landing page conversion, performance, and in-app feature polish.

---

## Phase 1 – Landing Page Conversion Boost

### 1.1 App screenshot in hero
- Add a phone mockup with actual app UI screenshot in the hero section
- Use existing `src/assets/app-screenshot-home.png` in a tilted device frame
- Creates immediate visual trust and shows the product

### 1.2 Social proof section
- Add animated user count or testimonial quotes between Hero and How It Works
- "Join X users styling smarter" with scroll-triggered number animation

### 1.3 FAQ accordion section
- Add before footer with common questions
- "How does AI styling work?", "Is my data private?", "Can I cancel anytime?"
- Good for SEO and reducing bounce

### 1.4 Video or animation showcase
- Short auto-playing loop showing the outfit generation flow
- Replaces static content with dynamic demonstration

---

## Phase 2 – Performance & Polish

### 2.1 Image optimization
- Convert large PNGs to WebP with fallback
- Add explicit `width`/`height` on all images for CLS prevention
- Lazy-load all below-fold images

### 2.2 Lighthouse audit fixes
- Audit accessibility (color contrast, aria labels)
- Optimize LCP by inlining critical CSS for landing page
- Reduce unused JS in initial bundle

### 2.3 Offline experience
- Add service worker for basic offline caching
- Show cached wardrobe data when offline
- Improve the OfflineBanner component

---

## Phase 3 – In-App Feature Improvements

### 3.1 Onboarding flow polish
- Add progress bar and estimated time to style quiz
- Smoother transitions between steps
- Skip option for returning users

### 3.2 Wardrobe UX improvements
- Batch upload multiple garments at once
- Better AI analysis feedback with skeleton loading
- Quick filters: by color, season, category

### 3.3 Outfit generation UX
- "Regenerate" button with memory of rejected suggestions
- Better explanation cards for why an outfit was suggested
- Save/favorite flow improvement

### 3.4 Share outfit improvements
- Polished share card design for social media
- Copy-link with preview
- Instagram story-sized export

### 3.5 Insights dashboard
- Weekly style report with wear statistics
- "Cost per wear" tracking
- Sustainability score visualization

---

## Phase 4 – Growth & Engagement

### 4.1 Push notifications (PWA)
- Outfit suggestion reminders in the morning
- Weather-based alerts ("Rain today – here's a waterproof outfit")

### 4.2 Calendar integration polish
- Better visual calendar with outfit thumbnails
- Drag-and-drop outfit planning

### 4.3 Seasonal wardrobe rotation
- AI suggestions for seasonal swaps
- "Archive" feature for off-season items

---

## Suggested execution order
1. **1.1** App screenshot in hero – highest visual impact, quick win
2. **1.3** FAQ section – SEO + conversion, quick to build
3. **2.1** Image optimization – performance win
4. **3.2** Wardrobe UX – core user experience
5. **3.3** Outfit generation UX – key differentiator
