

# Universell Kalendersynk – ICS/iCal Import

## Sammanfattning
Implementerar en universell kalenderlösning via ICS-URL import som fungerar med **alla kalendertjänster** (Google Calendar, Outlook, Apple Calendar, m.fl.). Användare klistrar in sin ICS-länk och systemet synkar automatiskt i bakgrunden.

---

## Användarflöde

```text
┌─────────────────────────────────────────────────────────────┐
│  Inställningar → Kalender                                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📅 Kalendersynk                                     │   │
│  │                                                      │   │
│  │  Klistra in din ICS-länk för att synka              │   │
│  │  kalenderhändelser automatiskt.                     │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │ https://calendar.google.com/calendar/ical/...│     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  │  [Synka kalender]                                   │   │
│  │                                                      │   │
│  │  ─────────────────────────────────────────────      │   │
│  │  ℹ️ Så hittar du din ICS-länk:                      │   │
│  │  • Google Calendar: Inställningar → Kalender →      │   │
│  │    Hemlig adress i iCal-format                      │   │
│  │  • Outlook: Inställningar → Delad kalender →        │   │
│  │    Publicera kalender → ICS                         │   │
│  │  • Apple: Dela → Offentlig kalender                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Plan-sidan med kalenderhändelser

```text
┌─────────────────────────────────────────────────────────────┐
│  Idag                                         ☀️ 12°        │
├─────────────────────────────────────────────────────────────┤
│  📅 Möte med kund 09:00                                    │
│  📅 Lunch med teamet 12:00                                 │
│                                                             │
│  [Outfit preview - 4 plagg]                                │
│  🏢 jobb • smart casual                                    │
│  "Perfekt för jobbet med harmoniska färger."               │
│                                                             │
│  [Byt]  [Detaljer]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Teknisk Implementation

### Steg 1: Databas – Uppdatera profiles
Lägg till `ics_url`-fält för att spara användarens kalender-URL:
```sql
ALTER TABLE profiles ADD COLUMN ics_url text;
```

### Steg 2: Edge Function – sync_calendar
Ny edge function som:
1. Hämtar ICS-data från användarens URL
2. Parsar ICS-formatet (VEVENT-komponenter)
3. Upserts till `calendar_events`-tabellen
4. Returnerar antal synkade händelser

```text
POST /sync_calendar
Authorization: Bearer <token>

Response:
{ "synced": 12, "upcoming": 5 }
```

### Steg 3: Hook – useCalendarSync
```typescript
// Hanterar synkning och visning
export function useCalendarSync() {
  // synkCalendar() - manuell synk
  // useCalendarEvents(date) - hämta händelser för datum
  // lastSynced - senaste synktid
}
```

### Steg 4: UI – Inställningar
Ny sektion i Settings.tsx:
- Input för ICS-URL
- Synka-knapp med laddningsindikator
- Hjälptext för hur man hittar sin ICS-länk
- Visa senaste synktid

### Steg 5: DayCard – Visa händelser
Uppdatera DayCard.tsx:
- Visa dagens kalenderhändelser som chips/badges
- Klickbara för att se mer info
- Påverkar outfit-förslag (t.ex. "Möte" → jobb-occasion)

### Steg 6: Auto-förslag baserat på händelser
Uppdatera outfit-generering:
- Om händelse innehåller "möte", "presentation" → occasion: "jobb", formality: 4
- Om händelse innehåller "fest", "middag" → occasion: "fest", formality: 5
- Om händelse innehåller "dejt" → occasion: "dejt", formality: 4
- Default: vardag

---

## Filstruktur

```text
Nya filer:
├── supabase/functions/sync_calendar/index.ts  (ICS-parsing + sync)
├── src/hooks/useCalendarSync.ts               (React hooks)
├── src/components/plan/CalendarEventBadge.tsx (Event visning)
└── src/components/settings/CalendarSection.tsx (Inställningar)

Uppdaterade filer:
├── src/pages/Settings.tsx                     (Lägg till CalendarSection)
├── src/components/plan/DayCard.tsx            (Visa händelser)
└── src/hooks/useOutfitGenerator.ts            (Occasion från händelser)
```

---

## Säkerhet
- ICS-URL sparas krypterat i profiles (RLS skyddar)
- Edge function validerar auth + ägandeskap
- Endast events 7 dagar fram synkas (begränsar data)
- Rate limiting på sync-endpoint

---

## Alternativa kalendertjänster
ICS/iCal är en öppen standard som stöds av:
- ✅ Google Calendar
- ✅ Microsoft Outlook/Office 365
- ✅ Apple Calendar
- ✅ Fastmail
- ✅ Proton Calendar
- ✅ Nextcloud Calendar
- ✅ De flesta andra kalenderappar

