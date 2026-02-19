
# Plan: "Smart Plan" – Fyra stora uppdateringar

Denna plan täcker fyra sammanhängande uppgraderingar för att göra Plan-sidan och appen i helhet markant smartare och mer personlig.

---

## Del 1: Bättre ICS-instruktioner i CalendarConnectBanner & CalendarSection

**Vad ändras:**
Ersätt de nuvarande kortfattade instruktionerna med fullständiga steg-för-steg-guider för Google Calendar, Outlook och Apple Calendar – exakt som de beskrivs i dina instruktioner.

**Filer som ändras:**
- `src/components/plan/CalendarConnectBanner.tsx` – utökat hjälp-avsnitt med detaljerade steg
- `src/components/settings/CalendarSection.tsx` – samma detaljerade instruktioner i inställningssidan

**Innehåll per kalender:**

Google Calendar:
1. Öppna Google Calendar i webbläsaren
2. I vänster kolumn under "Mina kalendrar", hovra över den kalender du vill dela
3. Klicka på ⋮ och välj "Inställningar och delning"
4. Scrolla ner till avsnittet "Integrera kalender"
5. Kopiera URL:en under "Hemlig adress i iCal-format"

Outlook / Microsoft 365:
1. Logga in på Outlook på webben, klicka på kugghjulet ⚙️ uppe till höger
2. Välj "Visa alla Outlook-inställningar" → Kalender → Delade kalendrar
3. Under "Publicera en kalender", välj kalender och behörighet (t.ex. "Kan se alla detaljer")
4. Klicka "Publicera"
5. Kopiera ICS-länken som visas

Apple Calendar (Mac):
1. Öppna Kalender-appen och hovra över kalendernamnet i listan
2. Klicka på delningsikonen (personikonen)
3. Markera "Offentlig kalender"
4. Kopiera den URL som börjar med webcal://

**Viktiga noteringar att visa:**
- Offentliga ICS-adresser kräver att kalendern är publik
- Om du inte hittar "Publicera" i Outlook kan IT-administratören ha blockerat funktionen

---

## Del 2: Smart kalenderbaserad outfit-rekommendation per dag i Plan

**Idé:** När en dag har kalenderevents som är synkade, ska Plan-vyn visa ett smart outfit-förslag kopplat till eventen – t.ex. "Du har möte + gym idag – vi rekommenderar jobb-outfit på morgonen och dessa träningsplagg eftermiddagen."

**Ny komponent:** `src/components/plan/SmartDayBanner.tsx`
- Tar in datum + kalenderhändelser
- Mappar händelser via `inferOccasionFromEvent()` (befintlig logik)
- Hittar matchande plagg per tillfälle från garderoben
- Renderar ett kompakt banner i DayCard med förslag på 1–3 plagg per occasion

**Ny hook:** `src/hooks/useSmartDayRecommendation.ts`
- Tar emot datum och events
- Fetchar plagg med rätt formality/kategori-matchning
- Returnerar upp till 2 "occasionslots" med rekommenderade plagg (t.ex. Jobb AM + Träning PM)

**Integration i DayCard:**
- Om händelser finns OCH inga outfits är planerade → visa SmartDayBanner med direkt knapp "Planera den här outfiten"
- Om outfit redan är planerad → visa en diskret "tips"-rad om händelserna avviker från outfit-typen

**Logik för plagg-matchning:**
```
Jobb/Möte    → formality 3-4, kategori överdel/underdel/skor
Fest/Middag  → formality 4-5, exkludera sportkläder
Träning/Gym  → formality 1-2, kategori sportkläder
Dejt         → formality 3-4, välj plagg med hög wear-popularity
```

---

## Del 3: Ny AI-chattflik i BottomNav

**Ny sida:** `src/pages/AIChat.tsx`
**Ny route:** `/ai` (skyddad med ProtectedRoute)
**Ny bottennavs-ikon:** `MessageCircle` eller `Bot` – placeras **mellan Insikter och Inställningar**

