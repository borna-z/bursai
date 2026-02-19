

# GDPR-komplett: Data & Integritet-sidan

## Oversikt
Bygga ut sidan "Data & Integritet" med alla verktyg som krävs enligt GDPR (EU:s dataskyddsforordning). Idag finns bara "Exportera data" och "Radera konto". Vi lagger till allt som saknas.

## Vad som laggs till

### 1. Om oss-sektion
Kort information om vem som ar personuppgiftsansvarig (DRAPE), kontaktuppgifter, och hoja transparensen.

### 2. Samtyckes-hantering (Consent management)
- Mojlighet att slå pa/av valfria databehandlingar:
  - **Analysdata** (anonym anvandningsstatistik)
  - **AI-stilist**: tillat att konversationer sparas for personalisering
  - **Kroppsdata**: tillat att kroppsmatt anvands for stilrad
- Varje val sparas i profilens `preferences`-falt (redan jsonb)

### 3. Rattigheter enligt GDPR
- **Exportera data** (redan implementerat -- behalls)
- **Radera konto** (redan implementerat -- behalls)
- **Ratt till ratifiering**: lank till Profil & Konto for att andra sina uppgifter
- **Integritetspolicy**: lank till /privacy
- **Anvandarvillkor**: lank till /terms

### 4. Dataoverblick
En kort lista som visar vilka kategorier av data som lagras:
- Profildata (namn, e-post)
- Garderobsbilder
- Outfits & planeringshistorik
- AI-konversationer
- Kroppsmatt (om angivet)
- Kalenderdata (om synkad)

## Layout-struktur

Collapsible sektioner (samma monster som nya stilsidan):

```text
+-----------------------------+
|  < Data & Integritet        |
+-----------------------------+
|                             |
|  [ Om DRAPE            v ]  |  <- collapsible
|    Ansvarig, kontakt, syfte |
|                             |
|  [ Din data             v ]  |  <- collapsible
|    Lista over datakategorier|
|                             |
|  [ Samtycken            v ]  |  <- collapsible
|    Analysdata       [toggle]|
|    AI-konversationer [toggle]|
|    Kroppsdata       [toggle]|
|                             |
|  [ Dina rattigheter     v ]  |  <- collapsible
|    Exportera data           |
|    Andra dina uppgifter     |
|    Integritetspolicy        |
|    Anvandarvillkor          |
|                             |
|  [  Radera konto  ]         |  <- standalone, destructive
|                             |
+-----------------------------+
```

## Tekniska detaljer

| Fil | Andring |
|-----|---------|
| `src/pages/settings/SettingsPrivacy.tsx` | Full omskrivning: 4 collapsible sektioner, samtyckes-toggles, datalista, Om oss, lankar. "Radera konto" kvar som sista element. |
| `src/i18n/translations.ts` | Lagg till ~25 nya nycklar for GDPR-texterna (sv, en, ar, fa) |

### Samtycken lagras i profilen
Befintliga `profiles.preferences` (jsonb) utvidgas med:
```json
{
  "consent": {
    "analytics": true,
    "ai_conversations": true,
    "body_data": true,
    "updated_at": "2025-02-19T..."
  }
}
```
Ingen databasmigration behövs -- `preferences` ar redan en flexibel jsonb-kolumn.

### Inga nya rutter
Allt byggs inom den befintliga `/settings/privacy`-sidan.

