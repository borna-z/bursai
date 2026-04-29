# Burs — Design Handoff for Claude Code (React Native)

## Overview

Burs is a wardrobe / outfit / styling app. This handoff documents a **complete editorial redesign** of the iOS app — light + dark only, with a single warm-gold accent on cream/charcoal neutrals. The user already has a React + TypeScript codebase and wants to build this design **in React Native**.

## About the Design Files

The files in `source/` are **HTML + React (with Babel) prototypes** built only as design references — they show intended look, layout, typography, and behavior. They are **not production code to copy directly**.

Your task: **recreate these designs in React Native**, using the user's existing React Native architecture, navigation, and component conventions. Translate web CSS to RN equivalents (StyleSheet, Pressable, View, Text, SVG via `react-native-svg`, etc.). Keep the visual language pixel-faithful; replace web idioms with idiomatic RN patterns.

## Fidelity

**High-fidelity (hifi).** Every color, font, spacing value, border radius, and interaction is intentional. Match them exactly. Suggested package list is at the bottom.

---

## Design System / Tokens

See `tokens.ts` for a ready-to-paste TypeScript token file.

### Colors — Light theme (default)
| Token         | Value                  | Use                                  |
|---------------|------------------------|--------------------------------------|
| `bg`          | `hsl(34 32% 95%)` `#F4ECDD` | App background (warm cream)      |
| `bg2`         | `hsl(33 27% 92%)` `#EDE3D2` | Subtle secondary surface         |
| `card`        | `hsl(30 32% 98%)` `#FBF7EF` | Card surface                     |
| `card2`       | `hsl(33 27% 94%)` `#F1E8D7` | Card hover / pressed             |
| `fg`          | `hsl(24 13% 10%)` `#1D1916` | Primary text                     |
| `fg2`         | `hsl(24 8% 38%)`  `#69625B` | Secondary text                   |
| `fg3`         | `hsl(24 6% 58%)`  `#9A938B` | Tertiary text / muted icons      |
| `border`      | `hsl(31 29% 84%)` `#DDD0BB` | 1px hairline                     |
| `border2`     | `hsl(31 25% 78%)` `#CFC0A8` | Stronger border                  |
| `accent`      | `hsl(37 47% 46%)` `#AD8137` | Warm gold — single accent        |
| `accentFg`    | `#FFFFFF`              | Foreground on accent fills           |
| `accentSoft`  | `rgba(173,129,55,0.12)`| Soft gold tint (icon tile, ring)     |

### Colors — Dark theme
| Token         | Value                  |
|---------------|------------------------|
| `bg`          | `hsl(32 12% 6%)` `#11100E`   |
| `bg2`         | `hsl(30 8% 11%)` `#1F1D1A`   |
| `card`        | `hsl(28 10% 10%)` `#1B1916`  |
| `card2`       | `hsl(30 8% 14%)` `#27241F`   |
| `fg`          | `hsl(34 32% 95%)` `#F4ECDD`  |
| `fg2`         | `hsl(34 15% 60%)` `#A99E89`  |
| `fg3`         | `hsl(34 8% 42%)`  `#736C61`  |
| `border`      | `hsl(30 8% 18%)`  `#2F2C26`  |
| `border2`     | `hsl(30 8% 24%)`  `#3F3B33`  |
| `accent`      | `hsl(37 46% 63%)` `#CDA56C`  |
| `accentFg`    | `hsl(24 14% 8%)`  `#17140F`  |
| `accentSoft`  | `rgba(205,165,108,0.14)`     |

### Typography

Two families. Fall back to system in RN if not yet linked.

- **Display / Italic numerals** — `Playfair Display`, italic (400, 500). Use for big counters, page kickers like "*Mood Outfit*", italic numerals, statement headlines. Letter-spacing `-0.01em`.
- **UI / Body** — `DM Sans` (400, 500, 600, 700). Use for everything else: page titles, body, captions, buttons.
- **iOS native title** — for in-app page titles (`Add pieces`, `Confirm batch`, etc.) use `-apple-system` / SF Pro fallback at 18 / 22 with weight 600 and letter-spacing -0.2 to feel native.

