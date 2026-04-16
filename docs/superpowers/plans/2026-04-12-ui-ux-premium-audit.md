# BURS UI/UX Premium Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate BURS from functional to premium Vogue-like editorial quality with iOS-native UX across navigation, home, insights, and systemic visual fixes.

**Architecture:** 4-phase rollout. Phase 1 creates shared foundations (PageHeader safe areas, CSS tokens, accent color fixes). Phases 2-4 build on those foundations for nav, home hub, and insights dashboard. Each phase produces a shippable PR.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, pure SVG charts (no chart library), CSS custom properties for theming.

**Spec:** `docs/superpowers/specs/2026-04-12-ui-ux-premium-audit-design.md`

---

## File Structure

### Phase 1 — Systemic Fixes
- **Modify:** `src/components/layout/PageHeader.tsx` — add safe area insets, standardize padding
- **Modify:** `src/components/layout/AppLayout.tsx` — update top safe area calculation, reduce dock height CSS var
- **Modify:** `src/index.css` — fix CSS custom properties for light/dark mode, add new tokens
- **Modify:** `src/contexts/ThemeContext.tsx` — fix accent color application, contrast calculation
- **Modify:** `src/pages/Settings.tsx` — iOS grouped list pattern, remove boxy icon containers
- **Modify:** `src/pages/settings/*.tsx` — update any settings sub-pages with same pattern

### Phase 2 — Navigation
- **Modify:** `src/components/layout/BottomNav.tsx` — new layout, icons, compact sizing
- **Modify:** `src/components/layout/BottomNavAddSheet.tsx` — add Bulk Add option, restyle

### Phase 3 — Home Hub
- **Modify:** `src/pages/Home.tsx` — restructure into hub layout with sections
- **Create:** `src/components/home/HomeStylistSection.tsx` — "Your Stylist" 2x2 grid
- **Create:** `src/components/home/HomeDiscoverSection.tsx` — "Discover" 2x2 grid
- **Create:** `src/components/home/HomeSectionHeader.tsx` — Vogue-style uppercase section header

### Phase 4 — Insights Dashboard
- **Modify:** `src/pages/Insights.tsx` — new dashboard layout
- **Create:** `src/components/insights/InsightsHeroStats.tsx` — 3-column stat cards
- **Create:** `src/components/insights/WearFrequencyChart.tsx` — SVG bar chart
- **Create:** `src/components/insights/ColorPaletteBar.tsx` — stacked horizontal bar
- **Create:** `src/components/insights/CategoryDonut.tsx` — SVG donut chart
- **Create:** `src/components/insights/CostPerWearCard.tsx` — progress bars
- **Create:** `src/components/insights/WardrobeHealthRadar.tsx` — SVG radar chart

---

## Phase 1: Systemic Fixes

### Task 1: Fix CSS Custom Properties & Token System

**Files:**
- Modify: `src/index.css:9-100`

- [ ] **Step 1: Read current CSS custom properties**

Run: `head -120 src/index.css` to see current light/dark token definitions.

- [ ] **Step 2: Update light mode tokens**

In `src/index.css`, inside the `:root` block, ensure these tokens exist and are correct:

```css
--background: 34 32% 95%;
--foreground: 24 13% 10%;
--card: 30 32% 98%;
--card-foreground: 24 13% 10%;
--primary: 37 47% 46%;
--primary-foreground: 34 32% 95%;
--secondary: 31 20% 90%;
--secondary-foreground: 24 13% 10%;
--muted: 31 15% 88%;
--muted-foreground: 24 10% 40%;
--accent: 37 47% 46%;
--accent-foreground: 34 32% 95%;
--border: 31 29% 84%;
--ring: 37 47% 46%;
```

- [ ] **Step 3: Update dark mode tokens**

In the `.dark` block, ensure proper contrast values:

```css
--background: 32 12% 6%;
--foreground: 34 32% 95%;
--card: 30 10% 9%;
--card-foreground: 34 32% 95%;
--primary: 37 47% 46%;
--primary-foreground: 34 32% 95%;
--secondary: 30 8% 14%;
--secondary-foreground: 34 32% 90%;
--muted: 30 6% 18%;
--muted-foreground: 34 15% 60%;
--accent: 37 47% 46%;
--accent-foreground: 34 32% 95%;
--border: 30 8% 18%;
--ring: 37 47% 46%;
```

- [ ] **Step 4: Add new design system tokens**

Add below the existing tokens in `:root`:

```css
--app-dock-height: 3.25rem;
--safe-area-top: max(env(safe-area-inset-top, 0px), var(--app-viewport-offset-top, 0px));
--page-px: 20px;
```

Update `.dark` if needed to keep `--app-dock-height` consistent.

- [ ] **Step 5: Run build to verify no breakage**

Run: `npm run build`
Expected: Clean build, no warnings.

- [ ] **Step 6: Commit**

```bash
git checkout -b prompt-1-css-tokens main
git add src/index.css
git commit -m "Prompt 1: Fix CSS custom properties for light/dark mode contrast and add design system tokens"
```

---

### Task 2: Fix PageHeader Safe Areas

**Files:**
- Modify: `src/components/layout/PageHeader.tsx`
- Modify: `src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Read current PageHeader**

Run: `cat -n src/components/layout/PageHeader.tsx`

- [ ] **Step 2: Update PageHeader with proper safe area insets**

Update the component to apply safe area padding. The header container should use:

```tsx
<div
  className={cn(
    'relative z-10 flex items-center gap-3 px-[var(--page-px)]',
    sticky && 'sticky top-0 backdrop-blur-xl bg-background/80',
    className,
  )}
  style={{
    paddingTop: 'calc(var(--safe-area-top) + 12px)',
    minHeight: sticky ? 56 : undefined,
  }}
