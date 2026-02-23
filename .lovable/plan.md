

# Forbattra Wardrobe UX

Tre fokusomraden: battre AI-analys feedback, snabbfilter och batch-upload (flera bilder pa en gang).

---

## 1. Battre AI-analys feedback (AddGarment)

**Problem:** Analyssteget visar bara en generisk progress bar med tre korta texter. Anvandaren vet inte vad som hander.

**Forbattring:**
- Lagga till en animerad "steg-indikator" med 4 tydliga faser: Laddar upp, Analyserar farg och material, Identifierar stil, Klart
- Varje fas far en ikon (Upload, Palette, Sparkles, CheckCircle) som animeras in nar den aktiva fasen andras
- Bilden far en subtil pulsande glow-effekt under analys
- Nar analysen ar klar visas en kort sammanfattning ("Svart bomullströja, casual") innan formularet oppnas -- en "bekraftelse-card" med fade-in som visas i 1.5s
- Om analysen misslyckas: tydligare felmeddelande med "Försök igen"-knapp direkt pa platsen

**Filer som andras:**
- `src/pages/AddGarment.tsx` -- analyssteget (rad 433-458) byggs om med steg-indikator och sammanfattnings-card

---

## 2. Snabbfilter -- "In Laundry" och sortering

**Problem:** Det finns filter for farg och sasong men ingen snabb toggle for "i tvatten" och ingen sortering (senast tillagd, mest anvand).

**Forbattring:**
- Lagga till en "I tvätt"-toggle (liten pill-knapp) bredvid filter-knappen
- Lagga till en sorteringsvaljare (dropdown eller pill-rad) med alternativen: Senast tillagd, Senast använd, Mest använd
- Nar "I tvätt" ar aktiv filtreras listan pa `in_laundry = true`, med en blekt ikon sa det ar tydligt
- Sortering anvander befintlig `sortBy`-parameter i `useGarments`

**Filer som andras:**
- `src/pages/Wardrobe.tsx` -- lagga till sorteringsstate och "i tvatt"-toggle i filterraden
- `src/hooks/useGarments.ts` -- sortering fungerar redan via `sortBy`, ingen andring behövs om vi anvander `last_worn_at`, `created_at`, `wear_count`

---

## 3. Batch-upload (flera bilder)

**Problem:** Anvandaren kan bara ladda upp en bild at gangen via kameran/galleriet. For att lagga till manga plagg kravs manga omgangar.

**Forbattring:**
- Andria file-inputen sa att `multiple` ar tillatet nar man valjer fran galleriet (inte fran kameran)
- Nar flera bilder valjs: visa en kö-vy med miniatyrer och status (väntar, laddar upp, analyserar, klar, fel)
- Varje bild gar igenom samma pipeline: upload -> AI-analys -> spara med AI-defaults (auto-save)
- Anvandaren kan granska/redigera resultaten efterat via befintlig Quick Edit-panel
- Visa total progress (t.ex. "3/7 plagg analyserade") med en progress bar
- Begransar till max 10 bilder per batch for att undvika overbelastning
- Free-plan: begransas till `canAddCount` precis som link-import

**Filer som andras:**
- `src/pages/AddGarment.tsx` -- ny "Batch"-knapp i foto-tabben + batch-upload logik
- Ny komponent `src/components/wardrobe/BatchUploadProgress.tsx` -- visar ko-vy med miniatyrer och status per bild

---

## Tekniska detaljer

### AddGarment.tsx -- analyssteget

```text
Nuvarande:
  [Bild] -> [Spinner + progress bar] -> [Formulär]

Nytt:
  [Bild med glow] -> [4-stegs indikator] -> [Sammanfattnings-card 1.5s] -> [Formulär]
```

Steg-indikatorn anvander `framer-motion` for animerade overganger mellan faser. Varje fas har ett ikon + text-par som animeras in.

### Wardrobe.tsx -- filterrad

Sorteringsknapparna laggs till som en rad pills under befintliga filter:
- "Nyast" (created_at, default)
- "Senast använd" (last_worn_at)  
- "Mest använd" (wear_count)

Plus en toggle-pill "🧺 I tvätt" som satter `inLaundry: true` i filtren.

### BatchUploadProgress.tsx

Ny komponent som tar emot en lista av filer och kör pipeline sekventiellt:
1. For varje fil: upload -> analyzeGarment -> createGarment (med AI-defaults)
2. Visar miniatyr + status-ikon per fil
3. Nar allt ar klart: toast + navigera till wardrobe

Anvander befintliga hooks: `useStorage`, `useAnalyzeGarment`, `useCreateGarment`.