#### Type scale (px / weight / line-height / letter-spacing)
| Style           | Family                      | Size | Weight | LH    | LS         |
|-----------------|-----------------------------|------|--------|-------|------------|
| `display`       | Playfair Display, italic    | 26–32| 500    | 1.05–1.15 | -0.01em |
| `pageTitle`     | Playfair Display, italic    | 28   | 500    | 1.1   | -0.01em    |
| `pageTitleSm`   | -apple-system / SF Pro      | 18–22| 600    | 1.15  | -0.2px     |
| `bodyLg`        | DM Sans                     | 14.5 | 600    | 1.4   | -0.01em    |
| `body`          | DM Sans                     | 13.5 | 500–600| 1.45  | -0.01em    |
| `caption`       | DM Sans                     | 11–12| 500    | 1.4   | 0.04em     |
| `eyebrow`       | DM Sans, **UPPERCASE**      | 10   | 600    | 1.2   | 0.18em     |
| `chipLabel`     | DM Sans, **UPPERCASE**      | 10–11| 600    | 1     | 0.14em     |
| `numTabular`    | Playfair Display, italic    | 22–28| 500    | 1     | tnum       |

**Eyebrow** is the recurring uppercase micro-label above titles ("LAST 30 DAYS", "DRESS HOW YOU FEEL", "STEP 2 OF 3"). It appears all over the app — implement once, reuse everywhere.

### Spacing
4-based scale. RN: keep numeric.
`2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28`. Card paddings tend to be 14–20. Screen horizontal padding is **20**.

### Radii
| Token       | Px  | Use                              |
|-------------|-----|----------------------------------|
| `r-sm`      | 8   | Photo tile thumbnails            |
| `r-md`      | 10  | Small chip / icon tile           |
| `r-lg`      | 14  | Standard cards, fields, buttons  |
| `r-xl`      | 18  | Larger cards (outfit card)       |
| `r-2xl`     | 22  | Hero/scan preview                |
| `r-pill`    | 999 | Chips, pills, toggles, FAB       |

### Shadows
- `shadowSm`: 1px / 2px / rgba(28,25,23,0.04) — light · rgba(0,0,0,0.4) — dark
- `shadow`:   8px / 24px / rgba(28,25,23,0.08) — light · rgba(0,0,0,0.4) — dark

### Iconography
**No emojis anywhere.** All icons are 1.4–1.5 stroke-width SVG glyphs at 22×22. Render via `react-native-svg`. Inventory in `source/screens.jsx` (see `Icon.*` and `MoodGlyph`).

### Motion
- Card press: `transform: scale(0.97)` over ~200ms
- Progress bars: width transition 220–320ms ease
- Gauge fill: `stroke-dashoffset` over 600ms `cubic-bezier(.32,.72,0,1)`
- Tab switch / route push: iOS native push (use React Navigation default `slide_from_right`)

---

## Architecture & Navigation

### Routes (suggested React Navigation stack)
- `Home` (Today)
- `Wardrobe`
- `Plan`
- `Insights` (tab) / `InsightsDetail` (linked from Home)
- `AddPieceStep1` / `AddPieceStep2` / `AddPieceStep3`
- `Outfits`, `OutfitDetail`, `EditGarment`, `ShareOutfit`
- `StyleChat` (with history drawer + memory panel)
- `StyleMe` (occasion-based)
- `MoodOutfit` (hub tile, 12-mood grid) / `MoodFlow` (standalone 3-step picker)
- `TravelCapsule` 6 steps: Destination → Dates → TripType → Weather → MustHaves → PackingList
- `WardrobeGaps`, `UsedGarments`, `UnusedOutfits`
- `Settings` → `SettingsAppearance` / `SettingsStyle` / `SettingsNotifications` / `SettingsAccount` / `SettingsPrivacy`
- `Profile`, `Notifications`, `PublicProfile`
- `GarmentDetail`
- `Search`, `Filters`
- `ResetPassword`, `BillingSuccess`, `BillingCancel`, `NotFound`

### Bottom tab bar
A single floating dark capsule with FAB centerpiece. Tabs: **Today · Wardrobe · (+) · Plan · Insights**.

- Floating, ~30px from bottom safe area
- Background: `fg` (charcoal in light, near-bg in dark)
- Active tab: pill-shaped highlight in `bg`
- Center FAB: 56px, gold gradient `linear-gradient(180deg, accent, color-mix(accent 80% black))`, drop shadow
- Inactive tab opacity 0.5

See `source/screens.jsx` `BottomNav` and `styles.css` `.fnav` for exact metrics.

---

## Screens