>
```

Keep all existing props (title, subtitle, eyebrow, showBack, actions, sticky). Ensure `--page-px` (20px) is used for horizontal padding instead of any hardcoded value.

- [ ] **Step 3: Read current AppLayout**

Run: `cat -n src/components/layout/AppLayout.tsx`

- [ ] **Step 4: Update AppLayout**

In `AppLayout.tsx`, update the main container's top padding to use the new CSS variable:

```tsx
style={{
  paddingTop: 'var(--safe-area-top)',
  paddingBottom: hideNav ? '0px' : 'var(--app-bottom-clearance)',
  minHeight: 'var(--app-viewport-height, 100svh)',
}}
```

Remove any duplicate safe-area-inset-top calculation since `--safe-area-top` now handles it. Update `--app-dock-height` reference to use the new shorter value (`3.25rem`).

- [ ] **Step 5: Verify all pages render correctly**

Run: `npm run build`
Expected: Clean build.

Run: `npm run dev` and check Home, Wardrobe, Plan, Insights, Settings pages. Verify headers have proper spacing below where the Dynamic Island would be.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/PageHeader.tsx src/components/layout/AppLayout.tsx
git commit -m "Prompt 1: Fix PageHeader safe areas and standardize layout padding"
```

---

### Task 3: Fix Accent Color Application

**Files:**
- Modify: `src/contexts/ThemeContext.tsx`

- [ ] **Step 1: Read current ThemeContext**

Run: `cat -n src/contexts/ThemeContext.tsx`

- [ ] **Step 2: Fix the accent color application function**

In `ThemeContext.tsx`, find the `applyAccent` / `setAccentColor` function. Ensure it sets ALL required CSS custom properties on `document.documentElement.style`:

```typescript
const applyAccentToDOM = (color: AccentColor, isDark: boolean) => {
  const root = document.documentElement;
  const hsl = isDark ? color.hslDark : color.hsl;

  root.style.setProperty('--accent', hsl);
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--ring', hsl);

  const fg = getContrastForeground(hsl, isDark);
  root.style.setProperty('--accent-foreground', fg);
  root.style.setProperty('--primary-foreground', fg);
};
```

- [ ] **Step 3: Fix contrast calculation**

Find `getContrastForeground`. It should parse the HSL lightness value and return an appropriate foreground:

```typescript
const getContrastForeground = (hsl: string, isDark: boolean): string => {
  const lightness = parseFloat(hsl.split(' ').pop()?.replace('%', '') ?? '50');
  // In dark mode, accent is on dark bg — foreground should be light if accent is dark
  // In light mode, accent is on light bg — foreground should be dark if accent is light
  if (isDark) {
    return lightness > 55 ? '24 13% 10%' : '34 32% 95%';
  }
  return lightness > 45 ? '34 32% 95%' : '24 13% 10%';
};
```

- [ ] **Step 4: Verify accent persists on reload**

Ensure the `useEffect` that runs on mount reads from localStorage and calls `applyAccentToDOM` before first paint. Check that the database sync in the login flow also triggers `applyAccentToDOM`.

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add src/contexts/ThemeContext.tsx
git commit -m "Prompt 1: Fix accent color application and contrast calculation for all themes"
```

---

### Task 4: Audit & Fix Hardcoded Colors

**Files:**
- Modify: Multiple component files (identified by grep)

- [ ] **Step 1: Find hardcoded color values in components**

Run these greps to find violations:

```bash
grep -rn "bg-\[#" src/components/ src/pages/ --include="*.tsx" | grep -v node_modules
grep -rn "text-\[#" src/components/ src/pages/ --include="*.tsx" | grep -v node_modules
grep -rn "border-\[#" src/components/ src/pages/ --include="*.tsx" | grep -v node_modules
grep -rn "fill=\"#" src/components/ src/pages/ --include="*.tsx" | grep -v node_modules
grep -rn "stroke=\"#" src/components/ src/pages/ --include="*.tsx" | grep -v node_modules
grep -rn "color:.*#[0-9a-fA-F]" src/components/ src/pages/ --include="*.tsx" | grep -v node_modules
```

- [ ] **Step 2: Replace hardcoded colors with CSS custom property references**

For each violation found, replace:
- Hardcoded accent/primary colors → `bg-primary`, `text-primary`, `bg-accent`
- Hardcoded foreground colors → `text-foreground`, `text-muted-foreground`
- Hardcoded background colors → `bg-background`, `bg-card`, `bg-secondary`
- Hardcoded border colors → `border-border`
- Inline style hex colors → `hsl(var(--accent))`, `hsl(var(--foreground))`, etc.

Skip colors that are genuinely static (e.g., garment color swatches displaying actual colors, image placeholders).

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build, no warnings.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Prompt 1: Replace hardcoded colors with CSS custom property references"
```

---

### Task 5: Dark Mode Polish — Settings Page

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Read current Settings page**

Run: `cat -n src/pages/Settings.tsx`

- [ ] **Step 2: Restyle settings items to iOS grouped list pattern**

Replace the current boxy icon container pattern with inline SVG icons. Each settings group should be wrapped in a single container with hairline internal separators:

```tsx
<div className="mx-[var(--page-px)] rounded-[14px] bg-card/30 border-[0.5px] border-border/40 overflow-hidden">
  <SettingsRow
    icon={<UserIcon className="h-[18px] w-[18px] opacity-50" />}
    label={t('settings.account')}
    to="/settings/account"
  />
  <div className="h-[0.5px] bg-border/30 ml-[46px]" />
  <SettingsRow
    icon={<BellIcon className="h-[18px] w-[18px] opacity-50" />}
    label={t('settings.notifications')}
    to="/settings/notifications"
  />
  {/* ... more rows with separators */}
</div>
```

Remove the `settings-icon` class (the `h-11 w-11 rounded-[1.1rem] bg-secondary/85` container). Icons render inline at 18px with 50% opacity.

Each `SettingsRow` should show a chevron-right icon at 20% opacity on the right side:

```tsx
<ChevronRight className="h-[14px] w-[14px] opacity-20" />
```

- [ ] **Step 3: Update SettingsRow component if separate, or inline**

If `SettingsRow` is a separate component, update it. If inline in Settings.tsx, update the JSX directly. The row pattern:

```tsx
<motion.button
  className="flex items-center gap-3 w-full px-4 py-[13px] text-left"
  whileTap={{ scale: 0.98 }}
  onClick={() => { hapticLight(); navigate(to); }}
>
  {icon}
  <span className="flex-1 text-[14px] font-['DM_Sans'] text-foreground">{label}</span>
  <ChevronRight className="h-[14px] w-[14px] text-foreground opacity-20" />
</motion.button>
```

