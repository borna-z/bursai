

# Smart dagssummering i Planner

## Problem idag
Planner visar varje kalenderpost som en enskild badge (t.ex. "09:00 Standup", "13:00 Kundmöte"). Det ger ingen insikt -- bara en lista. Användaren vill att Planner ska **tolka och sammanfatta** dagen: vad handlar den om, vad är viktigast, och vilka outfitförslag passar bäst.

## Lösning

Ersätt den råa kalenderlistan med en **AI-driven dagssummering** som:
1. Läser alla kalenderevents för dagen
2. Grupperar och prioriterar dem (viktigast event, tema för dagen)
3. Ger en kort sammanfattning i naturligt språk
4. Kopplar outfitförslag till sammanfattningen

---

## Vad som ändras i UI

**Nuvarande:**
```text
[Badge: 09:00 Standup] [Badge: 13:00 Kundmöte] [Badge: 18:00 Padel]
```

**Nytt:**
```text
+---------------------------------------------+
| Sparkles  Din dag                            |
|                                              |
| "Arbetsfokuserad dag med kundmöte efter      |
|  lunch -- klä dig affärsmässigt. Avslutar    |
|  med padel kl 18, packa träningskläder."     |
|                                              |
| [Affärsmässig outfit]  [Träningskläder]      |
|  Knapp: Planera utifrån detta -->            |
+---------------------------------------------+
```

---

## Teknisk plan

### 1. Ny Edge Function: `summarize_day`

Tar emot en lista med kalenderhändelser + väderinformation och returnerar:
- `summary` (string) -- 2-3 meningar om dagen
- `priorities` (array) -- rankade aktiviteter med occasion-typ
- `outfit_hints` (array) -- förslag på formalitetsnivå och stil per aktivitet

Använder Lovable AI (gemini-3-flash-preview) med en kort system-prompt som instruerar AI:n att agera som en dagplanerare.

**Fil:** `supabase/functions/summarize_day/index.ts`

### 2. Ny hook: `useDaySummary`

**Fil:** `src/hooks/useDaySummary.ts`

- Tar `date: string` som parameter
- Hämtar kalenderhändelser + väder
- Anropar `summarize_day` edge function
- Cachar resultatet med react-query (staleTime 30 min)
- Returnerar `{ summary, priorities, outfitHints, isLoading }`

### 3. Ny komponent: `DaySummaryCard`

**Fil:** `src/components/plan/DaySummaryCard.tsx`

Ersätter `CalendarEventsList` + `SmartDayBanner` i Plan-sidan med en enhetlig summering:
- Visar en shimmer/skeleton vid laddning
- Visar AI-sammanfattningen i naturligt språk
- Visar prioriterade aktiviteter med ikoner
- Visar outfitförslag kopplade till aktiviteterna
- Knapp "Planera utifrån detta" som öppnar QuickGenerateSheet med förpopulerad occasion

### 4. Uppdatera Plan.tsx

- Ersätt `CalendarEventsList`-rendering och `SmartDayBanner` med `DaySummaryCard`
- När det inte finns kalenderevents, visa inget (som idag)
- Koppla "Planera utifrån detta"-knappen till befintlig `QuickGenerateSheet` med rätt occasion förvald

### 5. Uppdatera DayCard.tsx

Samma logik appliceras i `DayCard` (som används i WeekStrip-vyn): ersätt `CalendarEventsList` och `SmartDayBanner` med en förenklad version av sammanfattningen.

---

## Edge Function: summarize_day -- detaljer

```text
INPUT:
{
  events: [{ title, start_time, end_time }],
  weather: { temperature, precipitation },
  locale: "sv"
}

OUTPUT:
{
  summary: "Arbetsfokuserad dag med kundmöte...",
  priorities: [
    { title: "Kundmöte", occasion: "jobb", formality: 4, time: "13:00" },
    { title: "Padel", occasion: "traning", formality: 1, time: "18:00" }
  ],
  outfit_hints: [
    { occasion: "jobb", style: "Affärsmässig", note: "Prioritera detta" },
    { occasion: "traning", style: "Sport", note: "Packa separat" }
  ]
}
```

AI-prompten instruerar modellen att:
- Identifiera dagens tema (jobb, helgdag, blandat)
- Ranka händelser efter vikt
- Koppla outfitförslag till varje aktivitetstyp
- Skriva sammanfattningen på användarens valda språk

---

## Sammanfattning av filändringar

| Fil | Ändring |
|-----|---------|
| `supabase/functions/summarize_day/index.ts` | Ny edge function |
| `src/hooks/useDaySummary.ts` | Ny hook |
| `src/components/plan/DaySummaryCard.tsx` | Ny komponent |
| `src/pages/Plan.tsx` | Ersätt CalendarEventsList + SmartDayBanner med DaySummaryCard |
| `src/components/plan/DayCard.tsx` | Ersätt samma i DayCard |

Befintliga komponenter (`CalendarEventBadge`, `SmartDayBanner`, `useSmartDayRecommendation`) behålls men används inte längre i Plan-vyn. De kan fortfarande användas i andra delar av appen.

