

# Shopping Mode -- Shoppingsassistent i Stylist AI

## Oversikt

En ny "Shopping Mode" laggs till i Stylist AI-sidan. Langst upp visas en segmenterad kontroll (Stylist / Shopping) som byter mellan det vanliga stylist-chattet och ett nytt shopping-optimerat chat-lage. Shopping Mode anvander en separat edge function med en anpassad AI-prompt som ar specialiserad pa shopping-beslut.

## Anvandningsflode

```text
+----------------------------------+
|     DRAPE Stylisten              |
+----------------------------------+
| [  Stylist  ] [ Shopping ]       |
+----------------------------------+
|                                  |
|  (Shopping Mode aktiv)           |
|                                  |
|  AI: Hej! Jag ar din shopping-  |
|  assistent. Ta en bild pa det    |
|  plagget du overagar att kopa    |
|  sa hjalper jag dig!             |
|                                  |
|  [Bild pa jacka i butik]         |
|  "Overagar att kopa denna"       |
|                                  |
|  AI: Fin jacka! Den matchar      |
|  perfekt med din marinbla        |
|  Oxford-skjorta [[garment:xx]]   |
|  och dina beige chinos           |
|  [[garment:yy]]. Du saknar en    |
|  brun skinnrem -- kop en till!   |
|  Betyg: 8/10 -- Kop den!        |
|                                  |
+----------------------------------+
|  [Foto] [Skriv...]    [Skicka]  |
+----------------------------------+
```

## Vad Shopping Mode gor

1. **Analysera plagg i butik** -- Anvandaren tar en bild pa klader i butiken, AI identifierar vad det ar
2. **Matcha med garderob hemma** -- AI jamfor med befintliga plagg och visar vad som matchar (med GarmentInlineCard)
3. **Foreslà kompletterande kop** -- AI foreslar vad man mer kan kopa for att maximera plaggets anvandbarhet
4. **Hjalpa besluta** -- Om anvandaren jämför tva plagg, ge ett tydligt rad med betyg/motivering
5. **Budget-medvetenhet** -- AI fragar om budget och ger rad baserat pa det

## Tekniska detaljer

### 1. Ny Edge Function: `shopping_chat`

Fil: `supabase/functions/shopping_chat/index.ts`

- Kopierar strukturen fran `style_chat` (auth, garderobs-kontext, vader)
- Har en helt ny system-prompt optimerad for shopping:
  - "Du ar DRAPE Shopping-assistenten"
  - Fokus pa: "Ska jag kopa detta?", matchning med befintlig garderob, kompletterande kop
  - Ger betyg (1-10) pa varje potentiellt kop
  - Foreslàr konkreta matchningar fran garderoben med [[garment:ID]]-taggar
  - Varnar om plagget overlapper med nàgot som redan finns hemma
- Anvander samma Lovable AI gateway och garderobs-/vader-kontext

### 2. Uppdatera `src/pages/AIChat.tsx`

- Lagg till state: `mode: 'stylist' | 'shopping'`
- Segmenterad kontroll langst upp under PageHeader (tvà knappar med accent-farg pa aktiv)
- Varje mode har sin egen meddelandehistorik (`messages` vs `shoppingMessages`)
- Varje mode har sitt eget valkomstmeddelande
- Send-funktionen valjer ratt URL baserat pa mode:
  - Stylist: `/functions/v1/style_chat`
  - Shopping: `/functions/v1/shopping_chat`
- Separat persistering: anvander `mode`-kolumn i `chat_messages` (eller separat tabell)
- Kameran oppnas direkt i shopping mode for snabb bild-tagning

### 3. Databas-andringar

Lagg till `mode`-kolumn i `chat_messages`-tabellen:
- `mode TEXT DEFAULT 'stylist'` -- skiljer vilken modes meddelanden tillhor
- Ladda/spara meddelanden filtrerat pa mode

### 4. Oversattningar

Lagg till i `src/i18n/translations.ts`:
- `chat.mode_stylist`: "Stylist" / "Stylist"
- `chat.mode_shopping`: "Shopping" / "Shopping"
- `chat.shopping_welcome`: Valkomstmeddelande for shopping mode
- `chat.shopping_placeholder`: "Beskriv plagget du overagar..."

### Filer som skapas / andras

| Fil | Andring |
|-----|---------|
| `supabase/functions/shopping_chat/index.ts` | Ny -- shopping-optimerad AI-chat |
| `src/pages/AIChat.tsx` | Mode-vaxlare, dubbla meddelandelistor, ratt URL per mode |
| `src/i18n/translations.ts` | Shopping mode-strängar (sv + en + ovriga) |
| Databasmigration | Lagg till `mode`-kolumn i `chat_messages` |
| `supabase/config.toml` | Lagg till `shopping_chat` function config |