- [ ] **Step 4: Run build and visually verify**

Run: `npm run build`
Expected: Clean build.

Run: `npm run dev` and check Settings page in both light and dark mode. Verify:
- No boxy icon containers
- Hairline separators between items
- Chevron indicators on right
- Warm charcoal in dark mode, not cold/blue

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "Prompt 1: Restyle Settings to iOS grouped list with inline icons"
```

---

### Task 6: Phase 1 Integration — Build, Lint, Push PR

**Files:**
- All Phase 1 changes

- [ ] **Step 1: Run full quality checks**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build
```

All three must pass with zero errors/warnings.

- [ ] **Step 2: Fix any issues found**

Address any TypeScript errors, lint warnings, or build warnings.

- [ ] **Step 3: Push and create PR**

```bash
git push origin prompt-1-css-tokens
gh pr create --title "Prompt 1: Phase 1 — Systemic UI fixes (safe areas, accent colors, dark mode)" --body "## Summary
- Fix safe area insets for Dynamic Island on all page headers
- Fix accent color application and contrast calculation
- Replace hardcoded colors with CSS custom properties
- Restyle Settings page to iOS grouped list pattern
- Update CSS tokens for light/dark mode contrast

## Test plan
- [ ] Check all pages on iPhone with Dynamic Island — headers clear of notch
- [ ] Switch accent colors — verify they apply across all screens
- [ ] Toggle light/dark mode — verify contrast and readability
- [ ] Settings page — verify modern iOS grouped list styling"
```

---

## Phase 2: Navigation Overhaul

### Task 7: Redesign BottomNav

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `src/index.css` (dock height variable already updated in Task 1)

- [ ] **Step 1: Read current BottomNav**

Run: `cat -n src/components/layout/BottomNav.tsx`

- [ ] **Step 2: Update ROUTE_TABS order and icons**

Replace the `ROUTE_TABS` array with the new order. Remove lucide icon imports and use inline SVGs:

```tsx
const ROUTE_TABS = [
  { path: '/', label: 'home', icon: HomeIcon, activeIcon: HomeIconFilled },
  { path: '/wardrobe', label: 'wardrobe', icon: WardrobeIcon, activeIcon: WardrobeIconFilled },
  // (+) button is rendered separately, not in ROUTE_TABS
  { path: '/plan', label: 'plan', icon: PlanIcon, activeIcon: PlanIconFilled },
  { path: '/insights', label: 'insights', icon: InsightsIcon, activeIcon: InsightsIconFilled },
] as const;
```

- [ ] **Step 3: Create iOS-native SVG icon components**

Add icon components above or in a separate file. Each icon is an SVG with 1.5px stroke, rounded caps/joins:

```tsx
const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <path d="M9 22V12h6v10" />
  </svg>
);

const HomeIconFilled = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12.707 2.293a1 1 0 00-1.414 0l-9 9A1 1 0 003 13h1v7a2 2 0 002 2h4v-5a1 1 0 011-1h2a1 1 0 011 1v5h4a2 2 0 002-2v-7h1a1 1 0 00.707-1.707l-9-9z" />
  </svg>
);

const WardrobeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="5" rx="1.5" />
    <rect x="4" y="10.5" width="16" height="5" rx="1.5" />
    <rect x="4" y="17" width="16" height="5" rx="1.5" />
  </svg>
);

const WardrobeIconFilled = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="4" y="4" width="16" height="5" rx="1.5" />
    <rect x="4" y="10.5" width="16" height="5" rx="1.5" />
    <rect x="4" y="17" width="16" height="5" rx="1.5" />
  </svg>
);

const PlanIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const PlanIconFilled = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <rect x="3" y="4" width="18" height="6" rx="3" fill="currentColor" />
    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const InsightsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 21H4a1 1 0 01-1-1V3" />
    <path d="M7 17l4-5 4 3 5-7" />
  </svg>
);

const InsightsIconFilled = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 21H4a1 1 0 01-1-1V3" />
    <path d="M7 17l4-5 4 3 5-7" />
  </svg>
);
```

- [ ] **Step 4: Rewrite the nav bar JSX**

Replace the entire nav bar render with the new compact iOS-native layout:

```tsx
<nav
  className="fixed bottom-0 inset-x-0 z-50"
  style={{
    background: 'hsl(var(--background) / 0.88)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderTop: '0.5px solid hsl(var(--border) / 0.3)',
    padding: `6px 24px calc(6px + env(safe-area-inset-bottom, 16px))`,
  }}
>
  <div className="flex items-start justify-between">
    {ROUTE_TABS.slice(0, 2).map(tab => (
      <NavTab key={tab.path} tab={tab} isActive={location.pathname === tab.path} />
    ))}

    {/* Center (+) button */}
    <div className="flex-1 flex justify-center pt-0.5">
      <motion.button
        className="flex items-center justify-center rounded-[12px]"
        style={{
          width: 44,
          height: 36,
          background: `linear-gradient(180deg, hsl(var(--accent)), hsl(var(--accent) / 0.8))`,
        }}
        whileTap={{ scale: 0.92 }}
        onClick={() => { hapticLight(); setAddSheetOpen(true); }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </motion.button>
    </div>

    {ROUTE_TABS.slice(2).map(tab => (
      <NavTab key={tab.path} tab={tab} isActive={location.pathname === tab.path} />
    ))}
  </div>
</nav>
```

- [ ] **Step 5: Create NavTab sub-component**

```tsx
const NavTab = ({ tab, isActive }: { tab: typeof ROUTE_TABS[number]; isActive: boolean }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const Icon = isActive ? tab.activeIcon : tab.icon;

  return (
    <motion.button
      className="flex-1 flex flex-col items-center gap-[1px] pt-1"
      style={{ opacity: isActive ? 1 : 0.42 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => { hapticLight(); navigate(tab.path); }}
    >
      <div className="text-foreground">
        <Icon />
      </div>
      <span
        className="text-foreground"
        style={{
          fontSize: 10,
          fontFamily: "-apple-system, 'SF Pro Text', 'DM Sans', sans-serif",
          fontWeight: isActive ? 500 : 400,
          letterSpacing: '-0.1px',
        }}
      >
        {t(`nav.${tab.label}`)}
      </span>
    </motion.button>
  );
};
```