Below is one section per screen, in implementation priority order. For exact code reference, point Claude Code to the matching component inside `source/`.

### 1. Home (Today)
**Source:** `screens.jsx` → `HomeScreen`
- Header: greeting "Morning, Borna" with italic Playfair name, weather pill (`14°` + sun icon), avatar circle.
- "Today's look" hero card: 3-tile outfit preview (TOP / BOTTOM / SHOES placeholders), italic title ("Studio brunch"), copy line, two pills: solid charcoal **Wear this**, outline **Restyle**.
- Hub grid: 4 hub tiles (`Outfits`, `Style Me`, `Mood Outfit`, etc.), each with small icon, label, sub.
- "Your rhythm" mini-stats row → links to Insights.
- Bottom nav.

### 2. Wardrobe
**Source:** `screens.jsx` → `WardrobeScreen`
- Page header: eyebrow "YOUR PIECES", italic title.
- Search pill + filter icon.
- Segmented chips: Garments / Outfits / Laundry.
- Grid of garment cards (3 cols).

> ⚠️ **Garment card design — do not reinvent.** The user has an existing garment card in their RN codebase they want to keep as-is. Use whatever component already exists for that. Do not implement a new garment card layout from this handoff.

### 3. Plan
**Source:** `screens.jsx` → `PlanScreen`
- Week strip (7 day cells, active = filled charcoal, dot under "today" in gold).
- Selected day's planned outfit card (same vocabulary as Today's look).
- Actions: Wear today, Restyle, Clear, +Add.

### 4. Insights ✦
**Source:** `screens.jsx` → `InsightsScreen`
- Eyebrow "LAST 30 DAYS" + title.
- Two stat blocks (italic numerals): `Outfits worn`, `Wardrobe used`.
- **Three circular gauges** (gold ring, `Playfair` italic value in center, eyebrow label, ↑/↓ delta):
  1. Cost / wear efficiency — 82%
  2. Outfit variety — 47%
  3. Care & laundry on time — 91%
- **Your palette card** — proportional horizontal bar of color segments (Cream, Charcoal, Camel, Olive, Slate, Rust, Other) with 2-col legend (swatch + name + %).
- Wear-frequency bar chart (12 bars, gold + soft-gold).
- Most worn list (3 rows, italic gold rank numerals).
- Quiet-win quote card with gold-soft radial accent.

Gauge implementation hint (RN): use `react-native-svg` `<Circle>` with `strokeDasharray` / `strokeDashoffset`. See `Gauge` component in `screens.jsx`.

### 5. Add piece flow (3 steps)

**Source:** `screens.jsx` → `AddGarmentStep1/2/3`

**Step 1 — Choose & stage** (multi-photo, up to 50)
- Header: eyebrow "NEW GARMENT", title "Add pieces", Cancel link.
- Live scan hero card (single primary). Eyebrow "RECOMMENDED · SINGLE PIECE", body, gold camera icon.
- Sub-section "Or add photos" with two source pills side-by-side: **Camera** / **Gallery**, each = 36px gold-soft icon tile + label + uppercase sub.
- Counter: italic Playfair `5/50` + uppercase right-aligned "PHOTOS STAGED".
- Progress bar (3px gold).
- **Photo grid (3 cols, square aspect):** each tile shows a small dark "01"/"02" pill top-left and a 18px circular `×` remove button top-right; the placeholder is a diagonal gradient. Add tile = dashed border + gold `+`.
- Sticky CTA bar: "{n} ready" + button "Analyze all" (disabled if 0).

**Step 2 — Analyzing batch**
- Header eyebrow "STEP 2 OF 3" + title "Analyzing", Skip link.
- Big italic counter centered: gold `3` / fg3 ` / 5`, caption "pieces tagged".
- Progress bar.
- Per-item rows: thumbnail, eyebrow "PIECE 01", title, status indicator (✓ done in gold, `···` now, `—` queued; queued opacity 0.55).
- Sticky CTA: "Review & confirm".

**Step 3 — Confirm batch**
- Header eyebrow "STEP 3 OF 3" + title "Confirm batch", Re-scan link.
- Horizontal piece-selector strip (44×56 thumbnails with "01"–"05" badge; active piece has 2px gold border).
- Hero: 100×130 thumb + eyebrow "DETECTED" + italic title + 3 chips.
- Field rows (uppercase eyebrow label + value): Title / Category / Primary color / Material / Fit.
- Seasons: 4 chips, active filled charcoal.
- Sticky CTA: "{n} pieces" + button "Save all".

