

# Layout and UI Overhaul -- Clean, Minimalist, Futuristic, Premium

A systematic pass through every screen to tighten spacing, simplify visual noise, unify card styles, and create a cohesive "less is more" premium feel.

---

## Design Principles

- **Reduce visual clutter**: fewer borders, lighter dividers, more whitespace
- **Unified card language**: one card style everywhere -- no border, ultra-subtle shadow, clean radius
- **Consistent spacing rhythm**: 8-16-24-32 grid strictly followed
- **Typography hierarchy**: bigger contrast between heading sizes, lighter body text
- **Monochrome-first**: accent color used sparingly (only interactive elements and key data)
- **Larger touch targets**: min 44px for all tappable elements
- **Breathing room**: generous padding, no cramped layouts

---

## 1. Global Foundation Changes

### Card Component (`src/components/ui/card.tsx`)
- Remove `border-border/40` -- use borderless cards with a soft shadow only
- New default: `rounded-2xl bg-card shadow-[0_1px_2px_0_rgb(0_0_0/0.03),0_1px_6px_0_rgb(0_0_0/0.02)]`
- Remove backdrop-blur from base card (reserve glass for nav/headers only)

### Button Component (`src/components/ui/button.tsx`)
- Change default border-radius from `rounded-lg` to `rounded-xl` for a softer, more modern feel
- Increase default height from `h-11` to `h-12` for better touch targets
- Make outline variant borderless with just a subtle background tint: `bg-foreground/[0.04] hover:bg-foreground/[0.08]`

### Section Header (`src/components/ui/section-header.tsx`)
- Change from uppercase to sentence case for a calmer feel
- Use `text-[11px] font-medium text-muted-foreground/70 tracking-wide` instead of `tracking-widest` + uppercase

### EmptyState (`src/components/layout/EmptyState.tsx`)
- Larger icon container: `w-20 h-20 rounded-3xl`
- Softer background: `bg-muted/30`
- More vertical padding: `py-24`

### Index CSS (`src/index.css`)
- Add a new utility `.card-clean` for borderless elevated cards
- Refine `.glass` to use `bg-background/80 backdrop-blur-xl` (from `backdrop-blur-md`)
- Add `.divider-subtle` as `border-border/20` for ultra-light section dividers

---

## 2. Bottom Navigation (`src/components/layout/BottomNav.tsx`)
- Reduce height from `h-[72px]` to `h-[64px]` -- less visual weight
- Make background more transparent: `bg-background/50`
- Remove the active dot indicator (simplify to just pill + scale)
- Make label text slightly larger: `text-[11px]` (from `text-[10px]`)

## 3. Page Header (`src/components/layout/PageHeader.tsx`)
- Remove the shadow line (`shadow-[0_0.5px_0...]`) -- use a barely-visible border instead: `border-b border-border/20`
- Reduce blur intensity slightly for performance
- Make title `text-lg` instead of `text-xl` for a lighter header feel

---

## 4. Home Page (`src/pages/Home.tsx`)

### Greeting
- Change to `text-xl` from `text-2xl` -- more restrained, elegant
- Remove the accent line under the greeting (visual noise)

### Tab Switcher
- Simplify: remove border, use just background tint difference
- Active tab: `bg-foreground/[0.06]` instead of complex glass effect
- Reduce padding: `py-2` from `py-2.5`

### Occasion Grid
- Change from `grid-cols-3` to `grid-cols-2` for larger, more breathable cards
- Increase vertical padding: `py-5` from `py-3.5`
- Remove inner shadow on selected state -- just a clean accent border
- Slightly larger icons: `w-6 h-6` from `w-5 h-5`

### Style Chips
- Increase padding: `px-4 py-2` from `px-3.5 py-1.5`
- Borderless design: just a subtle background tint

### Generate Button
- Remove the breathe-pulse animation (distracting)
- Full-width with `h-14` for a statement CTA
- Add subtle icon: keep Sparkles but at `w-5 h-5`

### Insights Section (Home)
- Stat cards: remove glass-card class, use clean borderless cards
- Increase stat number size to `text-3xl` from `text-2xl`
- Remove colored accent on usage percentage -- keep monochrome

---

## 5. Wardrobe Page (`src/pages/Wardrobe.tsx`)

### Grid Cards
- Remove inner shadow (`shadow-[inset_...]`)
- Increase image aspect ratio from `aspect-square` to `aspect-[3/4]` for a fashion-magazine feel
- Increase gap from `gap-4` to `gap-3` (slightly tighter grid looks more editorial)
- Remove glass-card class -- use clean borderless card style
- Title typography: `text-[13px] font-medium` (slightly smaller, more refined)