- [ ] **Step 6: Remove old lucide icon imports and pill animation**

Remove imports for `Home, Shirt, CalendarDays, BarChart3, Plus` from lucide-react. Remove the `layoutId` animated pill logic. Remove any old `app-dock` CSS class references if they conflict.

- [ ] **Step 7: Run build and visually verify**

Run: `npm run build`
Expected: Clean build.

Run: `npm run dev` and verify:
- Nav is visibly shorter (~30% reduction)
- Icons are iOS-native style
- Order is Home | Wardrobe | (+) | Plan | Insights
- Active tab is full brightness with filled icon
- Inactive tabs at 42% opacity
- (+) button uses accent color gradient, sits flush in bar

- [ ] **Step 8: Commit**

```bash
git checkout -b prompt-2-nav-overhaul main
git add src/components/layout/BottomNav.tsx
git commit -m "Prompt 2: Redesign bottom nav — compact iOS-native with custom SVG icons"
```

---

### Task 8: Restyle Add Button Sheet

**Files:**
- Modify: `src/components/layout/BottomNavAddSheet.tsx`

- [ ] **Step 1: Read current BottomNavAddSheet**

Run: `cat -n src/components/layout/BottomNavAddSheet.tsx`

- [ ] **Step 2: Update the sheet with 3 actions and iOS styling**

Replace the actions array and restyle to match the iOS grouped list pattern:

```tsx
const actions = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="12" cy="12" r="3" />
        <path d="M3 16l4-4 4 4" />
      </svg>
    ),
    label: t('nav.addGarment'),
    subtitle: t('nav.addGarmentDesc'),
    action: () => navigate('/wardrobe/add'),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6" />
        <path d="M10 14L21 3" />
        <rect x="3" y="8" width="13" height="13" rx="2" />
      </svg>
    ),
    label: t('nav.liveScan'),
    subtitle: t('nav.liveScanDesc'),
    action: () => navigate('/wardrobe/scan'),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    label: t('nav.bulkAdd'),
    subtitle: t('nav.bulkAddDesc'),
    action: () => navigate('/wardrobe/add?mode=bulk'),
  },
];
```

Render as iOS grouped list:

```tsx
<SheetContent side="bottom" className="rounded-t-[20px] pb-[env(safe-area-inset-bottom)]">
  <SheetHeader className="px-[var(--page-px)] pb-4">
    <SheetTitle className="text-[17px] font-['DM_Sans'] font-semibold text-foreground">
      {t('nav.addTitle')}
    </SheetTitle>
  </SheetHeader>
  <div className="mx-[var(--page-px)] rounded-[14px] bg-card/30 border-[0.5px] border-border/40 overflow-hidden mb-4">
    {actions.map((item, i) => (
      <Fragment key={i}>
        {i > 0 && <div className="h-[0.5px] bg-border/30 ml-[52px]" />}
        <motion.button
          className="flex items-center gap-3 w-full px-4 py-[14px] text-left"
          whileTap={{ scale: 0.98 }}
          onClick={() => { hapticLight(); item.action(); onOpenChange(false); }}
        >
          <div className="text-foreground opacity-50">{item.icon}</div>
          <div className="flex-1">
            <div className="text-[14px] font-['DM_Sans'] font-medium text-foreground">{item.label}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">{item.subtitle}</div>
          </div>
          <ChevronRight className="h-[14px] w-[14px] text-foreground opacity-20" />
        </motion.button>
      </Fragment>
    ))}
  </div>
</SheetContent>
```

- [ ] **Step 3: Add i18n keys if missing**

Check `src/i18n/locales/en.ts` for the nav keys. If `nav.bulkAdd`, `nav.bulkAddDesc`, `nav.addGarmentDesc`, `nav.liveScanDesc` don't exist, append them:

```typescript
nav: {
  // ... existing keys
  addTitle: 'Add to wardrobe',
  addGarment: 'Add Garment',
  addGarmentDesc: 'Take a photo or upload',
  liveScan: 'BURS Live Scan',
  liveScanDesc: 'Scan with your camera',
  bulkAdd: 'Bulk Add',
  bulkAddDesc: 'Add multiple items at once',
}
```

Also append the same keys to `src/i18n/locales/sv.ts` with Swedish translations.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/BottomNavAddSheet.tsx src/i18n/locales/en.ts src/i18n/locales/sv.ts
git commit -m "Prompt 2: Restyle add sheet with 3 actions and iOS grouped list pattern"
```

---

### Task 9: Phase 2 Integration — Build, Lint, Push PR

**Files:**
- All Phase 2 changes

- [ ] **Step 1: Run full quality checks**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build
```

- [ ] **Step 2: Push and create PR**

```bash
git push origin prompt-2-nav-overhaul
gh pr create --title "Prompt 2: Phase 2 — Navigation overhaul with iOS-native design" --body "## Summary
- Redesigned bottom nav: Home | Wardrobe | (+) | Plan | Insights
- Custom SVG icons (folded stack for Wardrobe, trend line for Insights)
- ~30% shorter bar with iOS-native styling
- (+) button with accent gradient opens 3-action sheet
- Added Bulk Add as third quick action

## Test plan
- [ ] Nav bar height reduced, sits flush at bottom
- [ ] Icons match iOS style — filled when active, stroked when inactive
- [ ] (+) button uses user's accent color
- [ ] Sheet opens with 3 options: Add Garment, Live Scan, Bulk Add
- [ ] All nav items navigate correctly
- [ ] Haptic feedback on all taps"
```

---

## Phase 3: Home as Hub

### Task 10: Create Home Section Header Component

**Files:**
- Create: `src/components/home/HomeSectionHeader.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface HomeSectionHeaderProps {
  label: string;
}

export function HomeSectionHeader({ label }: HomeSectionHeaderProps) {
  return (
    <div
      className="px-[var(--page-px)] pb-3 text-foreground/30"
      style={{
        fontSize: 10,
        fontFamily: "-apple-system, 'SF Pro Text', 'DM Sans', sans-serif",
        textTransform: 'uppercase',
        letterSpacing: '1.8px',
      }}
    >
      {label}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git checkout -b prompt-3-home-hub main
git add src/components/home/HomeSectionHeader.tsx
git commit -m "Prompt 3: Add HomeSectionHeader component"
```

