
# Glassmorphism Design System -- Hela appen

## Oversikt

Appen har redan en bra glass-effekt pa BottomNav och PageHeader (`backdrop-blur-xl`, `bg-background/60`). Malet ar att utoka denna glasmorfism-estetik till **alla UI-primitiver** sa att hela appen kanns enhetlig och premium.

## Vad som redan ar glassmorphism

- **BottomNav**: `bg-background/60 backdrop-blur-xl backdrop-saturate-150` -- perfekt
- **PageHeader**: `bg-background/70 backdrop-blur-xl backdrop-saturate-150` -- perfekt
- **TabsList**: `bg-foreground/[0.04] backdrop-blur-sm border-border/30` -- bra start
- **TabsTrigger active**: `bg-background/80 backdrop-blur-md` -- bra start
- `.glass-card` utility: `bg-card/80 backdrop-blur-md border-border/40` -- finns men anvands inte overallt
- `.glass-chip` utility: `bg-background/60 backdrop-blur-sm border-border/30` -- finns

## Vad som ska andras

### 1. Card-komponenten (bas for alla kort i appen)
**Fil:** `src/components/ui/card.tsx`

Nuvarande: `bg-card` (helt opak vit/mork) med solid border.
Nytt: Semi-transparent bakgrund med backdrop-blur, mjukare border och subtil skugga -- i princip `.glass-card` som default.

```
rounded-xl border border-border/40 bg-card/70 backdrop-blur-md text-card-foreground shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]
```

### 2. Button-komponenten
**Fil:** `src/components/ui/button.tsx`

- **default** (primary): Behall solid (det ar CTA-knappar, de ska vara tydliga). Inga andringar.
- **secondary**: Gor semi-transparent: `bg-secondary/60 backdrop-blur-sm`
- **outline**: Gor glasig: `border border-border/50 bg-background/50 backdrop-blur-sm hover:bg-background/70`
- **ghost**: Lagg till subtil blur pa hover: `hover:bg-foreground/[0.04] hover:backdrop-blur-sm`

### 3. Sheet (bottom sheets/sidopaneler)
**Fil:** `src/components/ui/sheet.tsx`

Nuvarande: `bg-background` (solid).
Nytt: `bg-background/80 backdrop-blur-xl backdrop-saturate-150` for frostad glaseffekt.
Overlay: Gora mjukare -- `bg-black/40 backdrop-blur-sm` istallet for `bg-black/80`.

### 4. Dialog
**Fil:** `src/components/ui/dialog.tsx`

Nuvarande: `bg-background` solid.
Nytt: `bg-background/85 backdrop-blur-xl backdrop-saturate-150 border-border/40`.
Overlay: Samma som Sheet -- `bg-black/40 backdrop-blur-sm`.

### 5. Drawer
**Fil:** `src/components/ui/drawer.tsx`

Nuvarande: `bg-background` solid.
Nytt: `bg-background/80 backdrop-blur-xl backdrop-saturate-150`.
Overlay: `bg-black/40 backdrop-blur-sm`.
Handtag: Gora mer subtilt med `bg-foreground/10` istallet for `bg-muted`.

### 6. Popover och Select-content
**Filer:** `src/components/ui/popover.tsx`, `src/components/ui/select.tsx`

Nuvarande: `bg-popover` solid.
Nytt: `bg-popover/80 backdrop-blur-xl border-border/40 shadow-lg`.

### 7. DropdownMenu-content
**Fil:** `src/components/ui/dropdown-menu.tsx`

Nuvarande: `bg-popover` solid.
Nytt: `bg-popover/80 backdrop-blur-xl border-border/40`.

### 8. Tooltip
**Fil:** `src/components/ui/tooltip.tsx`

Nuvarande: `bg-popover` solid.
Nytt: `bg-popover/80 backdrop-blur-lg border-border/40`.

### 9. Toast
**Fil:** `src/components/ui/toast.tsx`

Nuvarande default variant: `bg-background` solid.
Nytt: `bg-background/80 backdrop-blur-xl border-border/40`.

### 10. Badge-komponenten
**Fil:** `src/components/ui/badge.tsx`

- **secondary**: `bg-secondary/60 backdrop-blur-sm border-transparent`
- **outline**: `bg-background/40 backdrop-blur-sm`

### 11. Chip-komponenten
**Fil:** `src/components/ui/chip.tsx`

- **default**: `bg-secondary/50 backdrop-blur-sm`
- **filter**: `bg-muted/50 backdrop-blur-sm`
- **outline**: `bg-background/40 backdrop-blur-sm border-border/40`

### 12. Input
**Fil:** `src/components/ui/input.tsx`

Nuvarande: `bg-background` solid.
Nytt: `bg-background/60 backdrop-blur-sm border-border/50`.

### 13. Select trigger
**Fil:** `src/components/ui/select.tsx`

Nuvarande: `bg-background` solid.
Nytt: `bg-background/60 backdrop-blur-sm border-border/50`.

### 14. SettingsGroup card
**Fil:** `src/components/settings/SettingsGroup.tsx`

Nuvarande: `bg-card` solid.
Nytt: `bg-card/70 backdrop-blur-md border border-border/30`.

### 15. Global CSS -- forstarkt glass-utilities
**Fil:** `src/index.css`

Uppdatera `.glass-card` och `.glass-chip` for starkare, mer enhetlig effekt:
```css
.glass-card {
  @apply bg-card/70 backdrop-blur-md border border-border/40 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)];
}

.glass-chip {
  @apply bg-background/50 backdrop-blur-sm border border-border/30 rounded-full;
}
```

Lagg till nya utilities:
```css
.glass-surface {
  @apply bg-background/70 backdrop-blur-xl backdrop-saturate-150;
}

.glass-overlay {
  @apply bg-black/40 backdrop-blur-sm;
}
```

---

## Teknisk sammanfattning

| # | Fil | Andringar |
|---|-----|-----------|
| 1 | `src/components/ui/card.tsx` | Glass-bakgrund som default |
| 2 | `src/components/ui/button.tsx` | Glass pa secondary/outline/ghost |
| 3 | `src/components/ui/sheet.tsx` | Glass content + mjukare overlay |
| 4 | `src/components/ui/dialog.tsx` | Glass content + mjukare overlay |
| 5 | `src/components/ui/drawer.tsx` | Glass content + mjukare overlay |
| 6 | `src/components/ui/popover.tsx` | Glass content |
| 7 | `src/components/ui/select.tsx` | Glass content + trigger |
| 8 | `src/components/ui/dropdown-menu.tsx` | Glass content |
| 9 | `src/components/ui/tooltip.tsx` | Glass content |
| 10 | `src/components/ui/toast.tsx` | Glass default variant |
| 11 | `src/components/ui/badge.tsx` | Glass secondary/outline |
| 12 | `src/components/ui/chip.tsx` | Glass default/filter/outline |
| 13 | `src/components/ui/input.tsx` | Glass bakgrund |
| 14 | `src/components/settings/SettingsGroup.tsx` | Glass card wrapper |
| 15 | `src/index.css` | Forstarkt glass-utilities + nya klasser |

Totalt: **15 filer** som redigeras. Inga nya filer. Inga beroendeforandringar.

## Designprinciper

- **Primary buttons** behaller solid bakgrund for tydlig CTA-kontrast
- **Overlays** ar mjukare (40% svart + blur) istallet for 80% svart
- **Alla ytor** (kort, sheets, dropdowns) far semi-transparent bakgrund + blur
- **Borders** ar genomgaende tunnare (`border-border/40`) for subtilare avgranning
- Fungerar i bade ljust och morkt tema tack vare CSS-variablerna