### 6. Mood Outfit (12 moods, no emojis)

**Source:** `extra-screens.jsx` → `MoodOutfitScreen` + `MoodGlyph`

3-column grid of 12 mood cards. Each card = `aspect-ratio: 1 / 1.05`, gold-soft icon tile (36×36, r-md, with custom 22px stroke SVG glyph in gold), italic Playfair label, uppercase sub.

**12 moods + glyphs (re-implement each as `react-native-svg`):**
| Name      | Sub                  | Glyph                        |
|-----------|----------------------|------------------------------|
| Calm      | Soft layers          | three soft horizontal waves  |
| Sharp     | Tailored, decisive   | angular bolt                 |
| Cool      | Confident, easy      | double wave                  |
| Bold      | Statement, color     | filled dot inside ring       |
| Soft      | Rounded, low-stim    | crescent moon                |
| Bright    | Open, warm           | sun + 8 rays                 |
| Moody     | Dark, considered     | filled diamond               |
| Tender    | Romantic, light      | four-petal flower            |
| Grounded  | Earthy, sturdy       | mountain                     |
| Polished  | Refined, clean       | four-point sparkle           |
| Easy      | Off-duty, relaxed    | wheat-stem curve             |
| Rich      | Saturated, deep      | wine glass                   |

Tapping a mood pushes `OutfitDetail` with kicker "MOOD" + the mood name as title.

### 7. Style Me (occasion-based)

**Source:** `extra-screens.jsx` → `StyleMeScreen`

- Eyebrow "STYLE ME" + page title "What's the occasion?".
- Horizontal scrolling chip row of occasions: **Coffee meeting · Date night · Office · Wedding · Travel day · Brunch · Workout · Errands · Gallery · Dinner · Beach · Hike** (selected = solid charcoal).
- Result section eyebrow "STYLED FOR YOU" → 2 outfit cards stacked.
- **Outfit card** (`OutfitCard`): 18px radius, top is 3-up tile preview; bottom is meta — italic title, sub line, 2 small chips, right-side "Save" pill (gold-soft tint).

### 8. Style Chat

**Source:** `extra-screens.jsx` → `StyleChatScreen`

- Header: avatar "B" + "Stylist".
- Message bubbles: assistant messages on left (card bg), user messages on right (charcoal fill, bg text).
- Inline outfit cards inside assistant bubbles (same `OutfitCard` component).
- Suggestion chip row above composer.
- Composer pill-shaped at bottom: text input + circular gold send button.

### 9. Travel Capsule (5-step wizard)

**Source:** `extra-screens.jsx` → `TravelCapsuleScreen`

Multi-page guided flow. Top progress dots (5 dots; active = gold, completed = filled charcoal).
1. **Destination** — large search input + recent-trip rows.
2. **Dates** — start / end date fields, total nights italic counter.
3. **Trip type** — 4 large option cards (Business / Leisure / Mixed / Adventure) with italic Playfair label + uppercase sub.
4. **Weather** — read-only summary card (3 stat blocks: high, low, rain probability).
5. **Capsule** — final result: italic Playfair "*7 pieces, 12 outfits*", outfit-card list, action row (Export / Re-pack).

Each step has Back + Continue at the bottom; final step has "Save capsule".

### 10. Wardrobe Gaps
**Source:** `extra-screens.jsx` → `WardrobeGapsScreen` — list of gap rows with reason copy and a "find" pill.

### 11. Settings (editorial redesign)
**Source:** `extra-screens.jsx` → `SettingsScreen`
- Eyebrow + page title.
- Profile row (avatar, name, email, chevron).
- Grouped settings cards (`.settings-group`): each row = gold accent icon + label + value/right-trail. Sections: Appearance (theme toggle row), Units, Notifications, Privacy, Account, About.
- Theme: light / dark segmented control inline.

### 12. Profile / Notifications / Garment detail / Search / Filters
See `extra-screens.jsx`. All follow the same vocabulary — eyebrow + italic title + cards + chips + sticky bottom action when needed.

---

## Round 2 — Additional screens

A second pass added 18 more screens. They live in `source/more-screens.jsx` and `source/audit-screens.jsx` and follow the same vocabulary (eyebrow + italic title + cards + chips + sticky CTA). Implementation priority is roughly Insights & Mood-flow first, then the Settings sub-pages, then the auxiliary screens.

