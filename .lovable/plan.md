

# Onboarding som del av kontoskapandet

## Vad ändras

Idag är onboarding en separat sida (`/onboarding`) som man kan nå från hemskärmen. Med denna ändring blir onboarding **automatiskt** en del av flödet direkt efter att man skapar ett konto. Nya användare ser onboarding-stegen innan de kommer till appen.

## Hur det fungerar

1. Efter signup/login kollar `ProtectedRoute` om användaren har slutfört onboarding
2. Om inte -- omdirigeras de automatiskt till `/onboarding`
3. Användaren kan inte komma till appen förrän onboarding är klar (eller hoppas över)
4. Befintliga användare som redan har profiler påverkas inte

```text
Signup/Login
     |
     v
ProtectedRoute kollar profil
     |
     +-- Ny användare (onboarding ej klar) --> /onboarding
     |
     +-- Befintlig användare --> Appen (/)
```

## Tekniska steg

### 1. Uppdatera `ProtectedRoute.tsx`

- Importera `useProfile` för att hämta användarens profil
- Kolla om `preferences.onboarding.completed === true` i profilen
- Om inte: `<Navigate to="/onboarding" />` (utom om man redan är på `/onboarding`)
- Skapa en wrapper-variant eller lägg till en prop `skipOnboardingCheck` för onboarding-routen själv (annars blir det en oändlig loop)

### 2. Uppdatera `Auth.tsx`

- Efter lyckad signup: navigera till `/onboarding` istället för `/` (redan hanterat av ProtectedRoute, men byt redirect)
- Ta bort redirect till `/` för nya användare

### 3. Uppdatera `App.tsx` routing

- Behåll `/onboarding` routen men gör den till en ProtectedRoute **utan** onboarding-check (prop `skipOnboardingCheck`)
- Se till att alla andra skyddade routes har onboarding-check

### 4. Uppdatera `Onboarding.tsx`

- Behåll befintligt flöde (språk, accent, mått, steg 1-3)
- Vid "Slutför" navigera till `/`
- Ta bort "Hoppa över allt"-länken eller behåll den som "Slutför och börja" (markerar onboarding som klar)

### Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/components/auth/ProtectedRoute.tsx` | Lägg till profil-check + redirect till onboarding |
| `src/pages/Auth.tsx` | Redirect nya användare till onboarding |
| `src/App.tsx` | Uppdatera onboarding-routen med skipOnboardingCheck |
| `src/pages/Onboarding.tsx` | Justera "hoppa över"-beteende |