---

### Task 11: Create Stylist Section Component

**Files:**
- Create: `src/components/home/HomeStylistSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { HomeSectionHeader } from './HomeSectionHeader';

const StyleChatIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const GenerateIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
  </svg>
);

const StyleMeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a1.5 1.5 0 011.5 1.5c0 .56-.31 1.05-.77 1.3L12 5.5" />
    <path d="M12 5.5l8 4.5a1 1 0 01-.5 1.87H4.5A1 1 0 014 10L12 5.5z" />
    <path d="M6 11.87v7.63a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5v-7.63" />
  </svg>
);

const MoodIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const STYLIST_ITEMS = [
  { icon: StyleChatIcon, labelKey: 'home.styleChat', descKey: 'home.styleChatDesc', path: '/chat' },
  { icon: GenerateIcon, labelKey: 'home.generateOutfit', descKey: 'home.generateOutfitDesc', path: '/outfit-generate' },
  { icon: StyleMeIcon, labelKey: 'home.styleMe', descKey: 'home.styleMeDesc', path: '/style-me' },
  { icon: MoodIcon, labelKey: 'home.moodOutfit', descKey: 'home.moodOutfitDesc', path: '/mood-outfit' },
] as const;

export function HomeStylistSection() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div>
      <HomeSectionHeader label={t('home.yourStylist')} />
      <div className="px-[var(--page-px)] grid grid-cols-2 gap-[10px] pb-5">
        {STYLIST_ITEMS.map((item) => (
          <motion.button
            key={item.path}
            className="flex flex-col items-start rounded-[16px] p-4 text-left bg-card/30 border-[0.5px] border-border/40"
            whileTap={{ scale: 0.97 }}
            onClick={() => { hapticLight(); navigate(item.path); }}
          >
            <div className="text-foreground opacity-50 mb-2">
              <item.icon />
            </div>
            <div className="text-[13px] font-['DM_Sans'] font-medium text-foreground">
              {t(item.labelKey)}
            </div>
            <div className="text-[11px] text-foreground/35 mt-[3px] leading-[1.4]">
              {t(item.descKey)}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/HomeStylistSection.tsx
git commit -m "Prompt 3: Add HomeStylistSection component"
```

---

### Task 12: Create Discover Section Component

**Files:**
- Create: `src/components/home/HomeDiscoverSection.tsx`

- [ ] **Step 1: Create the component**

Same pattern as `HomeStylistSection`, with different items:

```tsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { HomeSectionHeader } from './HomeSectionHeader';

const TravelIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const DiscoverIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const GapsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" strokeDasharray="3 2" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
  </svg>
);

const DISCOVER_ITEMS = [
  { icon: TravelIcon, labelKey: 'home.travelCapsule', descKey: 'home.travelCapsuleDesc', path: '/travel-capsule' },
  { icon: DiscoverIcon, labelKey: 'home.discover', descKey: 'home.discoverDesc', path: '/discover' },
  { icon: GapsIcon, labelKey: 'home.wardrobeGaps', descKey: 'home.wardrobeGapsDesc', path: '/garment-gaps' },
  { icon: SettingsIcon, labelKey: 'home.settings', descKey: 'home.settingsDesc', path: '/settings' },
] as const;

export function HomeDiscoverSection() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div>
      <HomeSectionHeader label={t('home.discover')} />
      <div className="px-[var(--page-px)] grid grid-cols-2 gap-[10px] pb-5">
        {DISCOVER_ITEMS.map((item) => (
          <motion.button
            key={item.path}
            className="flex flex-col items-start rounded-[16px] p-4 text-left bg-card/30 border-[0.5px] border-border/40"
            whileTap={{ scale: 0.97 }}
            onClick={() => { hapticLight(); navigate(item.path); }}
          >
            <div className="text-foreground opacity-50 mb-2">
              <item.icon />
            </div>
            <div className="text-[13px] font-['DM_Sans'] font-medium text-foreground">
              {t(item.labelKey)}
            </div>
            <div className="text-[11px] text-foreground/35 mt-[3px] leading-[1.4]">
              {t(item.descKey)}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/home/HomeDiscoverSection.tsx
git commit -m "Prompt 3: Add HomeDiscoverSection component"
```

---

### Task 13: Restructure Home Page

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/i18n/locales/en.ts` (append new keys)
- Modify: `src/i18n/locales/sv.ts` (append new keys)

- [ ] **Step 1: Read current Home page**

Run: `cat -n src/pages/Home.tsx`

- [ ] **Step 2: Add i18n keys to en.ts**

Append to the `home` section in `src/i18n/locales/en.ts`:

```typescript
home: {
  // ... existing keys (keep all)
  yourStylist: 'Your Stylist',
  styleChat: 'Style Chat',
  styleChatDesc: 'Ask your AI stylist anything',
  generateOutfit: 'Generate Outfit',
  generateOutfitDesc: 'AI-curated looks from your wardrobe',
  styleMe: 'Style Me',
  styleMeDesc: 'Get styled for any occasion',
  moodOutfit: 'Mood Outfit',
  moodOutfitDesc: 'Dress how you feel',
  discover: 'Discover',
  travelCapsule: 'Travel Capsule',
  travelCapsuleDesc: 'Pack smart for any trip',
  discoverDesc: 'Explore trends & inspiration',
  wardrobeGaps: 'Wardrobe Gaps',
  wardrobeGapsDesc: "What's missing from your closet",
  settings: 'Settings',
  settingsDesc: 'Theme, accent, profile',
}
```

- [ ] **Step 3: Add i18n keys to sv.ts**

Append matching Swedish translations to `sv.ts`.

- [ ] **Step 4: Restructure Home.tsx layout**

Replace the quick shortcuts grid and rearrange the page layout. Keep existing components like `PullToRefresh`, `HomeTodayLookCard`, weather pill, greeting. The new structure:

```tsx
import { HomeStylistSection } from '@/components/home/HomeStylistSection';
import { HomeDiscoverSection } from '@/components/home/HomeDiscoverSection';