### 13. Insights detail (linked from Home rhythm row)
**Source:** `more-screens.jsx` → `InsightsScreen`
Fuller version of the Insights tab — 30 / 90 / All segmented control at top, three gauges, palette card, wear-frequency bars, most-worn list, "outfits you haven't worn" link row → `UnusedOutfitsScreen`.

### 14. Mood flow (standalone)
**Source:** `more-screens.jsx` → `MoodFlowScreen`
Same 12-mood grid as the hub tile, but as a 3-step picker: pick mood → pick palette intensity (Soft / Medium / Saturated) → result (italic Playfair "*Tender · soft*" + outfit card list). Pushes `OutfitDetail` on tap.

### 15. Edit Garment
**Source:** `more-screens.jsx` → `EditGarmentScreen`
Full edit form opened from `GarmentDetail` → "Edit". Header with Cancel / Save links, big square photo at top with "Replace photo" pill overlay, then field rows mirroring AddPiece Step 3 (title / category / primary color / material / fit / seasons chips). Adds: tags multiline chip input, "wear count" stepper, archive toggle row, destructive "Delete piece" row at the bottom (red text, confirms in modal).

### 16. Used Garments list
**Source:** `more-screens.jsx` → `UsedGarmentsScreen`
List of every garment with `wearCount > 0`, sorted descending. Row = 56×72 thumb · italic title · sub "Worn 24×" · last-worn relative date trail. Top filter chips: All / 30 days / 90 days. Reachable from Insights "Most worn" → "See all".

### 17. Unused Outfits list
**Source:** `more-screens.jsx` → `UnusedOutfitsScreen`
Same row vocabulary but for saved outfits with no wear records. Empty state has italic Playfair quote card.

### 18. Settings — Appearance
**Source:** `more-screens.jsx` → `SettingsAppearanceScreen`
Theme segmented control (System / Light / Dark) at top, then accent-density slider, "App icon" picker (3 tiles), "Reduce motion" toggle row.

### 19. Settings — Style preferences
**Source:** `more-screens.jsx` → `SettingsStyleScreen`
Body type, fit preference (chip group), color comfort (multi-select chips Cream / Charcoal / Camel / …), "Avoid" multi-select, save changes sticky CTA.

### 20. Settings — Notifications
**Source:** `more-screens.jsx` → `SettingsNotificationsScreen`
Master toggle row + grouped sub-toggles: Daily look reminder (with time picker row), Weather alerts, Laundry reminders, Wear streak nudges, Travel capsule check-ins.

### 21. Settings — Account
**Source:** `more-screens.jsx` → `SettingsAccountScreen`
Avatar + name field + email field (read-only with "change" trailing), password row → `ResetPasswordScreen`, connected accounts (Apple / Google / Email), "Manage subscription" row → Billing.

### 22. Settings — Privacy
**Source:** `more-screens.jsx` → `SettingsPrivacyScreen`
Public profile toggle, share-by-default toggle, analytics toggle, "Export my data" row, destructive "Delete account" row.

### 23. Reset Password
**Source:** `audit-screens.jsx` → `ResetPasswordScreen`
Centered card flow: eyebrow "ACCOUNT" + italic title "Reset password". Two states — request (email field + "Send link" CTA) and confirm (italic Playfair check icon + "Check your inbox" copy + "Resend" link).

### 24. 404 / Not Found
**Source:** `audit-screens.jsx` → `NotFoundScreen`
Editorial 404 — italic Playfair "404" giant numeral, eyebrow "OFF THE RAIL", body copy, "Back to today" pill button. Use for any unresolved deep link.

### 25. Share Outfit
**Source:** `audit-screens.jsx` → `ShareOutfitScreen`
Sheet-style screen pushed from `OutfitDetail` → share icon. Outfit card preview at top, shareable image preview (16:9 with Burs wordmark), then row list of share targets (Copy link / Save image / Message / Mail / More …) and a privacy toggle "Make public on my profile".

### 26. Public Profile
**Source:** `audit-screens.jsx` → `PublicProfileScreen`
Read-only profile view of another user (or self preview). Avatar, italic Playfair name, eyebrow "FOLLOWING · 12 · FOLLOWERS · 48", bio, then their public outfits in a 2-col grid using `OutfitCard`. Follow / Following pill in the header.

