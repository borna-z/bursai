
## Fix: Saknad profilrad orsakar evig laddningsloop

### Problem
Användaren `9505f10f-...` (borna.zavareh@nordiskainglasningar.se) är autentiserad men har **ingen rad i `profiles`-tabellen**. Triggern `handle_new_user` misslyckades eller kördes aldrig vid registrering. Detta gör att:
- `useProfile` returnerar 0 rader (406-fel)
- `Index.tsx` fastnar i en evig spinner som väntar på profildata
- Appen ser "död" ut trots att användaren är inloggad

### Lösning

#### Steg 1: Infoga saknad profilrad via SQL-migration
Kör en SQL-sats som skapar profilraden för den befintliga användaren:
```sql
INSERT INTO public.profiles (id, display_name, preferences)
VALUES (
  '9505f10f-6371-48d7-b148-00b5cde64ace',
  'borna.zavareh',
  '{"onboarding": {"completed": false}}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
```

#### Steg 2: Gör appen motståndskraftig mot saknade profiler
Uppdatera `src/pages/Index.tsx` och `src/hooks/useProfile.ts` så att en saknad profil inte orsakar en evig loop:

- **`useProfile.ts`**: Om profilen inte hittas (0 rader), returnera `null` istället för att kasta ett fel
- **`Index.tsx`**: Om profilen är `null` efter laddning, skicka användaren till onboarding (eller skapa profilen automatiskt)

#### Steg 3: Lägg till en säkerhetsmekanism i `AuthContext`
Lägg till en fallback som skapar profilen om den saknas vid inloggning, så att detta aldrig händer igen.

### Tekniska detaljer

Filen `src/hooks/useProfile.ts` behöver granskas för att se hur den hanterar `.single()`-anrop som returnerar 0 rader. PostgREST returnerar 406 när `.single()` inte hittar exakt en rad, vilket sannolikt kastar ett fel istället för att returnera `null`.

Fixarna säkerställer att:
- Din befintliga session börjar fungera omedelbart
- Framtida användare aldrig fastnar i samma loop
- Appen hanterar saknade profiler gracefully
