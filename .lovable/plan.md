
# Förbättrad registreringsformulär med lösenordskrav, användarnamn och e-postbekräftelse

## Vad som ändras

Registreringsformuläret (signup-fliken) får fyra förbättringar:

1. **Lösenordskrav-checklista** -- visar regler som bockas av i realtid medan man skriver
2. **Visa/dölj lösenord** -- ögon-ikon i lösenordsfältet
3. **Användarnamn** -- nytt fält som sparas som `display_name` i profilen
4. **E-postbekräftelse** -- skriv e-post två gånger, formuläret validerar att de matchar

Login-fliken berörs inte (förblir enkel med bara e-post + lösenord).

## Lösenordskrav som visas

Fyra regler med checkmarks som blir gröna medan man skriver:

- Minst 8 tecken
- Minst en versal (A-Z)
- Minst en gemen (a-z)
- Minst en siffra (0-9)

## Tekniska detaljer

### 1. Databasändring -- ingen behövs

Profiltabellen har redan `display_name`. Användarnamnet sparas dit vid registrering via `user_metadata` som redan skickas vid auto-create i `useProfile`.

### 2. `src/pages/Auth.tsx`

- Importera `Eye`, `EyeOff`, `Check` ikoner från lucide-react
- Nya state-variabler (bara aktiva i signup-läge):
  - `username` (string)
  - `confirmEmail` (string)
  - `showPassword` (boolean)
- Signup-formuläret visar (i ordning):
  1. Användarnamn-fält
  2. E-post-fält
  3. Bekräfta e-post-fält
  4. Lösenord-fält med visa/dölj-knapp
  5. Lösenordskrav-checklista (4 regler med animerade checkmarks)
- Validering i `handleSignUp`:
  - Kontrollera att `email === confirmEmail` (annars toast-fel)
  - Kontrollera alla 4 lösenordskrav (annars toast-fel)
  - Skicka `username` som `display_name` i signup `user_metadata`
- Lösenordsfältet byter `type` mellan `password` och `text` via `showPassword`
- Visa/dölj-knappen visas även i login-formuläret

### 3. `src/contexts/AuthContext.tsx`

- Uppdatera `signUp`-funktionen att acceptera ett valfritt `displayName`-argument
- Skicka det som `data: { display_name: displayName }` i `options` till `supabase.auth.signUp`

### 4. `src/i18n/translations.ts`

Nya nycklar (sv + en, plus kompakta tillägg i övriga språk):

| Nyckel | SV | EN |
|---|---|---|
| `auth.username` | Användarnamn | Username |
| `auth.username_placeholder` | Ditt namn | Your name |
| `auth.confirm_email` | Bekräfta e-post | Confirm email |
| `auth.emails_no_match` | E-postadresserna matchar inte | Email addresses do not match |
| `auth.show_password` | Visa lösenord | Show password |
| `auth.hide_password` | Dölj lösenord | Hide password |
| `auth.req_length` | Minst 8 tecken | At least 8 characters |
| `auth.req_uppercase` | Minst en versal (A-Z) | At least one uppercase letter (A-Z) |
| `auth.req_lowercase` | Minst en gemen (a-z) | At least one lowercase letter (a-z) |
| `auth.req_number` | Minst en siffra (0-9) | At least one number (0-9) |

### 5. Checklista-design

Varje regel visas som en rad med:
- Grön check-ikon (lucide `Check`) om uppfylld, annars en cirkel-outline i vit/20
- Text i vit/40 (ej uppfylld) eller vit/70 (uppfylld)
- Mjuk transition vid ändring

Placeras direkt under lösenordsfältet, bara synlig i signup-läge.