### 27. Billing — Success
**Source:** `audit-screens.jsx` → `BillingSuccessScreen`
Centered confirmation: italic Playfair check, "Welcome to Burs Premium", plan summary card (plan name · price · renewal date), "Back to today" CTA.

### 28. Billing — Cancel
**Source:** `audit-screens.jsx` → `BillingCancelScreen`
Centered: italic Playfair "Plan cancelled", body copy explaining when access ends, "Reactivate" pill button, "Back to settings" quiet link.

### 29. Travel Capsule — Pick must-haves (new step 5)
**Source:** `audit-screens.jsx` → `TravelMustHavesScreen`
Inserted between weather summary and final result. Eyebrow "STEP 5 OF 6" + title "Pick must-haves". Horizontal piece-selector strip + 3-col garment grid with multi-select (selected = 2px gold border + corner check). Sticky CTA "{n} pinned · Continue".

### 30. Travel Capsule — Packing list (new final step)
**Source:** `audit-screens.jsx` → `TravelPackingListScreen`
Final result with checkbox-list packing format. Sections: Outerwear / Tops / Bottoms / Shoes / Accessories. Each row = checkbox · 36×44 thumb · italic title · sub. Top summary card "*7 pieces · 12 outfits · 3 nights*". Actions: Export PDF, Share, Save capsule.

### 31. Style Chat — history drawer + memory panel
**Source:** `audit-screens.jsx` → `StyleChatScreenV2`
Replacement for screen #8. Adds:
- **History drawer** (left edge swipe or top-left hamburger). Sectioned list: Today / Past 7 days / Past 30 days. Each row = italic title (first user message) + sub (relative time) + 3-dot menu (rename, delete, pin).
- **Memory panel** (top-right "memory" icon → sheet). Editable list of facts the stylist remembers ("Prefers tailored fits", "Avoids loud prints", "Size M tops"). Each row has inline edit + delete; sticky "Add memory" pill at bottom. Memory edits emit a system-style chip in the next chat turn.

---

## Loading & empty states

A loading-states pass touches every async view. Three primitives (defined in `more-screens.jsx`):

- **`Skeleton`** — shimmer block. Base color `card2`, animated linear-gradient highlight at `border` opacity 0.4, 1200ms loop. Use for card placeholders, garment grid placeholders, list rows.
- **`Spinner`** — 22px circular, gold stroke, 1.4-stroke-width, `react-native-reanimated` rotate loop (900ms linear). Use for inline button loading + sticky CTAs.
- **`FadeUp`** — wraps newly-loaded content; 220ms `cubic-bezier(.32,.72,0,1)` translateY(8 → 0) + opacity 0 → 1. Stagger children by 40ms.

Every screen that fetches: render Skeletons in the same shape as the final layout (don't show a blank screen, don't show a spinner alone). Empty states use a centered italic Playfair quote card with a quiet CTA.

---

## Component Inventory

These are the recurring building blocks. Create one RN component per row.

| Component        | Purpose                                                       |
|------------------|---------------------------------------------------------------|
| `Eyebrow`        | Uppercase 10px / 0.18em micro-label                            |
| `PageTitle`      | Italic Playfair big title                                      |
| `Caption`        | 11–12px secondary text                                         |
| `Chip`           | Pill, uppercase 10–11px; supports `active` state               |
| `IconBtn`        | 36px round button; variants `ghost` / `solid`                  |
| `Button`         | 36–44px pill; variants `primary` (charcoal), `accent` (gold), `outline`, `quiet`, `block` |
| `Card`           | Card surface with optional gold-soft radial accent (`.card-hero`)|
| `StatBlock`      | Italic numerals + uppercase label                              |
| `Gauge`          | Circular SVG gauge (78×78, r=30, stroke 6, gold fill)          |
| `PalettePartial` | Proportional bar + 2-col legend                                |
| `OutfitCard`     | 3-tile top + meta bottom (used in chat, style me, capsule)     |
| `MoodCard`       | 1:1.05 card with gold-soft glyph tile + italic label + sub     |
| `SourcePill`     | Camera/Gallery double card with gold-soft icon tile            |
| `PhotoTile`      | Square thumbnail with index badge + remove button              |
| `BottomNav`      | Floating tab bar with FAB                                      |
| `WeekStrip`      | 7-cell horizontal calendar strip                               |
| `ListRow`        | Standard list row: icon tile · title · sub · trail             |
| `SettingsRow`    | Variant of ListRow inside `SettingsGroup`                      |
| `TogglePill`     | iOS-style toggle (44×26 pill, gold when on)                    |