// Inside the return:
<PullToRefresh onRefresh={refetch}>
  <div className="pb-8">
    {/* Header */}
    <div className="px-[var(--page-px)] pt-3">
      <div className="flex justify-between items-start">
        <div>
          <div
            className="text-foreground/30"
            style={{
              fontSize: 10,
              fontFamily: "-apple-system, 'SF Pro Text', 'DM Sans', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
            }}
          >
            {formattedDate}
          </div>
          <h1 className="text-[24px] font-['Playfair_Display'] italic text-foreground mt-0.5">
            {greeting}
          </h1>
        </div>
        <div className="flex items-center gap-[10px]">
          {/* Profile avatar */}
          <motion.button
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.8))' }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { hapticLight(); navigate('/settings'); }}
          >
            <span className="text-[12px] font-medium text-accent-foreground">
              {userInitial}
            </span>
          </motion.button>
        </div>
      </div>
    </div>

    {/* Weather pill */}
    {weather && <WeatherPill weather={weather} />}

    {/* Today's Look */}
    <div className="px-[var(--page-px)] pb-5">
      <HomeTodayLookCard ... />
    </div>

    {/* Your Stylist section */}
    <HomeStylistSection />

    {/* Discover section */}
    <HomeDiscoverSection />
  </div>
</PullToRefresh>
```

Remove the old `QuickShortcuts` / shortcut grid component and its imports. Keep all data-fetching hooks and state logic.

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Visually verify**

Run: `npm run dev` and check:
- Greeting uses Playfair Display italic
- Date is uppercase with letter-spacing
- Weather pill renders correctly
- Today's Look card is full-width
- "Your Stylist" section has 4 cards in 2x2 grid
- "Discover" section has 4 cards in 2x2 grid
- All cards navigate to correct routes
- No emojis visible — all SVG icons

- [ ] **Step 7: Commit**

```bash
git add src/pages/Home.tsx src/i18n/locales/en.ts src/i18n/locales/sv.ts
git commit -m "Prompt 3: Restructure Home as hub with Stylist and Discover sections"
```

---

### Task 14: Phase 3 Integration — Build, Lint, Push PR

- [ ] **Step 1: Run full quality checks**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build
```

- [ ] **Step 2: Push and create PR**

```bash
git push origin prompt-3-home-hub
gh pr create --title "Prompt 3: Phase 3 — Home as central hub with editorial layout" --body "## Summary
- Restructured Home page as central hub
- Added Your Stylist section (Style Chat, Generate, Style Me, Mood)
- Added Discover section (Travel, Discover, Gaps, Settings)
- Vogue-style editorial section headers
- All SVG icons, no emojis

## Test plan
- [ ] Home page shows all sections in correct order
- [ ] All cards navigate to correct routes
- [ ] Editorial typography (Playfair greeting, uppercase date)
- [ ] Works in light and dark mode
- [ ] Haptic feedback on card taps"
```

---

## Phase 4: Insights Dashboard Redesign

### Task 15: Create InsightsHeroStats Component

**Files:**
- Create: `src/components/insights/InsightsHeroStats.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface InsightsHeroStatsProps {
  garmentCount: number;
  outfitCount: number;
  wearCount: number;
}

export function InsightsHeroStats({ garmentCount, outfitCount, wearCount }: InsightsHeroStatsProps) {
  const { t } = useLanguage();

  const stats = [
    { value: garmentCount, label: t('insights.garments') },
    { value: outfitCount, label: t('insights.outfits') },
    { value: wearCount, label: t('insights.wears') },
  ];

  return (
    <div className="px-[var(--page-px)] pb-4 grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card/30 border-[0.5px] border-border/40 rounded-[14px] py-[14px] px-3 text-center"
        >
          <div className="text-[26px] font-['DM_Sans'] font-semibold text-foreground leading-none">
            {stat.value}
          </div>
          <div
            className="text-foreground/30 mt-1"
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git checkout -b prompt-4-insights-dashboard main
git add src/components/insights/InsightsHeroStats.tsx
git commit -m "Prompt 4: Add InsightsHeroStats component"
```

---

### Task 16: Create WearFrequencyChart Component

**Files:**
- Create: `src/components/insights/WearFrequencyChart.tsx`

- [ ] **Step 1: Create the SVG bar chart component**

```tsx
import { useLanguage } from '@/contexts/LanguageContext';

interface WearFrequencyChartProps {
  data: { day: string; count: number }[];
}

export function WearFrequencyChart({ data }: WearFrequencyChartProps) {
  const { t } = useLanguage();
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="mx-[var(--page-px)] mb-4 bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-[18px]">
      <div className="flex justify-between items-center mb-4">
        <div className="text-[13px] font-['DM_Sans'] font-medium text-foreground">
          {t('insights.wearFrequency')}
        </div>
        <div className="text-[10px] text-foreground/30">
          {t('insights.last30Days')}
        </div>
      </div>
      <div className="flex items-end gap-1 h-[100px]">
        {data.map((d, i) => {
          const heightPct = (d.count / maxCount) * 100;
          const opacity = 0.2 + (d.count / maxCount) * 0.8;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-[6px] rounded-b-[2px]"
                style={{
                  height: `${heightPct}%`,
                  background: `linear-gradient(180deg, hsl(var(--accent) / ${opacity}), hsl(var(--accent) / ${opacity * 0.4}))`,
                  minHeight: d.count > 0 ? 4 : 0,
                }}
              />
              <span className="text-[8px] text-foreground/30">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/WearFrequencyChart.tsx
git commit -m "Prompt 4: Add WearFrequencyChart SVG bar chart component"
```

---

### Task 17: Create ColorPaletteBar Component

**Files:**
- Create: `src/components/insights/ColorPaletteBar.tsx`

- [ ] **Step 1: Create the stacked bar component**

```tsx
import { useLanguage } from '@/contexts/LanguageContext';

interface ColorSegment {
  color: string;
  label: string;
  percentage: number;
}

interface ColorPaletteBarProps {
  segments: ColorSegment[];
}

export function ColorPaletteBar({ segments }: ColorPaletteBarProps) {
  const { t } = useLanguage();

  return (
    <div className="mx-[var(--page-px)] mb-4 bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-[18px]">
      <div className="text-[13px] font-['DM_Sans'] font-medium text-foreground mb-[14px]">
        {t('insights.yourPalette')}
      </div>
      <div className="h-7 rounded-lg overflow-hidden flex mb-3">
        {segments.map((seg, i) => (
          <div key={i} style={{ flex: seg.percentage, backgroundColor: seg.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-[10px]">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-[5px]">
            <div
              className="w-2 h-2 rounded-full border-[0.5px] border-border/20"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-[10px] text-foreground/40">
              {seg.label} {seg.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/ColorPaletteBar.tsx
git commit -m "Prompt 4: Add ColorPaletteBar stacked bar component"
```

