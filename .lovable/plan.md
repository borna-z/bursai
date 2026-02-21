
# Premium Glass UI Overhaul -- All Pages

## Goal
Bring every in-app page to the same premium "space noir glass" level as the Auth page. This means updating buttons, cards, inputs, chips, tabs, settings rows, and action surfaces to use the glass vocabulary: `border-white/[0.08]`, `bg-white/[0.04]`, `backdrop-blur-xl`, `text-white/80`, rounded-xl, and subtle white-opacity borders instead of CSS-variable-based borders.

## Strategy
Update the **shared design primitives** (Button, Card, Badge, SettingsGroup, SettingsRow, Input, Select) so that every page automatically inherits the glass look. Then make targeted fixes on page-specific elements like occasion grids, filter chips, tab switchers, and FABs.

---

## Phase 1 -- Core Primitives (cascades everywhere)

### 1.1 Button (`src/components/ui/button.tsx`)
- **default** variant: Change from `bg-primary text-primary-foreground` to a solid white pill: `bg-white text-[#030305] hover:bg-white/90 rounded-full font-semibold`
- **outline** variant: Change to glass style: `border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm text-white/80 hover:bg-white/[0.08]`
- **secondary** variant: `bg-white/[0.06] backdrop-blur-sm text-white/70 hover:bg-white/[0.1]`
- **ghost** variant: `hover:bg-white/[0.06] text-white/60 hover:text-white/80`
- **destructive** variant: `bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20`
- Add `dark:` prefix to all glass styles so light mode still works with current styling

### 1.2 Card (`src/components/ui/card.tsx`)
- Update default card class to glass surface: `rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] text-card-foreground`
- Use `dark:` prefix to preserve light mode

### 1.3 Badge (`src/components/ui/badge.tsx`)
- **default**: `bg-white/[0.1] text-white/80 border-white/[0.08]`
- **secondary**: `bg-white/[0.06] text-white/60 border-white/[0.06]`
- **outline**: `bg-transparent border-white/[0.1] text-white/70`

### 1.4 Input (`src/components/ui/input.tsx`)
- Update to match Auth page inputs: `border border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/20 focus:ring-1 focus:ring-white/20`
- Dark-mode specific with `dark:` prefix

### 1.5 SettingsGroup (`src/components/settings/SettingsGroup.tsx`)
- Replace `bg-card/70 backdrop-blur-md border-border/30` with glass: `bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]`
- Title text: `text-white/40` in dark mode

### 1.6 SettingsRow (`src/components/settings/SettingsRow.tsx`)
- Border divider: `border-white/[0.06]` instead of `border-border/50`
- Label text already uses `text-foreground` which will be white in dark mode
- Icon color: keep accent for clickable rows

---

## Phase 2 -- Page-Specific Elements

### 2.1 Home Page (`src/pages/Home.tsx`)
- **Tab switcher**: Replace `bg-foreground/[0.04]` with `bg-white/[0.04] border border-white/[0.06]` and active tab to `bg-white/[0.1] text-white`
- **Occasion grid buttons**: Unselected state to `border-white/[0.08] bg-white/[0.04] text-white/70`; selected: `border-accent bg-accent/10 text-accent`
- **Style chips**: Same glass treatment as occasion buttons
- **Generate CTA**: Already using `bg-accent`; change to white pill: `bg-white text-[#030305] rounded-full hover:bg-white/90`
- **Stat cards** (insights): Will inherit from Card glass update
- **Onboarding nudge**: `bg-white/[0.04] border-white/[0.08]`

### 2.2 Wardrobe Page (`src/pages/Wardrobe.tsx`)
- **Tab switcher**: Same glass treatment as Home
- **Garment card (grid)**: Will inherit from `glass-card` utility -- update `glass-card` in CSS to: `bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]`
- **Garment card (list)**: Same via `glass-card`
- **Category grid buttons**: `bg-white/[0.04]` unselected, `bg-accent/10 text-accent` selected
- **Color/season filter chips**: `bg-white/[0.04]` instead of `bg-muted/30`
- **FAB buttons**: Scan button: `bg-white/[0.06] border-white/[0.08]`; Add button: keep `bg-accent`
- **Bulk action bar**: Will inherit via `glass-card`
- **Search input**: Will inherit from Input update

### 2.3 Plan Page (`src/pages/Plan.tsx`)
- **Sticky header**: Already using `backdrop-blur-xl`, update border to `border-white/[0.06]`
- **Action buttons** (Swap, Details): Will inherit from Button outline update
- **Empty state icon container**: `bg-white/[0.04]` instead of `bg-muted/30`
- **Outfit image grid**: Will inherit via `glass-card`

### 2.4 AI Chat / Stylist (`src/pages/AIChat.tsx`)
- **Header**: Already using `backdrop-blur-xl`, update border to `border-white/[0.06]`
- **Mode switcher**: Same glass tab treatment: `bg-white/[0.04] border-white/[0.06]`, active: `bg-white/[0.1]`
- **Menu button**: Will inherit from ghost Button update

### 2.5 Settings Page (`src/pages/Settings.tsx`)
- Will automatically inherit from SettingsGroup + SettingsRow updates
- Sign-out row: destructive text stays, glass surface cascades

### 2.6 Settings Sub-pages (Appearance, Account, Style, etc.)
- Will automatically inherit from SettingsGroup, SettingsRow, Input, Button, Select updates

### 2.7 Insights Page (`src/pages/Insights.tsx`)
- Stat cards: Will inherit from Card glass update
- Premium banner: Update gradient to glass: `bg-white/[0.04] border-white/[0.08]`
- CTA button at bottom: Will inherit from default Button update

---

## Phase 3 -- Global CSS Utilities (`src/index.css`)

### 3.1 Update `.glass-card`
From: `bg-card/70 backdrop-blur-md border border-border/40 shadow-...`
To (dark only): `dark:bg-white/[0.04] dark:backdrop-blur-xl dark:border-white/[0.08] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]`

### 3.2 Update `.glass-chip`
From: `bg-background/50 backdrop-blur-sm border border-border/30`
To (dark only): `dark:bg-white/[0.04] dark:border-white/[0.08]`

### 3.3 Update `.glass-surface`
From: `bg-background/70 backdrop-blur-xl`
To (dark only): `dark:bg-[#030305]/80 dark:backdrop-blur-xl`

---

## Summary

| Layer | Files | Impact |
|-------|-------|--------|
| Core Primitives | button, card, badge, input, settings-group, settings-row | Cascades to ALL pages |
| Global CSS | index.css (glass utilities) | Cascades to all `glass-card` usages |
| Page-specific | Home, Wardrobe, Plan, AIChat, Insights | Tab switchers, chips, FABs |
| Auto-inheriting | Settings, sub-pages, modals, sheets | Zero changes needed |

**Total files to modify: ~11**
All changes use `dark:` prefixes to preserve light mode compatibility.