### List View Cards
- Remove glass-card -- use borderless with subtle separator
- Increase image size: `w-16 h-16` from `w-14 h-14`
- Add `rounded-xl` to images from `rounded-lg`

### Filter Bar
- Simplify the collapsible filter section
- Use chip-style filters instead of Select dropdowns for a more visual approach
- Category tabs: horizontal scroll with pill-shaped buttons

---

## 6. Plan Page (`src/pages/Plan.tsx`)

### Header
- Simplify: just the date text and wand icon, no calendar icon next to date
- Date text: `text-base font-medium` (from `text-lg font-semibold`) -- calmer

### Day Content
- Outfit image grid: change from `grid-cols-2 gap-px` to `grid-cols-2 gap-1 p-1` for visible spacing between items
- Round inner images: `rounded-xl` for each item
- Remove the glass-card wrapper around the outfit grid -- make it borderless

### Action Buttons
- Stack vertically instead of side-by-side for cleaner layout
- Use ghost buttons with subtle dividers between them

### Empty State
- Simplify: just one CTA button (Generate), remove the secondary "Plan" button
- Larger icon container with softer visual

---

## 7. AI Chat (`src/pages/AIChat.tsx`)

### Header
- Simplify mode switcher: use just text tabs with an underline indicator (no background pills)
- Remove the background border/glass effect

### Welcome Screen
- Larger icon: `w-20 h-20` with `rounded-3xl`
- Welcome text: `text-base` from `text-sm` for better readability
- Suggestion pills: increase padding and make them borderless with background tint

### Messages
- Increase spacing between messages: `space-y-6` from `space-y-5`
- User messages: clean right-aligned bubble with `bg-foreground text-background rounded-2xl rounded-br-md`
- Assistant messages: left-aligned, no bubble background, just text

---

## 8. Settings Page (`src/pages/Settings.tsx`)

### Profile Card
- Make it larger and more prominent: full-width with more padding
- Avatar: `w-14 h-14` from `w-12 h-12`
- Name: `text-base font-semibold` from `text-sm`

### Settings Rows
- Remove the icon background circles (simpler, cleaner)
- Just the raw icon in muted-foreground color
- Increase row height to `py-4` from `py-3`
- Remove bottom borders entirely -- use spacing between rows instead

### Settings Group
- Remove border/card wrapper -- just use spacing to separate groups
- Add a thin divider between groups: `border-b border-border/10`

---

## 9. Detail Pages

### Garment Detail (`src/pages/GarmentDetail.tsx`)
- Image: add `rounded-2xl` with slight margin for breathing room
- Badge chips: increase padding, borderless with background tint
- Stats cards: side-by-side borderless with clean typography
- Remove card wrappers around individual sections -- use spacing

### Outfit Detail (`src/pages/OutfitDetail.tsx`)
- Slot cards: borderless, larger images
- Rating stars: increase size to `w-8 h-8`
- Feedback chips: larger, more padding, borderless

### Insights (`src/pages/Insights.tsx`)
- Stat cards: borderless, clean large numbers
- Section cards: remove borders, use spacing and subtle shadows only
- Color distribution: cleaner bar chart visualization

---

## 10. Onboarding + Auth

### Auth Page
- Already has good dark aesthetic -- keep as-is
- Just ensure button sizes match the new `h-12` standard

---

## Technical Summary

### Files to modify:
1. `src/components/ui/card.tsx` -- borderless cards
2. `src/components/ui/button.tsx` -- rounded-xl, h-12
3. `src/components/ui/section-header.tsx` -- sentence case, lighter
4. `src/components/layout/EmptyState.tsx` -- larger, softer
5. `src/components/layout/BottomNav.tsx` -- shorter, cleaner
6. `src/components/layout/PageHeader.tsx` -- lighter header
7. `src/components/settings/SettingsRow.tsx` -- remove icon circles, more padding
8. `src/components/settings/SettingsGroup.tsx` -- borderless groups
9. `src/components/settings/ProfileCard.tsx` -- larger profile
10. `src/components/chat/ChatWelcome.tsx` -- larger welcome
11. `src/pages/Home.tsx` -- occasion grid cols-2, remove noise
12. `src/pages/Wardrobe.tsx` -- editorial grid, borderless cards
13. `src/pages/Plan.tsx` -- simplified layout
14. `src/pages/AIChat.tsx` -- cleaner chat chrome
15. `src/pages/Settings.tsx` -- spacing-based groups
16. `src/pages/GarmentDetail.tsx` -- borderless sections
17. `src/pages/OutfitDetail.tsx` -- cleaner detail layout
18. `src/pages/Insights.tsx` -- borderless stat cards
19. `src/index.css` -- new utility classes

### No new dependencies needed.

### Risk: Low
All changes are visual/layout only. No data flow or business logic is affected.

