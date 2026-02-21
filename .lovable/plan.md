

## iOS Safari Glass UI for the App

### What Changes
Transform the in-app experience with frosted glass (glassmorphism) effects and smooth micro-animations inspired by Safari on iOS. This touches five key areas:

### 1. Bottom Navigation Bar (Safari Tab Bar Style)
**File: `src/components/layout/BottomNav.tsx`**
- Replace the solid `bg-background/95` with a translucent frosted glass: `bg-background/60 backdrop-blur-xl backdrop-saturate-150`
- Remove the hard `border-t` and replace with a subtle `shadow-[0_-1px_0_0_rgba(0,0,0,0.04)]` (light) / `shadow-[0_-1px_0_0_rgba(255,255,255,0.06)]` (dark)
- Active tab indicator: add a soft glass pill behind the active icon+label group using a scaled background div with `bg-accent/8 backdrop-blur-sm rounded-2xl`
- Add a smooth `transition-all duration-300` on the active indicator so it glides between tabs

### 2. Tab Switchers (Segmented Control Style)
**File: `src/pages/Home.tsx` (lines 280-305)**
- Restyle the Create/Insights tab switcher to look like an iOS segmented control
- Container: `bg-foreground/[0.04] backdrop-blur-sm rounded-2xl p-1 border border-border/30`
- Active segment: `bg-background/80 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.08)] rounded-xl` with a smooth `transition-all duration-200`

**File: `src/components/ui/tabs.tsx`**
- Update the default `TabsList` styling to match: frosted glass container with `backdrop-blur-sm`
- Update `TabsTrigger` active state: glass pill with soft shadow
- This automatically upgrades the Outfits page tabs (Recent/Saved/Planned) and any other tabs usage

### 3. Page Header (Frosted Top Bar)
**File: `src/components/layout/PageHeader.tsx`**
- Upgrade from `bg-background/95 backdrop-blur-sm` to `bg-background/70 backdrop-blur-xl backdrop-saturate-150`
- Replace `border-b` with a softer divider: `shadow-[0_0.5px_0_0_hsl(var(--border)/0.5)]`
- This gives it the Safari address bar feel

### 4. Cards and Interactive Elements
**File: `src/index.css`**
- Add a new `.glass-card` utility class: `bg-card/80 backdrop-blur-md border border-border/40 shadow-sm`
- Add `.glass-chip` for filter/style pills: `bg-background/60 backdrop-blur-sm border border-border/30`
- Add smooth `transition-all duration-200` on interactive press states

### 5. Page Transition Animations
**File: `src/index.css`**
- Add CSS classes for content fade-in when switching tabs: `.tab-content-enter` with `opacity 0 -> 1` and subtle `translateY(6px) -> 0` over 250ms
- Apply to tab content areas for a polished feel when switching between Create/Insights and Recent/Saved/Planned

### Technical Details

All changes are pure CSS + Tailwind classes. No new dependencies needed.

Key CSS properties used:
- `backdrop-filter: blur(24px) saturate(1.5)` for the frosted glass
- `background: hsl(var(--background) / 0.6)` for translucency
- `transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1)` for smooth state changes
- Soft box-shadows instead of hard borders for depth

Files modified:
- `src/components/layout/BottomNav.tsx`
- `src/components/layout/PageHeader.tsx`
- `src/components/ui/tabs.tsx`
- `src/pages/Home.tsx`
- `src/index.css`

