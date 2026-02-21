

## Outfits-sektion i Garderoben + "Skapa film"-knapp

### Vad som ändras

Wardrobe-sidan får ett nytt tabsystem (Plagg / Outfits) högst upp, så du enkelt kan byta mellan att se dina klädesplagg och dina skapade outfits. Dessutom läggs en "Skapa film"-knapp till som sammanställer dina outfits till en visuell reel/slideshow.

### 1. Tabs-system: Plagg vs Outfits
**Fil: `src/pages/Wardrobe.tsx`**
- Lägga till ett iOS-style segmented control (samma stil som Home-sidan) med två flikar: "Plagg" och "Outfits"
- "Plagg"-fliken visar den befintliga garderob-vyn (klädesplagg, filter, etc.)
- "Outfits"-fliken visar de senaste skapade outfits (återanvänder OutfitCard-komponenten från Outfits-sidan)
- Flikarna får `tab-content-enter`-animationen vid byte

### 2. Outfits-listan i Wardrobe
**Fil: `src/pages/Wardrobe.tsx`**
- Importera `useOutfits` och `OutfitWithItems` för att hämta outfits
- Visa outfits i ett kompakt grid/lista-format med bild-strip, occasion-badge och datum
- Klick navigerar till `/outfits/{id}` (befintlig detaljsida)
- Tom-vy med EmptyState och knapp till outfit-generering

### 3. "Skapa film"-knapp
**Fil: `src/pages/Wardrobe.tsx`**
- En ny knapp i Outfits-fliken: "Skapa film" med ett Film/Video-ikon
- Knappen öppnar en helskärms-reel-vy som bläddrar genom outfits med en smooth slideshow-animation
- Varje outfit visas i 2-3 sekunder med en fade/slide-transition

### 4. Outfit Reel-komponent (ny fil)
**Fil: `src/components/wardrobe/OutfitReel.tsx`**
- En fullscreen overlay/sheet som visar outfits som en vertikal reel (liknande Instagram Stories)
- Automatisk slideshow med progress-bar längst upp
- Tryck för att pausa, swipa för att gå vidare
- Visar outfit-bilder, occasion och datum
- Möjlighet att ladda ner som bild (en outfit-kollage) via den befintliga `html-to-image`-beroende

### 5. Översättningar
**Fil: `src/i18n/translations.ts`**
- Lägga till nya nycklar: `wardrobe.tab_garments`, `wardrobe.tab_outfits`, `wardrobe.create_reel`, `wardrobe.reel_title`

### Tekniska detaljer

Filer som ändras:
- `src/pages/Wardrobe.tsx` -- tabs-system, outfit-lista, reel-knapp
- `src/components/wardrobe/OutfitReel.tsx` -- ny komponent
- `src/i18n/translations.ts` -- nya texter

Beroenden som redan finns och återanvänds:
- `html-to-image` -- för nedladdning
- `useOutfits` hook -- hämtar outfits-data
- `LazyImageSimple` -- bildvisning
- Glass-card CSS -- enhetlig design

