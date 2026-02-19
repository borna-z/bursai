

# App Tutorial -- Guidad introduktion till appens funktioner

## Oversikt

Efter att anvandaren har fyllt i sina stilpreferenser (och innan garderobs-/outfit-stegen) visas en swipebar app-guide som forklarar de fyra huvudflikarna: Today, Wardrobe, Plan och Stylist. Varje steg visar fliken ikon, namn, och en kort beskrivning av vad man kan gora dar. Anvandaren sveper igenom alla fyra och trycker sedan "Borja anvanda DRAPE" for att ga vidare.

## Design

Fullskarms-slides som anvandaren sveper horisontellt (eller trycker "Nasta"). Varje slide visar:
- Stor ikon (samma som i bottom nav)
- Flikens namn
- 2-3 korta punkter om vad fliken gor
- Prickrad indikator langst ner (1/4, 2/4, etc.)

Pa sista sliden byts "Nasta"-knappen mot "Borja anvanda DRAPE".

```text
+----------------------------------+
|                                  |
|         [Home icon]              |
|                                  |
|          Idag                    |
|                                  |
|  - Se dagens vader och generera  |
|    en outfit baserat pa det      |
|  - Snabb oversikt av din         |
|    garderob och senaste outfit   |
|  - Valj tillfalle och stil       |
|                                  |
|                                  |
|          o . . .                 |
|                                  |
|      [ Nasta  -->  ]             |
+----------------------------------+
```

## Steg i guiden

1. **Today** (Home) -- Generera dagliga outfits, se vader, valj tillfalle
2. **Wardrobe** (Shirt) -- Alla dina plagg, lagg till nya, filtrera och sok
3. **Plan** (CalendarDays) -- Planera outfits for hela veckan, se kalender
4. **Stylist** (Bot) -- AI-stylist och shopping-assistent, skicka bilder

## Tekniska detaljer

### 1. Ny komponent: `src/components/onboarding/AppTutorialStep.tsx`

- Tar emot `onComplete` callback (samma monster som LanguageStep)
- Anvander Embla Carousel (redan installerat) for horisontell swipe
- 4 slides med ikon, rubrik och beskrivningspunkter
- Dot-indikator visar aktuell slide
- "Nasta"-knapp scrollar till nasta slide
- Pa sista sliden: "Borja anvanda DRAPE"-knapp som anropar `onComplete`

### 2. Uppdatera `src/pages/Onboarding.tsx`

- Lagg till state `tutorialDone` (boolean, default false)
- Infoga AppTutorialStep efter styleStepDone-checken och innan garderobs-stegen:
  - Nuvarande flode: Language -> Accent -> Body -> Style -> Garments/Outfit/Reminder
  - Nytt flode: Language -> Accent -> Body -> Style -> **App Tutorial** -> Garments/Outfit/Reminder

### 3. Oversattningar i `src/i18n/translations.ts`

Nya nycklar (sv + en):
- `onboarding.tutorial.title` -- "Sa anvander du DRAPE" / "How to use DRAPE"
- `onboarding.tutorial.next` -- "Nasta" / "Next"
- `onboarding.tutorial.start` -- "Borja anvanda DRAPE" / "Start using DRAPE"
- `onboarding.tutorial.today.title` -- "Idag" / "Today"
- `onboarding.tutorial.today.desc` -- Beskrivning av Today-fliken
- `onboarding.tutorial.wardrobe.title` -- "Garderob" / "Wardrobe"
- `onboarding.tutorial.wardrobe.desc` -- Beskrivning
- `onboarding.tutorial.plan.title` -- "Planera" / "Plan"
- `onboarding.tutorial.plan.desc` -- Beskrivning
- `onboarding.tutorial.stylist.title` -- "Stylisten" / "Stylist"
- `onboarding.tutorial.stylist.desc` -- Beskrivning

### Filer som skapas / andras

| Fil | Andring |
|------|--------|
| `src/components/onboarding/AppTutorialStep.tsx` | Ny -- 4-stegs swipebar guide for appens flikar |
| `src/pages/Onboarding.tsx` | Lagg till tutorialDone-state och rendera AppTutorialStep efter style-steget |
| `src/i18n/translations.ts` | Lagg till tutorial-oversattningar (sv + en) |

