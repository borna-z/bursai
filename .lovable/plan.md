

## Garment Detail — Apple Minimalism Redesign

### Vision
Transform from a standard detail page into an Apple-style product page: full-bleed hero image, floating translucent header, clean metadata rows, and generous breathing space.

### Changes

#### 1. `src/pages/GarmentDetail.tsx` — Complete layout overhaul

**Hero image section:**
- Remove `PageHeader` — replace with a floating translucent back button (`backdrop-blur-xl bg-background/40 rounded-full`) overlaid on the image, positioned `absolute top-4 left-4`
- Edit + Delete buttons float as a pill on `absolute top-4 right-4`
- Image becomes full-width edge-to-edge with `aspect-[3/4]` (no padding, no rounded corners on image container) — feels like an Apple product hero
- Rounded bottom with `rounded-b-3xl overflow-hidden`

**Title + category (below image):**
- Title: `text-2xl font-semibold` — prominent, clean
- Category below title: `text-[13px] text-muted-foreground/60 uppercase tracking-wide`
- More breathing space: `pt-8 px-6`

**Metadata tags:**
- Replace dense Badge row with a clean inline flow: `text-[13px] text-muted-foreground` separated by `·` dots instead of individual badges
- Example: `Black · Cotton · Regular fit · Autumn`
- Season and formality on a second subtle line

**Stats section:**
- Remove Card wrappers — use simple side-by-side stat columns with a thin `border-r` divider
- Numbers: `text-3xl font-light tabular-nums` (Apple-style large light numbers)
- Labels: `text-[10px] uppercase tracking-widest text-muted-foreground/50`

**Actions:**
- Laundry toggle: simple row without Card wrapper — just label + switch with `py-4 border-t border-border/10`
- "Mark as worn" button: `rounded-2xl h-12` outline style
- Source URL: subtle text link, no Card wrapper

**Spacing:**
- Increase all section gaps to `space-y-8`
- Bottom padding `pb-32` for safe area

#### 2. Loading skeleton
- Full-bleed skeleton matching new hero aspect ratio
- Simpler metadata skeletons below

### Files to Edit
1. `src/pages/GarmentDetail.tsx` — full rewrite of render

