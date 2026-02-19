
# Settings -- Apple-stil med 5 navigeringsknappar

## Vad som andras

Ta bort tabs helt. Huvudsidan `/settings` visar bara 5 rena knappar (som Apple Settings). Varje knapp oppnar en egen undersida med tillbaka-pil.

## Ny layout

```text
/settings (huvudsida)
+----------------------------------+
|          Installningar           |
+----------------------------------+
|                                  |
|  +----------------------------+  |
|  | Utseende               >  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  | Stil                   >  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  | Notiser & Kalender     >  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  | Profil & Konto         >  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  | Data & Integritet      >  |  |
|  +----------------------------+  |
|                                  |
|  +----------------------------+  |
|  | Logga ut                   |  |
|  +----------------------------+  |
|                                  |
+----------------------------------+
```

Varje knapp navigerar till en undersida:

- `/settings/appearance` -- Tema, accentfarg, sprak
- `/settings/style` -- Kroppsmatt, farger, passform, stil
- `/settings/notifications` -- Notiser, kalendersynk
- `/settings/account` -- Premium, namn, e-post
- `/settings/privacy` -- Exportera data, radera konto

## De 5 undersidorna

Varje undersida anvander `PageHeader` med `showBack` och listar sina installningar med `SettingsGroup` / `SettingsRow` -- ren iOS-stil.

### 1. Utseende
- Tema (ljus/mork/auto)
- Accentfarg
- Sprak

### 2. Stil
- Kroppsmatt (langd, vikt, spara-knapp)
- Favoritfarger (chips)
- Ogillade farger (chips)
- Passform, standardstil, konsneutralt

### 3. Notiser & Kalender
- Morgonpaminnelse (switch)
- CalendarSection

### 4. Profil & Konto
- PremiumSection
- Visningsnamn
- E-post

### 5. Data & Integritet
- Exportera data
- Radera konto

## Tekniska steg

### 1. Skapa 5 nya sidkomponenter
- `src/pages/settings/SettingsAppearance.tsx`
- `src/pages/settings/SettingsStyle.tsx`
- `src/pages/settings/SettingsNotifications.tsx`
- `src/pages/settings/SettingsAccount.tsx`
- `src/pages/settings/SettingsPrivacy.tsx`

Varje sida flyttar relevant logik fran nuvarande `Settings.tsx`.

### 2. Forenkla `src/pages/Settings.tsx`
- Ta bort alla tabs, all logik
- Visa bara `PageHeader` + 5 `SettingsRow`-knappar med `ChevronRight` och `onClick={() => navigate('/settings/xxx')}`
- Plus en "Logga ut"-knapp langst ner

### 3. Lagg till routes i `src/App.tsx`
- 5 nya `<Route>` under `/settings/*`

### Filer som andras / skapas

| Fil | Andring |
|-----|---------|
| `src/pages/Settings.tsx` | Total forenkling -- bara 5 knappar |
| `src/pages/settings/SettingsAppearance.tsx` | Ny -- tema, farg, sprak |
| `src/pages/settings/SettingsStyle.tsx` | Ny -- kropp, farger, passform |
| `src/pages/settings/SettingsNotifications.tsx` | Ny -- notiser, kalender |
| `src/pages/settings/SettingsAccount.tsx` | Ny -- premium, profil |
| `src/pages/settings/SettingsPrivacy.tsx` | Ny -- export, radera |
| `src/App.tsx` | 5 nya routes |
