

## Automatisk synk-notifikation

Denna plan lagger till en subtil notifikation som informerar anvandaren nar kalendern senast synkades i bakgrunden. Notifikationen visas som en liten "toast" nar appen upptacker att en bakgrundssynk har skett sedan senaste besok.

### Hur det fungerar

1. **Spara senaste kanda synk-tid lokalt** -- Nar anvandaren oppnar appen sparas `last_calendar_sync` i `localStorage`.
2. **Jamfor vid nasta besok** -- Nar profilen laddas jamfors `last_calendar_sync` fran databasen med det sparade vardet. Om databasens tid ar nyare visas en diskret toast-notifikation.
3. **Visa pa Plan-sidan** -- Notifikationen visas nar Plan-sidan laddas, dar kalenderhandelser ar mest relevanta.

### Tekniska andringar

**1. `src/hooks/useCalendarSync.ts`**
- Lagg till en ny hook `useBackgroundSyncNotification()` som:
  - Laser `last_calendar_sync` fran profil-queryn
  - Jamfor med `localStorage`-nyckeln `drape_last_known_sync`
  - Om databasens tid ar nyare: visa en sonner-toast med meddelandet "Kalendern synkades automatiskt" och uppdatera localStorage
  - Kors bara en gang per session via en `useEffect` med `useRef`-guard

**2. `src/pages/Plan.tsx`**
- Importera och anropa `useBackgroundSyncNotification()` i `PlanPage`-komponenten
- Ingen UI-andring behvs -- toasten visas automatiskt

### Toast-design
- Anvander befintlig `sonner` toast med `toast.info()`
- Meddelande: "Kalendern synkades automatiskt" med tidsstampel (t.ex. "for 2 timmar sedan")
- Visas i 4 sekunder, icke-blockerande