**Uppdatera BottomNav:**
```
Idag | Garderob | Plan | Insikter | AI | Inställningar
```
Eftersom 6 tabs är trångt på mobil → byt ut "Inställningar" till en ikon i sidhuvedet (PageHeader) istället, eller minska label-texten. Alternativt behålla 5 tabs och kombinera Insikter + AI (AI som tab i Insikter). Den renaste lösningen: **5 tabs totalt**, byt ut "Insikter" mot "AI" och flytta Insikter till en sub-vy inuti AI-sidan, eller lättare – **behåll 5 tabs, ersätt ingenting, lägg AI som ett plus-flöde**. 

Bästa val för minimal disruption: AI-ikonen **ersätter Insikter i bottennavigationen**, och Insikter nås istället via en länk i AI-sidan, ELLER vi lägger till en 6:e tab och gör den kompaktare med bara ikoner (inga labels) på mobil.

**Beslut i planen:** Lägg AI som tab nr 5 (sist, ersätter Inställningar i bottennavet) och flytta Inställningar-åtkomst till ett gear-ikon i PageHeader som finns på alla sidor. Alternativt håll 5 tabs men gör: Idag | Garderob | Plan | AI | Inställningar (ta bort Insikter från botten, nå via Idag/Home-sidan).

**Renaste lösningen:** Behåll alla 5 befintliga tabs + lägg till AI som 6:e fast med komprimerade labels (inga text-labels, bara ikoner + active-state). Eller – enklast: Ersätt "Insikter"-tabben med "AI", och nå Insikter via en knapp inne i AI-sidan.

**Slutbeslut för planen:** Håll 5 tabs. Lägg till AI-tabben och ta bort Insikter-tabben från botten; Insikter nås via en "Statistik"-knapp i AI-sidan.

**AI-chattens funktioner:**
- Välkomsthälsning: "Hej! Jag är din personliga stylist. Berätta om dig själv så kan jag ge bättre outfitförslag."
- Konversation om: ålder, stilpreferenser, vad man arbetar med, livsstil, occasions man besöker
- AI sparar svar i `profiles.preferences` (JSONB) under nycklar som `ai_learned_age`, `ai_learned_style`, osv.
- Konversationshistorik sparas i en ny `chat_messages`-tabell
- Använder befintlig `LOVABLE_API_KEY` via Lovable AI Gateway
- Edge function: `src/supabase/functions/style_chat/index.ts`

**Ny databas-migration:**
```sql
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
-- RLS: user ser bara egna meddelanden
```

---

## Del 4: Kroppsmått i onboarding + profil

**Vad läggs till:**
- Nytt steg i Onboarding (steg 0 eller steg 4 "Personlig profil")
- Fält: Längd (cm), Vikt (kg), valfri kropps-silhuett/typ
- Valfri bilduppladdning för kropp (sparas i Supabase Storage, privat bucket)

**Databas-migration:**
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS weight_kg INTEGER,
  ADD COLUMN IF NOT EXISTS body_image_path TEXT;
```

**Uppdaterade filer:**
- `src/pages/Onboarding.tsx` – nytt steg "Din kropp" med längd/vikt-inputs + valfri bilduppladdning
- `src/pages/Settings.tsx` – nytt avsnitt "Kroppsdata" under Profil-sektionen med samma fält
- `src/hooks/useProfile.ts` – typen uppdateras automatiskt via `types.ts`

**UI-design för kroppsmåtten:**
- Diskret, premium-känsla: "Hjälp din AI förstå din kropp för bättre passform-förslag"
- Längd: numerisk input med "cm"-suffix
- Vikt: numerisk input med "kg"-suffix (ej obligatorisk)
- Bilduppladdning: dold bakom "Valfritt – ladda upp en bild" expandable section
- Tydlig privacy-förklaring: "Bilden delas aldrig och används bara av din AI-stylist"

---

## Teknisk genomförandeordning

1. Databas-migrationer (chat_messages + profiles-kolumner)
2. Edge function `style_chat`
3. BottomNav + App.tsx (ny AI-route)
4. Ny `src/pages/AIChat.tsx`
5. ICS-instruktioner uppdateras i CalendarConnectBanner + CalendarSection
6. `SmartDayBanner` + `useSmartDayRecommendation`
7. DayCard integreras med SmartDayBanner
8. Onboarding-uppdatering med kroppsmått-steg
9. Settings-uppdatering med kroppsmått-sektion
