

# Apply accent color to all interactive elements across 4 pages

## What changes

Replace all `text-primary`, `bg-primary`, and related primary color classes on clickable/interactive elements with `text-accent` / `bg-accent` across the Stylist (AI Chat), Plan, Wardrobe, and Home (Today) pages. This ensures the user-selected accent color is consistently applied everywhere -- just like it was done in Settings.

## Pages and specific changes

### 1. AI Chat (`src/pages/AIChat.tsx`)
- **Send button** (line 246): `bg-primary` -> `bg-accent text-accent-foreground`
- **AI avatar circle** (line 303): `bg-primary/10` -> `bg-accent/10`
- **AI avatar Sparkles icon** (line 304): `text-primary` -> `text-accent`
- **User message bubble** (line 307): `bg-primary text-primary-foreground` -> `bg-accent text-accent-foreground`
- **Header icons** (BarChart3, Trash2): add `text-accent` where clickable

### 2. Plan (`src/pages/Plan.tsx`)
- **CalendarDays icon** in header (line 207): `text-muted-foreground` -> `text-accent`
- **Wand2 button** icon (line 227): add `text-accent`
- **"Anvand" badge** (line 247-249): `bg-primary/10 text-primary` -> `bg-accent/10 text-accent`
- **DaySummaryCard** Sparkles icon and accent colors: update `text-primary` -> `text-accent` and `border-primary/20 bg-primary/5` -> `border-accent/20 bg-accent/5` in `DaySummaryCard.tsx`
- **Action buttons** ("Planera", "Skapa at mig"): use accent color
- **"Markera som anvand"** text button: `hover:text-foreground` -> `hover:text-accent`

### 3. Wardrobe (`src/pages/Wardrobe.tsx`)
- **Loading spinner** (line 326): `text-primary` -> `text-accent`
- **New garments banner** (line 231-234): `bg-primary/5 border-primary/20` -> `bg-accent/5 border-accent/20`, Sparkles `text-primary` -> `text-accent`
- **New badge on grid** (line 87): `bg-primary text-primary-foreground` -> `bg-accent text-accent-foreground`
- **FAB buttons** (line 348): primary FAB should use `bg-accent`
- **Laundry icon active** (line 95): `text-primary` -> `text-accent`
- **Selected card ring** (lines 59, 83): `ring-primary` -> `ring-accent`

### 4. Home (`src/pages/Home.tsx`)
- **Onboarding card** (line 123): `from-accent/10 to-accent/5 border-accent/20` -- already uses accent (good)
- **ArrowRight icon** (line 129): `text-primary` -> `text-accent`
- **Generate button** (line 307): already uses `bg-accent` (good)
- **Wardrobe stats card** (line 145): already uses accent (good)

### 5. DaySummaryCard (`src/components/plan/DaySummaryCard.tsx`)
- **Border and background** (line): `border-primary/20 bg-primary/5` -> `border-accent/20 bg-accent/5`
- **Sparkles icon** and label: `text-primary` -> `text-accent`
- **CTA link**: `text-primary` -> `text-accent`

### 6. Button component consideration
- The default button variant uses `bg-primary`. Primary action buttons like "Planera" and "Skapa at mig" on the Plan page should explicitly use `bg-accent text-accent-foreground` classes.

## Files to modify

| File | Changes |
|------|---------|
| `src/pages/AIChat.tsx` | Swap primary -> accent on send button, avatar, user bubbles, header icons |
| `src/pages/Plan.tsx` | Swap primary -> accent on header icon, badges, action buttons, text links |
| `src/pages/Wardrobe.tsx` | Swap primary -> accent on spinner, banners, FABs, badges, rings |
| `src/pages/Home.tsx` | ArrowRight icon color |
| `src/components/plan/DaySummaryCard.tsx` | Border, bg, icon, CTA colors |

No new files needed. No backend changes.
