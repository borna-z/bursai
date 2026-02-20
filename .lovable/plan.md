

# DRAPE UX Polish Plan — Step 3/4

## Friction Points Identified

| # | Journey | Issue | Severity | Fix |
|---|---------|-------|----------|-----|
| 1 | Create outfit (Home) | No preselection of last used occasion/style -- user must re-pick every time | High | Store last occasion + style in localStorage, preselect on mount |
| 2 | Create outfit (Home) | Disabled CTA with no clear explanation when occasion not selected yet | Medium | Change CTA text to "Välj tillfälle" when nothing selected, vs "Skapa outfit" when ready |
| 3 | Add garment | Category/subcategory/pattern/material/fit/season labels all hardcoded Swedish (line 24-61) -- not using i18n | Medium | Move to t() calls |
| 4 | Add garment | WeatherWidget city input placeholder hardcoded "Skriv en stad..." (line 155) | Low | Move to t() |
| 5 | Outfit generator | Error messages hardcoded Swedish: "Inga plagg tillgängliga", "Inte tillräckligt med plagg" (lines 264, 291) | Medium | Move to t() or keep as thrown errors but catch + translate in UI layer |
| 6 | Create outfit | No outerwear suggestion hint when weather is cold -- user doesn't know AI will auto-include it | Low | Add subtle hint text below weather widget when temp <= 10°C |
| 7 | Plan day | Empty state for no-outfit is minimal but CTA buttons are small `size="sm"` -- not obvious enough | Medium | Make primary "Planera" button full-width and prominent |
| 8 | Stylist chat | No quick-start suggestions for first message -- blank chat after welcome message | Medium | Add 3 tappable suggestion chips below welcome message |
| 9 | Outfits page | Loading spinner uses `text-primary` instead of standardized `text-muted-foreground` | Low | Fix spinner color |
| 10 | Outfits page | Delete button still has `active:animate-press` (missed in Step 2) | Low | Remove it |
| 11 | Outfits page | Empty state doesn't differentiate between "no garments yet" and "no outfits yet" | Low | Keep as-is; EmptyState already has good copy |
| 12 | Add garment | Form fields for category dropdown items still hardcoded Swedish (not using i18n) -- "Överdel", "Underdel", etc. | Medium | These are data labels matching DB values; keep Swedish as they map to actual stored values. Add display-only i18n mapping. |
| 13 | Plan | "Planera" and "Skapa åt mig" buttons in empty state are equally weighted -- unclear which is primary | Medium | Make "Skapa åt mig" the primary CTA (accent bg), "Planera" secondary |

## Implementation Changes

### 1. Smart defaults: Remember last occasion + style (Home.tsx)

Save to `localStorage` when generating, restore on mount:

```
// On mount:
const savedOccasion = localStorage.getItem('drape_last_occasion');
const savedStyle = localStorage.getItem('drape_last_style');
if (savedOccasion) setSelectedOccasion(savedOccasion);
if (savedStyle) setSelectedStyle(savedStyle);

// On generate:
localStorage.setItem('drape_last_occasion', selectedOccasion);
if (selectedStyle) localStorage.setItem('drape_last_style', selectedStyle);
```

### 2. Dynamic CTA label (Home.tsx)

When no occasion is selected, show a gentler label:
- No occasion: "Välj tillfälle ovan" (disabled, but with clear text)
- Occasion selected: "Skapa outfit" (enabled)

Add new i18n key: `home.select_occasion_hint` = "Välj tillfälle ovan" / "Select occasion above"

### 3. Cold weather hint (Home.tsx)

When weather temperature <= 10°C, show a subtle line below the weather widget:
`"Kallt ute — ytterkläder läggs till automatiskt"` / `"Cold outside — outerwear added automatically"`

New i18n key: `home.cold_hint`

### 4. Chat quick-start suggestions (AIChat.tsx)

After the welcome message, when there are no other messages, show 3 tappable suggestion chips:
- "Vad ska jag ha på mig idag?" / "What should I wear today?"
- "Analysera min stil" / "Analyze my style"
- "Hjälp mig välja till jobbet" / "Help me choose for work"

Clicking a chip sends it as the user's first message. These disappear once the user sends any message.

New i18n keys: `chat.suggestion_1`, `chat.suggestion_2`, `chat.suggestion_3`

### 5. WeatherWidget hardcoded string (WeatherWidget.tsx)

Line 155: `placeholder="Skriv en stad..."` to `placeholder={t('weather.enter_city')}`

