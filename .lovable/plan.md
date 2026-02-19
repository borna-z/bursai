

# Accentfärg-steget: Visa UI-preview istället för logga

## Vad ändras

Tar bort loggan från accentfärg-steget i onboarding. Istället visas en **live UI-preview** med knappar, badges och kort som uppdateras i realtid när användaren väljer en färg. Så ser man direkt hur appen kommer att se ut.

## Visuellt resultat

```text
+---------------------------------------------+
|                                              |
|   Välj din accentfärg                        |
|   Färgen används på knappar och detaljer     |
|                                              |
|   +---------------------------------------+  |
|   |  [Knapp i vald färg]   [Badge]  [Badge]| |
|   |                                       |  |
|   |  [Outline-knapp]    [Liten knapp]     |  |
|   +---------------------------------------+  |
|                                              |
|   (o)(o)(o)(o)                               |
|   (o)(o)(o)(o)    <-- färgrutnät             |
|   (o)(o)(o)(o)                               |
|                                              |
|   [ Fortsätt ]   <-- knapp i vald färg      |
+---------------------------------------------+
```

## Tekniska detaljer

### Fil: `src/components/onboarding/AccentColorStep.tsx`

1. **Ta bort** logga-importen (`drapeLogoSrc`) och hela logga-preview-blocket (rad 21-53)
2. **Ersätt med en UI-preview** som visar:
   - En fylld knapp med `backgroundColor: accentColor.hex` och vit text
   - Ett par badges/chips i accentfärgen
   - En outline-knapp med `borderColor: accentColor.hex`
   - Alla element har `transition-colors duration-300` för mjuk animation
3. **Fortsätt-knappen** (rad 101) ändras till att använda accentfärgen med inline-style istället för standard primary (charcoal)
4. Behåll titel, undertitel och färgrutnätet som det är

### Andra filer (valfritt, men rekommenderat)

Användaren sa "det ska inte finnas någon logga i appen". Det innebär att vi även bör:

- **`src/pages/Home.tsx`** (rad 116): Ta bort `DrapeLogo` från PageHeader actions
- **`src/pages/AIChat.tsx`** (rad 305): Ersätt `DrapeLogo` med en enkel ikon (t.ex. `Sparkles`) i chattbubblan
- **`src/pages/Auth.tsx`** (rad 85-87): Ersätt loggan med enbart text "DRAPE" i accentfärg
- **`src/components/marketing/MarketingLayout.tsx`**: Behåll loggan här (marknadsföringssidan är separat)

Totalt ändras 4-5 filer. Inga databasändringar behövs.