---

## State / Data shape (sketch)

```ts
type Garment = {
  id: string;
  title: string;
  category: string; // "Outerwear · Overshirt"
  primaryColor: string; // "Cream"
  material: string;
  fit: 'Tailored' | 'Regular' | 'Relaxed' | '—';
  seasons: Array<'Spring'|'Summer'|'Autumn'|'Winter'>;
  photoUri: string;
  hue?: number; // for placeholder gradient
  wearCount: number;
  lastWornAt?: string;
};

type Outfit = {
  id: string;
  name: string;
  kicker?: string;       // "TODAY'S LOOK", "MOOD"
  garmentIds: string[];
  occasion?: string;
  mood?: string;
  saved: boolean;
};

type AddPieceDraft = {
  photos: { id: string; uri: string; hue?: number }[]; // up to 50
  detected: Partial<Garment>[];
};

type Insights = {
  outfitsWorn: number;
  wardrobeUsedPct: number;
  costPerWearPct: number;
  outfitVarietyPct: number;
  laundryOnTimePct: number;
  palette: { name: string; hex: string; pct: number }[];
  wearBars: number[]; // 12 values 0-100
  mostWorn: { id: string; title: string; wearCount: number }[];
};
```

---

## React Native package suggestions

| Need                       | Package                                    |
|----------------------------|--------------------------------------------|
| Navigation                 | `@react-navigation/native` + native-stack  |
| SVG (icons, gauges, glyphs)| `react-native-svg`                         |
| Fonts                      | `expo-font` or RN linked .ttf — load Playfair Display Italic + DM Sans 400/500/600/700 |
| Blur (sticky CTA bar)      | `expo-blur` or `@react-native-community/blur` |
| Image picker / Camera      | `expo-image-picker`, `expo-camera`         |
| Reanimated (gauge anim)    | `react-native-reanimated`                  |
| Theming                    | a tiny custom `ThemeProvider` over `tokens.ts` (no need for a heavy lib) |

Translate web-only things:
- `color-mix(in oklab, …)` → precompute to hex / rgba in `tokens.ts` (already done above where it mattered).
- `backdrop-filter: blur(...)` → `BlurView` from expo-blur.
- `linear-gradient` → `react-native-linear-gradient` or `expo-linear-gradient`.
- `aspect-ratio` → use `aspectRatio` style prop (RN supports it).

---

## Files in this bundle

```
design_handoff_burs_rn/
├── README.md                         ← you are here
├── tokens.ts                         ← paste-ready theme tokens (light + dark)
└── source/                           ← HTML+JSX prototypes (reference only)
    ├── Burs iPhone Mockup.html       ← entry point — open in a browser
    ├── styles.css                    ← all styling — read top-down for tokens & components
    ├── screens.jsx                   ← Home / Wardrobe / Plan / Insights / AddPiece 1-3
    ├── extra-screens.jsx             ← Mood / StyleMe / StyleChat / Travel / Settings / GarmentDetail / Profile / Notifications / Search / Filters
    ├── more-screens.jsx              ← Insights detail / Mood flow / EditGarment / Used+Unused lists / 5 Settings sub-pages / Skeleton + Spinner + FadeUp primitives
    ├── audit-screens.jsx             ← ResetPassword / 404 / ShareOutfit / PublicProfile / Billing Success+Cancel / Travel must-haves + packing list / Style Chat v2 (history + memory)
    └── router.jsx                    ← navigation contract
```

When implementing, work screen-by-screen in priority order: Home → Bottom nav → Add piece flow → Insights → Mood → Style Me → Style Chat → Travel → everything else. Each screen in `source/` is annotated with comments above the component definition.

---

## Non-negotiables

1. **Single accent color** — only the warm gold. No additional brand colors. Borders + neutrals do everything else.
2. **No emojis anywhere.** All glyphs are SVG.
3. **Italic Playfair** is reserved for: page titles, large numerals, eyebrows on a few signature spots, and statement copy. Don't overuse it.
4. **Eyebrow micro-labels** above almost every section title — uppercase 10px / 0.18em / fg2.
5. **Garment card stays as-is** in the user's existing codebase. Don't redesign it.
6. **Light + dark only.** Both must be implemented from day one — the user toggles between them in Settings.