Add `useLanguage` import and new key.

### 6. Plan empty state: clearer primary action (Plan.tsx)

In `renderDayDetail()` when `!hasOutfit`:
- Make "Skapa åt mig" (generate) the primary button: full accent bg, slightly larger
- Make "Planera" (from saved) the secondary outline button
- Swap their order so primary action comes first

### 7. Outfits page cleanup (Outfits.tsx)

- Line 69: Remove `active:animate-press` from delete button
- Line 126: Change spinner from `text-primary` to `text-muted-foreground`

### 8. AddGarment form label i18n (AddGarment.tsx)

The category labels ("Överdel", "Underdel", etc.) at lines 24-61 are hardcoded. Since these map to DB values, create a display mapping:

```tsx
const categoryLabels: Record<string, string> = {
  top: t('garment.category.top'),
  bottom: t('garment.category.bottom'),
  // etc.
};
```

Same for patterns, materials, fits, seasons -- create i18n display keys while keeping the stored values as-is.

New i18n keys (~25):
- `garment.category.top` = "Överdel" / "Top"
- `garment.category.bottom` = "Underdel" / "Bottom"
- `garment.category.shoes` = "Skor" / "Shoes"
- `garment.category.outerwear` = "Ytterkläder" / "Outerwear"
- `garment.category.accessory` = "Accessoar" / "Accessory"
- `garment.category.dress` = "Klänning" / "Dress"
- `garment.pattern.*` (7 patterns)
- `garment.material.*` (8 materials)
- `garment.fit.*` (4 fits)
- `garment.season.*` (4 seasons)

### 9. Add new translation keys to translations.ts

All new keys for SV and EN:

```
home.select_occasion_hint: "Välj tillfälle ovan" / "Select occasion above"
home.cold_hint: "Kallt — ytterkläder läggs till automatiskt" / "Cold — outerwear included automatically"
weather.enter_city: "Skriv en stad..." / "Enter a city..."
chat.suggestion_1: "Vad ska jag ha på mig idag?" / "What should I wear today?"
chat.suggestion_2: "Analysera min stil" / "Analyze my style"  
chat.suggestion_3: "Hjälp mig välja till jobbet" / "Help me choose for work"
garment.category.top: "Överdel" / "Top"
garment.category.bottom: "Underdel" / "Bottom"
garment.category.shoes: "Skor" / "Shoes"
garment.category.outerwear: "Ytterkläder" / "Outerwear"
garment.category.accessory: "Accessoar" / "Accessory"
garment.category.dress: "Klänning" / "Dress"
garment.pattern.solid: "Enfärgad" / "Solid"
garment.pattern.striped: "Randig" / "Striped"
garment.pattern.checked: "Rutig" / "Checked"
garment.pattern.dotted: "Prickig" / "Dotted"
garment.pattern.floral: "Blommig" / "Floral"
garment.pattern.patterned: "Mönstrad" / "Patterned"
garment.pattern.camo: "Kamouflage" / "Camouflage"
garment.material.cotton: "Bomull" / "Cotton"
garment.material.polyester: "Polyester" / "Polyester"
garment.material.linen: "Lin" / "Linen"
garment.material.denim: "Denim" / "Denim"
garment.material.leather: "Läder" / "Leather"
garment.material.wool: "Ull" / "Wool"
garment.material.silk: "Siden" / "Silk"
garment.material.synthetic: "Syntet" / "Synthetic"
garment.fit.slim: "Slim" / "Slim"
garment.fit.regular: "Regular" / "Regular"
garment.fit.loose: "Loose" / "Loose"
garment.fit.oversized: "Oversized" / "Oversized"
garment.season.spring: "Vår" / "Spring"
garment.season.summer: "Sommar" / "Summer"
garment.season.autumn: "Höst" / "Autumn"
garment.season.winter: "Vinter" / "Winter"
```

## Files Modified (summary)

1. `src/pages/Home.tsx` -- Smart defaults, dynamic CTA, cold weather hint
2. `src/pages/AIChat.tsx` -- Quick-start suggestion chips
3. `src/components/weather/WeatherWidget.tsx` -- i18n placeholder
4. `src/pages/Plan.tsx` -- Clearer primary action in empty state
5. `src/pages/Outfits.tsx` -- Remove animate-press, fix spinner color
6. `src/pages/AddGarment.tsx` -- i18n for form labels (categories, patterns, materials, fits, seasons)
7. `src/i18n/translations.ts` -- ~35 new keys (SV + EN)

