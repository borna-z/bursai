

# AI Stylist med bildförslag på dina kläder

## Vad ändras

Idag svarar AI-stylisten bara med text som "Ta din marinblå Oxford-skjorta med beige chinos". Med denna ändring kommer stylisten att visa **bilder på plaggen** inline i chatmeddelandet, så du ser exakt vilka plagg den menar.

## Hur det fungerar

1. AI:n får instruktioner att markera specifika plagg med en speciell tagg: `[[garment:abc-123]]`
2. Edge-funktionen skickar garment-ID:n som kontext till AI:n
3. Frontend-koden hittar dessa taggar i svaret och ersätter dem med klickbara kort med bild, titel och kategori

## Visuellt resultat

```text
+-----------------------------------------------+
| DRAPE Stylisten                                |
|                                                |
| "Till morgondagens möte rekommenderar jag:"    |
|                                                |
| +------------------------------------------+  |
| | [bild] Marinblå Oxford  |  [bild] Beige  |  |
| |        Skjorta          |   Chinos        |  |
| +------------------------------------------+  |
|                                                |
| "Kombinationen ger en smart casual-look som    |
|  passar perfekt för kontoret."                 |
+-----------------------------------------------+
```

Varje plagkort är klickbart och tar dig till plaggdetaljer.

## Tekniska steg

### 1. Uppdatera edge-funktionen `style_chat/index.ts`

- I `getWardrobeContext()`: inkludera garment-ID i varje plaggbeskrivning så AI:n kan referera dem
- Uppdatera system-prompten: instruera AI:n att använda `[[garment:ID]]` syntax när den rekommenderar specifika plagg
- Exempel i prompten: "När du föreslår ett plagg, inkludera taggen [[garment:UUID]] direkt efter plaggnamnet"

### 2. Skapa en `GarmentInlineCard` komponent

- Liten komponent som visar plaggets bild, titel och kategori i en kompakt rad
- Använder `LazyImageSimple` för att ladda bilder via signed URLs
- Klickbar - navigerar till `/wardrobe/{id}`

### 3. Uppdatera `MessageBubble` i `AIChat.tsx`

- Parse AI-svaret och dela upp texten vid `[[garment:...]]` taggar
- Rendera text-delar som vanlig text och garment-taggar som `GarmentInlineCard`
- Hämta garment-data via en hook som laddar de refererade plaggen

### 4. Skapa en `useGarmentsByIds` hook

- Tar en lista med garment-IDs
- Returnerar garment-data inklusive `image_path` för varje plagg
- Cachar resultat med React Query

### Filer som ändras

| Fil | Ändring |
|-----|---------|
| `supabase/functions/style_chat/index.ts` | Lägg till ID i garderobskontext + uppdatera systemprompt |
| `src/pages/AIChat.tsx` | Parse `[[garment:ID]]` i MessageBubble, rendera inline-kort |
| `src/hooks/useGarmentsByIds.ts` | Ny hook för att hämta plagg via ID-lista |

