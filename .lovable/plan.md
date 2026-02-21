

# Glass UI Enhancement -- PWA App Pages

## Overview

The core UI primitives (Card, Sheet, Dialog, Button, Input, etc.) already have glassmorphism from the previous update. However, many pages and components use **inline hardcoded styles** that bypass the glass primitives. This plan targets those inline styles to make every surface in the PWA feel consistently frosted and premium.

## What Needs Glass Treatment

### 1. Home Page (`src/pages/Home.tsx`)

**Onboarding nudge button (line 267):** Uses `bg-card` (solid). Change to `glass-card rounded-xl`.

**Occasion buttons (line 327-336):** Unselected state uses `bg-card` (solid). Change to `bg-card/70 backdrop-blur-sm`.

**Sub-option pills (line 351-356):** Unselected state uses `bg-card`. Change to `bg-card/70 backdrop-blur-sm`.

**Style pills (line 373-378):** Unselected state uses `bg-card`. Change to `bg-card/70 backdrop-blur-sm`.

**Stat cards (lines 102, 108, 114):** Use `bg-muted/30`. Change to `bg-muted/20 backdrop-blur-sm`.

### 2. Plan Page (`src/pages/Plan.tsx`)

**Sticky header (line 212):** Uses `bg-background/95 backdrop-blur-sm`. Upgrade to `bg-background/70 backdrop-blur-xl backdrop-saturate-150` matching PageHeader.

**Empty state icon container (line 373):** Uses `bg-muted/40`. Change to `bg-muted/30 backdrop-blur-sm`.

### 3. Weather Widget (`src/components/weather/WeatherWidget.tsx`)

**Main container (lines 107, 130):** Uses solid `bg-card` with `border-border`. Change to `glass-card rounded-2xl` for consistency.

**Icon container (line 135):** Uses `bg-muted/50`. Change to `bg-muted/30 backdrop-blur-sm`.

### 4. AI Chat Page (`src/pages/AIChat.tsx`)

**Chat header (line 271):** Uses `bg-background/95 backdrop-blur-sm`. Upgrade to `bg-background/70 backdrop-blur-xl backdrop-saturate-150`.

**Mode switcher container (line 274):** Uses `bg-muted/60`. Change to `bg-foreground/[0.04] backdrop-blur-sm border border-border/30` to match the Home page tab switcher.

**Mode switcher active tab (lines 279, 290):** Uses `bg-background`. Change to `bg-background/80 backdrop-blur-md shadow-sm`.

### 5. Chat Input (`src/components/chat/ChatInput.tsx`)

**Input container (line 45):** Uses `border-border/80 bg-background`. Change to `border-border/50 bg-background/60 backdrop-blur-md`.

### 6. Chat Welcome (`src/components/chat/ChatWelcome.tsx`)

**Suggestion buttons (line 28):** Uses `border-border bg-background`. Change to `border-border/40 bg-background/50 backdrop-blur-sm`.

**Icon container (line 17):** Uses `bg-accent/10`. Change to `bg-accent/8 backdrop-blur-sm`.

### 7. Insights Page (`src/pages/Insights.tsx`)

**Stat cards (lines 165, 171):** Use gradient + solid backgrounds. Add `backdrop-blur-sm` and soften with `/70` opacity.

**Premium upsell card (line 152):** Uses `bg-gradient-to-br from-primary/10`. Add `backdrop-blur-sm`.

### 8. AI Suggestions (`src/components/insights/AISuggestions.tsx`)

**Suggestion card (line 110):** Uses `bg-muted/30 border-border/50`. Change to `bg-card/50 backdrop-blur-sm border-border/40`.

**Explanation text bg (line 174):** Uses `bg-background/50`. Already semi-transparent -- add `backdrop-blur-sm`.

### 9. Outfit Detail (`src/pages/OutfitDetail.tsx`)

**Sticky header (lines 174, 203):** Uses `bg-background/80 backdrop-blur-sm`. Upgrade to `bg-background/70 backdrop-blur-xl backdrop-saturate-150`.

**Swap candidates (line 51):** Uses solid `bg-secondary`. Change to `bg-secondary/60 backdrop-blur-sm`.

### 10. Paywall Modal (`src/components/PaywallModal.tsx`)

**Feature rows (lines 47, 56, 65):** Use solid `bg-secondary`. Change to `bg-secondary/60 backdrop-blur-sm`.

### 11. Add Garment Page (`src/pages/AddGarment.tsx`)

**Upload buttons section:** The camera/gallery buttons already use Button primitives (glass via previous update). No changes needed.

**Analyzing step preview (line 438):** Uses `bg-secondary`. Change to `bg-secondary/60 backdrop-blur-sm`.

### 12. Wardrobe Page (`src/pages/Wardrobe.tsx`)

**Bulk select bar (line 382):** Uses solid `bg-card`. Change to `glass-card`.

**Color filter buttons (line 329-333):** Unselected uses `bg-muted/50`. Change to `bg-muted/30 backdrop-blur-sm`.

**Season filter buttons (line 349-353):** Same as color filters.

### 13. Week Strip (`src/components/plan/WeekStrip.tsx`)

Already clean with transparent states. No changes needed.

### 14. Day Summary Card (`src/components/plan/DaySummaryCard.tsx`)

Already uses `glass-card`. No changes needed.

### 15. Skeleton component loading state in WeatherWidget

**Skeleton container (line 107):** Uses `bg-card border-border`. Change to `glass-card`.

---

## Technical Summary

| # | File | Changes |
|---|------|---------|
| 1 | `src/pages/Home.tsx` | Glass on occasion/style/sub buttons, onboarding nudge, stat cards |
| 2 | `src/pages/Plan.tsx` | Glass sticky header upgrade |
| 3 | `src/components/weather/WeatherWidget.tsx` | Glass container + icon bg |
| 4 | `src/pages/AIChat.tsx` | Glass header + mode switcher |
| 5 | `src/components/chat/ChatInput.tsx` | Glass input container |
| 6 | `src/components/chat/ChatWelcome.tsx` | Glass suggestion buttons |
| 7 | `src/pages/Insights.tsx` | Glass stat cards + upsell |
| 8 | `src/components/insights/AISuggestions.tsx` | Glass suggestion card |
| 9 | `src/pages/OutfitDetail.tsx` | Glass sticky header + swap candidates |
| 10 | `src/components/PaywallModal.tsx` | Glass feature rows |
| 11 | `src/pages/AddGarment.tsx` | Glass analyzing preview |
| 12 | `src/pages/Wardrobe.tsx` | Glass bulk bar + filter buttons |

**Total: 12 files. No new files. No dependency changes. Text-only class changes.**

## Design Principles

- Every surface that sits "above" the background gets `backdrop-blur` + semi-transparent bg
- Consistent use of `border-border/40` (thin, subtle) instead of solid `border-border`
- Active/selected states stay solid or use `accent` for clarity
- Loading skeletons and containers get the same glass treatment
- No changes to the landing page (explicitly excluded)