---

### Task 18: Create CategoryDonut Component

**Files:**
- Create: `src/components/insights/CategoryDonut.tsx`

- [ ] **Step 1: Create the SVG donut chart**

```tsx
import { useLanguage } from '@/contexts/LanguageContext';

interface CategorySegment {
  label: string;
  count: number;
}

interface CategoryDonutProps {
  segments: CategorySegment[];
  total: number;
}

export function CategoryDonut({ segments, total }: CategoryDonutProps) {
  const { t } = useLanguage();
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-4">
      <div className="text-[13px] font-['DM_Sans'] font-medium text-foreground mb-3">
        {t('insights.categories')}
      </div>
      <div className="w-[100px] h-[100px] mx-auto relative">
        <svg viewBox="0 0 36 36" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
          {segments.map((seg, i) => {
            const pct = (seg.count / total) * 100;
            const dashArray = (pct / 100) * circumference;
            const dashOffset = -(offset / 100) * circumference;
            offset += pct;
            const opacity = 0.8 - i * 0.15;
            return (
              <circle
                key={i}
                cx="18"
                cy="18"
                r={radius}
                fill="none"
                stroke={`hsl(var(--accent) / ${Math.max(opacity, 0.15)})`}
                strokeWidth="3"
                strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[16px] font-semibold text-foreground">{total}</div>
          <div className="text-[8px] text-foreground/30 uppercase tracking-[0.5px]">
            {t('insights.items')}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/CategoryDonut.tsx
git commit -m "Prompt 4: Add CategoryDonut SVG chart component"
```

---

### Task 19: Create CostPerWearCard Component

**Files:**
- Create: `src/components/insights/CostPerWearCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useLanguage } from '@/contexts/LanguageContext';

interface CostPerWearCardProps {
  bestValue: number;
  average: number;
  worst: number;
  currency?: string;
}

export function CostPerWearCard({ bestValue, average, worst, currency = '$' }: CostPerWearCardProps) {
  const { t } = useLanguage();
  const maxCost = Math.max(bestValue, average, worst, 1);

  const bars = [
    { label: t('insights.bestValue'), value: bestValue, color: 'hsl(142 71% 45% / 0.6)', pct: 1 - bestValue / maxCost },
    { label: t('insights.average'), value: average, color: 'hsl(var(--accent) / 0.6)', pct: 1 - average / maxCost },
    { label: t('insights.worst'), value: worst, color: 'hsl(0 84% 60% / 0.5)', pct: 1 - worst / maxCost },
  ];

  return (
    <div className="bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-4">
      <div className="text-[13px] font-['DM_Sans'] font-medium text-foreground mb-3">
        {t('insights.costPerWear')}
      </div>
      <div className="flex flex-col gap-[10px]">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-foreground/40">{bar.label}</span>
              <span className="text-[10px] text-foreground/60">
                {currency}{bar.value.toFixed(2)}
              </span>
            </div>
            <div className="h-1 bg-border/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(bar.pct * 100, 5)}%`,
                  backgroundColor: bar.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/CostPerWearCard.tsx
git commit -m "Prompt 4: Add CostPerWearCard progress bar component"
```

---

### Task 20: Create WardrobeHealthRadar Component

**Files:**
- Create: `src/components/insights/WardrobeHealthRadar.tsx`

- [ ] **Step 1: Create the SVG radar chart**

```tsx
import { useLanguage } from '@/contexts/LanguageContext';

interface RadarAxis {
  label: string;
  value: number; // 0-100
}

interface WardrobeHealthRadarProps {
  axes: RadarAxis[];
}

const RADAR_CENTER = 100;
const RADAR_RADIUS = 70;

function polarToCartesian(angle: number, radius: number): [number, number] {
  const rad = (angle - 90) * (Math.PI / 180);
  return [RADAR_CENTER + radius * Math.cos(rad), RADAR_CENTER + radius * Math.sin(rad)];
}

function polygonPoints(values: number[], maxRadius: number): string {
  const step = 360 / values.length;
  return values
    .map((v, i) => {
      const [x, y] = polarToCartesian(i * step, (v / 100) * maxRadius);
      return `${x},${y}`;
    })
    .join(' ');
}

