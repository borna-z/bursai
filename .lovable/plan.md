

# OAuth Kalendersynk -- Google och Outlook

## Sammanfattning
Ersatter manuell ICS-lankinmatning med OAuth-baserade knappar: **"Koppla Google"** och **"Koppla Outlook"**. Anvandaren trycker pa en knapp, loggar in, och kalendern synkas automatiskt. Apple Calendar saknar webb-API och erbjuds som ICS-fallback.

---

## Anvandardflode

```text
Plan-sidan (CalendarConnectBanner)
┌──────────────────────────────────────────┐
│  Koppla din kalender                      │
│                                           │
│  [Google-ikon]  Koppla Google Calendar     │
│  [Outlook-ikon] Koppla Outlook            │
│  [Apple-ikon]   Koppla via ICS-lank       │
│                                           │
└──────────────────────────────────────────┘

Efter koppling:
┌──────────────────────────────────────────┐
│  Kalender kopplad (Google)  [Synkad]     │
│  Senast synkad: 2 min sedan              │
│  [Synka nu]  [Koppla bort]              │
└──────────────────────────────────────────┘
```

---

## Teknisk Implementation

### Steg 1: Databas -- Ny tabell for OAuth-tokens

En ny tabell `calendar_connections` lagrar providerns OAuth-tokens (krypterade i databasen, skyddade av RLS).

```sql
CREATE TABLE calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,           -- 'google' | 'outlook'
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id text,                 -- optional: specific calendar
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
-- RLS: users can only see/manage their own connections
```

### Steg 2: API-nycklar som behovs

Dessa secrets maste konfigureras:

- **GOOGLE_CLIENT_ID** -- fran Google Cloud Console (Calendar API aktiverat)
- **GOOGLE_CLIENT_SECRET** -- fran Google Cloud Console
- **MICROSOFT_CLIENT_ID** -- fran Azure App Registrations
- **MICROSOFT_CLIENT_SECRET** -- fran Azure App Registrations

### Steg 3: Edge Functions (3 nya)

**a) `calendar_oauth_start`** -- Genererar OAuth-redirect URL
- Tar emot `provider` (google/outlook)
- Bygger OAuth URL med ratt scopes:
  - Google: `https://www.googleapis.com/auth/calendar.readonly`
  - Outlook: `https://graph.microsoft.com/Calendars.Read`
- Returnerar redirect URL till klienten
- Inkluderar `state`-parameter med user_id for sakerhet

**b) `calendar_oauth_callback`** -- Hanterar OAuth callback
- Tar emot `code` och `state` fran OAuth-providern
- Vaxlar auth code mot access/refresh tokens
- Sparar tokens i `calendar_connections`
- Triggar en omedelbar kalendersynk
- Redirectar tillbaka till appen (`/plan?calendar=connected`)

**c) `sync_calendar` uppdateras** -- Stodjer bade ICS och OAuth
- Om anvandaren har en `calendar_connection`:
  - Google: Hamtar events via Google Calendar API (`/calendars/primary/events`)
  - Outlook: Hamtar events via Microsoft Graph (`/me/calendarview`)
  - Refreshar access_token automatiskt om utgangen
- Om anvandaren bara har `ics_url`: Behalter nuvarande ICS-logik
- Allt sparas till `calendar_events` som vanligt

### Steg 4: Uppdatera sync_all_calendars

Den befintliga cron-funktionen utvidgas att aven synka OAuth-anslutna anvandare (inte bara ICS).

### Steg 5: Frontend -- Ny CalendarConnectBanner

Ersatter nuvarande ICS-input med tre knappar:

```text
CalendarConnectBanner.tsx:
- Om ingen anslutning: Visa 3 provider-knappar
- Google/Outlook: Oppnar popup/redirect for OAuth
- Apple: Expanderar ICS-lankinput (nuvarande flow)
- Om ansluten: Visa status + synka/koppla-bort-knappar
```

Nytt hook: `useCalendarConnections` -- hamtar anvandarens aktiva anslutningar fran `calendar_connections`.

### Steg 6: Uppdatera CalendarSection (Installningar)

Visa kopplad provider, synkstatus, och mojlighet att koppla bort.

---

## Filstruktur

```text
Nya filer:
├── supabase/functions/calendar_oauth_start/index.ts
├── supabase/functions/calendar_oauth_callback/index.ts
├── src/hooks/useCalendarConnections.ts

Uppdaterade filer:
├── supabase/functions/sync_calendar/index.ts       (+ OAuth-logik)
├── supabase/functions/sync_all_calendars/index.ts  (+ OAuth-stod)
├── src/components/plan/CalendarConnectBanner.tsx    (OAuth-knappar)
├── src/components/settings/CalendarSection.tsx      (visa OAuth-status)
├── src/hooks/useCalendarSync.ts                     (ny connection-query)
```

---

## Sakerhet

- OAuth-tokens lagras i `calendar_connections` (RLS: user_id = auth.uid())
- Refresh tokens anvands for att fornya access tokens utan anvandaren
- `state`-parameter i OAuth forhindrar CSRF
- Edge functions validerar auth pa varje request
- Tokens raderas nar anvandare kopplar bort eller raderar konto

---

## Begransningar

- **Apple Calendar** har inget webb-baserat calendar API. Erbjuds via ICS-lank som fallback.
- **Google och Microsoft** kraver att du registrerar en OAuth-app och anger API-nycklar.
- Anvandaren maste godkanna calendar-scopet vid inloggning.

