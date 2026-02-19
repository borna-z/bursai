
# Fix: Accentfärger syns i hela appen

## Problem

Accentfärgen uppdaterar CSS-variabeln `--accent` korrekt, men appens viktigaste UI-element (knappar, chips, bottom nav) använder `bg-primary` (charcoal/vit) istället för `bg-accent`. Därför syns ingen skillnad när man byter färg.

## Lösning

Uppdatera de viktigaste interaktiva elementen så att de använder accentfärgen istället för primary-färgen. Detta ger användaren en tydlig visuell förändring direkt.

## Vad som ändras

### 1. Chip-komponenten (`src/components/ui/chip.tsx`)
- Ändra `selected`-varianten från `bg-primary text-primary-foreground` till `bg-accent text-accent-foreground`
- Valda chips (occasion, stil) visar nu accentfärgen

### 2. Bottom navigation (`src/components/layout/BottomNav.tsx`)
- Ändra aktiv ikon-färg från `text-primary` till `text-accent`
- Ändra aktiv bakgrund från `bg-primary/10` till `bg-accent/10`
- Aktiv tab färgas i vald accentfärg

### 3. CTA-knappen "Skapa outfit" på Home (`src/pages/Home.tsx`)
- Lägg till `bg-accent text-accent-foreground hover:bg-accent/90` på huvudknappen
- Knappen visar accentfärgen istället för charcoal

### 4. Progress bar (`src/components/ui/progress.tsx`)
- Ändra indikator-färg från `bg-primary` till `bg-accent`
- Framstegsfältet visar accentfärgen

### 5. Subtexten i AccentColorPicker
- Ta bort "logotyp" ur texten (referens till borttagen logga)
- Ny text: "Ge din app en personlig touch -- färgen syns i knappar och detaljer."

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/components/ui/chip.tsx` | `selected`-variant: primary -> accent |
| `src/components/layout/BottomNav.tsx` | Aktiv tab: primary -> accent |
| `src/pages/Home.tsx` | CTA-knapp: primary -> accent |
| `src/components/ui/progress.tsx` | Indicator: primary -> accent |
| `src/i18n/translations.ts` | Uppdatera subtexten (ta bort "logotyp") |