export function WardrobeHealthRadar({ axes }: WardrobeHealthRadarProps) {
  const { t } = useLanguage();
  const step = 360 / axes.length;

  const gridLevels = [100, 66, 33];

  return (
    <div className="mx-[var(--page-px)] mb-4 bg-card/30 border-[0.5px] border-border/40 rounded-[18px] p-[18px]">
      <div className="text-[13px] font-['DM_Sans'] font-medium text-foreground mb-1">
        {t('insights.wardrobeHealth')}
      </div>
      <div className="text-[10px] text-foreground/30 mb-[14px]">
        {t('insights.wardrobeHealthDesc')}
      </div>
      <div className="w-[160px] h-[160px] mx-auto">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Grid polygons */}
          {gridLevels.map((level, i) => (
            <polygon
              key={i}
              points={polygonPoints(Array(axes.length).fill(level), RADAR_RADIUS)}
              fill="none"
              stroke="hsl(var(--border) / 0.3)"
              strokeWidth="0.5"
            />
          ))}

          {/* Data polygon */}
          <polygon
            points={polygonPoints(axes.map(a => a.value), RADAR_RADIUS)}
            fill="hsl(var(--accent) / 0.12)"
            stroke="hsl(var(--accent) / 0.5)"
            strokeWidth="1"
          />

          {/* Labels */}
          {axes.map((axis, i) => {
            const [x, y] = polarToCartesian(i * step, RADAR_RADIUS + 16);
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="hsl(var(--foreground) / 0.35)"
                fontSize="8"
                fontFamily="-apple-system, 'SF Pro Text', 'DM Sans', sans-serif"
              >
                {axis.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/WardrobeHealthRadar.tsx
git commit -m "Prompt 4: Add WardrobeHealthRadar SVG radar chart component"
```

---

### Task 21: Rewrite Insights Page

**Files:**
- Modify: `src/pages/Insights.tsx`
- Modify: `src/i18n/locales/en.ts` (append insights keys)
- Modify: `src/i18n/locales/sv.ts` (append insights keys)

- [ ] **Step 1: Read current Insights page and its adapter**

Run: `cat -n src/pages/Insights.tsx`

Identify the `useInsightsDashboardAdapter` hook — read it to understand what data is available:

Run: `grep -rn "useInsightsDashboardAdapter" src/ --include="*.ts" --include="*.tsx" -l`

Then read the adapter file to understand the data shape.

- [ ] **Step 2: Add i18n keys to en.ts**

Append to the `insights` section:

```typescript
insights: {
  // ... existing keys (keep all)
  garments: 'Garments',
  outfits: 'Outfits',
  wears: 'Wears',
  wearFrequency: 'Wear Frequency',
  last30Days: 'Last 30 days',
  yourPalette: 'Your Palette',
  categories: 'Categories',
  items: 'items',
  costPerWear: 'Cost / Wear',
  bestValue: 'Best value',
  average: 'Average',
  worst: 'Worst',
  wardrobeHealth: 'Wardrobe Health',
  wardrobeHealthDesc: 'How balanced your closet is',
  yourStyleStory: 'Your Style Story',
}
```

Add matching Swedish translations to `sv.ts`.

- [ ] **Step 3: Rewrite Insights.tsx**

Replace the page with the new dashboard layout. Keep the existing adapter hook for data, but restructure the JSX:

```tsx
import { PageHeader } from '@/components/layout/PageHeader';
import { InsightsHeroStats } from '@/components/insights/InsightsHeroStats';
import { WearFrequencyChart } from '@/components/insights/WearFrequencyChart';
import { ColorPaletteBar } from '@/components/insights/ColorPaletteBar';
import { CategoryDonut } from '@/components/insights/CategoryDonut';
import { CostPerWearCard } from '@/components/insights/CostPerWearCard';
import { WardrobeHealthRadar } from '@/components/insights/WardrobeHealthRadar';
import { useInsightsDashboardAdapter } from '@/components/insights/useInsightsDashboardAdapter';
import { useLanguage } from '@/contexts/LanguageContext';
import { AnimatedPage } from '@/components/layout/AnimatedPage';

export default function Insights() {
  const { t } = useLanguage();
  const { state, viewModel } = useInsightsDashboardAdapter();

  if (state === 'loading') return <InsightsLoadingSkeleton />;
  if (state === 'empty') return <InsightsEmptyState />;

  return (
    <AnimatedPage>
      <PageHeader
        eyebrow={t('nav.insights')}
        title={t('insights.yourStyleStory')}
        sticky={false}
      />

      <InsightsHeroStats
        garmentCount={viewModel.garmentCount}
        outfitCount={viewModel.outfitCount}
        wearCount={viewModel.wearCount}
      />

      <WearFrequencyChart data={viewModel.wearFrequencyByDay} />

      <ColorPaletteBar segments={viewModel.colorSegments} />

      <div className="px-[var(--page-px)] pb-4 grid grid-cols-2 gap-[10px]">
        <CategoryDonut
          segments={viewModel.categorySegments}
          total={viewModel.garmentCount}
        />
        <CostPerWearCard
          bestValue={viewModel.costPerWear.best}
          average={viewModel.costPerWear.average}
          worst={viewModel.costPerWear.worst}
        />
      </div>

      <WardrobeHealthRadar axes={viewModel.healthAxes} />
    </AnimatedPage>
  );
}
```

The adapter hook may need to be updated to provide data in the shapes these components expect. Read the adapter and map existing data fields to the new component props. If fields like `wearFrequencyByDay`, `colorSegments`, `categorySegments`, `costPerWear`, or `healthAxes` don't exist, derive them from what's available or add them to the adapter.

- [ ] **Step 4: Update adapter if needed**

Read the adapter hook file and add any missing computed properties. The adapter should transform raw data into the shapes each chart component expects.

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Visually verify**

Run: `npm run dev` and check Insights page:
- Hero stats show 3 numbers in a row
- Bar chart renders with accent-colored gradient bars
- Color palette shows stacked bar with legend
- Donut and cost-per-wear sit side by side
- Radar chart renders with 6 axes
- Works in both light and dark mode
- All text readable (no disappearing numbers)

- [ ] **Step 7: Commit**

```bash
git add src/pages/Insights.tsx src/components/insights/ src/i18n/locales/en.ts src/i18n/locales/sv.ts
git commit -m "Prompt 4: Redesign Insights as visual dashboard with charts"
```

---

### Task 22: Phase 4 Integration — Build, Lint, Push PR

- [ ] **Step 1: Run full quality checks**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build
```

- [ ] **Step 2: Push and create PR**

```bash
git push origin prompt-4-insights-dashboard
gh pr create --title "Prompt 4: Phase 4 — Insights dashboard redesign with charts" --body "## Summary
- Complete Insights page redesign from text to visual dashboard
- Hero stats (3-column), wear frequency bar chart, color palette stacked bar
- Category donut + cost per wear side by side
- Wardrobe health radar chart (6-axis)
- All charts pure SVG, no dependencies, accent-color aware
- Light and dark mode support with proper contrast

## Test plan
- [ ] All charts render with data
- [ ] Charts use user's accent color
- [ ] Numbers readable in light mode (contrast fix)
- [ ] Empty/loading states still work
- [ ] No chart library added to bundle"
```

---

## Execution Notes

- Each phase creates its own branch from `main` and PR
- Phase 1 must be merged before Phases 2-4 (they depend on new CSS tokens and PageHeader changes)
- Phases 2, 3, and 4 are independent of each other and can be built in parallel after Phase 1
- All i18n keys are append-only to `en.ts` and `sv.ts` — never reorganize existing keys
- Run `npm run build` after every task — must be warning-free
- Test with at least 2 different accent colors in both light and dark mode
