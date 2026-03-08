

# Plan: Add 5th "Discover" Tab & Surface Social Features Throughout the App

## Overview

Add a new **Discover** tab (5th in bottom nav) as the central hub for community and social features. Remove social/AI tool links from Settings and instead integrate them naturally across the app.

## Architecture

```text
Bottom Nav (5 tabs):
┌──────┬──────────┬──────┬─────────┬──────────┐
│ Home │ Wardrobe │ Plan │ Stylist │ Discover │
└──────┴──────────┴──────┴─────────┴──────────┘
```

## Changes

### 1. New Discover Hub Page (`src/pages/Discover.tsx`)

A dedicated page with sections:
- **Inspiration Feed** — inline grid of shared community outfits (top section, not a separate page)
- **Active Challenges** — current week's style challenges with join/complete actions
- **AI Tools Quick Access** — visual cards linking to Visual Search, Mood Outfit, Style Twin, Smart Shopping, Wardrobe Aging
- **Your Public Profile** — card showing username setup CTA or link to `/u/:username`
- **Saved Inspiration** — quick link to bookmarked outfits

### 2. Update Bottom Nav (`src/components/layout/BottomNav.tsx`)

- Add 5th tab: `{ path: '/discover', labelKey: 'nav.discover', icon: Compass }`
- Slightly reduce icon/text sizing to fit 5 tabs cleanly

### 3. Update Routes (`src/components/layout/AnimatedRoutes.tsx`)

- Add `/discover` as a protected route pointing to the new Discover page
- Keep `/feed` and `/challenges` as sub-routes accessible from Discover

### 4. Clean Up Settings (`src/pages/Settings.tsx`)

- Remove the "Social" group (Inspiration, Challenges) — now in Discover tab
- Remove the "AI Tools" group — now in Discover tab
- Settings becomes focused: Appearance, Style, Notifications, Account, Privacy, Insights

### 5. Surface Social Elements on Home Page (`src/pages/Home.tsx`)

- Add a "Community Highlights" card showing 2-3 trending outfits from the feed with a "See more" link to Discover
- Add active challenge teaser card if user hasn't joined this week's challenge

### 6. Add Translations

- Add `nav.discover` across all 14 locales
- Add `discover.title`, `discover.trending`, `discover.ai_tools`, `discover.your_profile`, `discover.saved` keys

### 7. Wardrobe Integration

- On outfit detail pages, surface the "Share & Get Reactions" action more prominently to feed the community

## Technical Notes

- The Discover page reuses existing components (`OutfitReactions`, challenge cards) — no new database tables needed
- The feed query from `InspirationFeed.tsx` will be extracted into a reusable hook `useInspirationFeed` so both the Discover hub preview and full feed page can share it
- Bottom nav with 5 tabs: each tab gets `flex-1` which naturally distributes space; text stays at `text-[10px]` to fit

