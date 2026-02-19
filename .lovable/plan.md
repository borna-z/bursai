
# Settings -- iPhone-inspirerad redesign med flikar

## Vad som andras

Den nuvarande settings-sidan ar en lang scrollbar lista med cards. Den nya designen grupperar allt i tre rena flikar med ett iOS-liknande utseende: listor med rader istallet for separata cards.

## Ny layout

```text
+----------------------------------+
|          Installningar           |
+----------------------------------+
|  [Allmant]  [Stil]  [Konto]      |  <-- TabsList (sticky under header)
+----------------------------------+
|                                  |
|  Tab content (no cards, just     |
|  grouped list rows like iOS)     |
|                                  |
+----------------------------------+
```

### Flik 1: Allmant (General)
- Utseende (ljust/morkt/auto) -- segmented control
- Accentfarg -- fargvaljare
- Sprak -- valj sprak
- Notiser -- morning reminder switch
- Kalendersynk

### Flik 2: Stil (Style)
- Kroppsmatt (langd, vikt)
- Favoritfarger (chips)
- Ogillade farger (chips)
- Passform (select)
- Standardstil (select)
- Kosneutrala forslag (switch)

### Flik 3: Konto (Account)
- Premium/Plan-sektion
- Profil (namn, e-post)
- Exportera data
- Radera konto
- Logga ut

## iOS-stil design

Istallet for separata `Card`-komponenter anvands grupperade listor med tunn separator-linje mellan rader, liknande iOS Settings:

- Rader med etikett till vanster och kontroll/varde till hoger
- Grupperade sektioner med rubrik ovanfor
- Rundade horn pa grupper, inte individuella rader
- Rent, avskalat, mycket whitespace

## Tekniska steg

### 1. Omstrukturera `src/pages/Settings.tsx`
- Importera `Tabs, TabsList, TabsTrigger, TabsContent` fran `@/components/ui/tabs`
- Skapa tre TabsContent-sektioner: "general", "style", "account"
- Flytta befintlig logik till respektive flik
- Byt fran Card-per-sektion till grupperade div-listor med iOS-stil

### 2. Skapa `src/components/settings/SettingsRow.tsx` (ny komponent)
- En aterkommande rad-komponent: ikon + etikett till vanster, kontroll till hoger
- Separator mellan rader (utom sista i grupp)
- Anvands av alla tre flikar

### 3. Skapa `src/components/settings/SettingsGroup.tsx` (ny komponent)
- En grupp-wrapper med rubrik, rundade horn, bg-card
- Automatisk separator mellan barn-rader

### 4. Uppdatera TabsList-stil
- Sticky under PageHeader
- Anvand accent-farg for aktiv flik-indikator
- Full bredd, jamt fordelad

### Filer som andras / skapas

| Fil | Andring |
|-----|---------|
| `src/components/settings/SettingsRow.tsx` | Ny -- atervandbar iOS-stilrad |
| `src/components/settings/SettingsGroup.tsx` | Ny -- gruppwrapper med rubrik |
| `src/pages/Settings.tsx` | Total omstrukturering med Tabs + nya komponenter |
