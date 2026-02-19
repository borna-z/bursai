

# Internationalisering av alla sidor med hårdkodad svensk text

## Sammanfattning

Hela appen har ca **300+ hårdkodade svenska strängar** spridda över 10+ sidor och komponenter som behöver ersättas med `t()` anrop och läggas till i translations.ts for alla 12 språk. Idag används `useLanguage` / `t()` bara i onboarding, nav och settings-titlar.

---

## Sidor och strängar som berörs

### 1. Home.tsx (~40 strängar)
- Occasions: "Vardag", "Jobb", "Fest", "Dejt", "Träning", "Resa"
- Style vibes: "Minimal", "Street", "Smart casual", "Klassisk"
- Weather: "Ingen", "Regn", "Snö", "Låg", "Medel", "Hög"
- Greeting: "God morgon", "God dag", "God kväll"
- Labels: "Vad ska du göra idag?", "Väder", "Hjälper AI:n välja rätt plagg", "Temperatur", "Nederbörd", "Vind", "Stil (valfritt)", "Skapa outfit", "Lägg till minst 3 plagg...", "Senaste outfit", "Kom igång", "Din garderob", "plagg", "Hämtar väder...", "Redigera", "Använd auto", "Försök igen"

### 2. Settings.tsx (~35 strängar)
- "Inställningar", "Utseende", "Ljust", "Mörkt", "Auto"
- "Profil", "Visningsnamn", "Ditt namn", "Spara", "E-post:"
- "Kroppsdata", "Hjälper din AI-stylist...", "Längd", "Vikt", "(valfritt)", "Spara mått", "Sparat!"
- "Stilpreferenser", "Favoritfärger", "Ogillade färger", "Passform", "Standard stil", "Könsneutral styling"
- "Notiser", "Morgonpåminnelse"
- "Integritet", "Exportera data", "Radera konto", "Radera konto permanent?", delete dialog items, "Logga ut"
- Toast messages: "Namn sparat", "Kunde inte spara...", "Data exporterad", etc.

### 3. Auth.tsx (~15 strängar)
- "Din personliga stylist.", "Logga in", "Skapa konto", "E-post", "Lösenord", "Loggar in...", "Skapar konto..."
- Errors: "Vänligen fyll i alla fält", "Fel e-post eller lösenord", "Lösenordet måste vara minst 6 tecken", etc.

### 4. Wardrobe.tsx (~30 strängar)
- Categories: "Alla", "Nya", "Överdel", "Underdel", "Skor", "Ytterkläder", "Accessoar", "Klänning"
- Colors, seasons, sort options
- "Garderob", "Välj", "Avbryt", "Sök...", "Filter", "Sortera", "Färg", "Säsong", "Rensa"
- "Ny", "I tvätt", "Snabbredigera", "Gräns nådd", "Uppgradera", "Inga resultat", "Inga plagg än"
- Bulk: "valda", "Tvätt", "Ta bort"

### 5. Outfits.tsx (~15 strängar)
- "Outfits", "Ny", "Senaste", "Sparade", "Planerade", "Inga outfits", "Skapa din första!", "Inga sparade", "Radera?", "Kan inte ångras.", "Avbryt", "Radera"

### 6. OutfitDetail.tsx (~30 strängar)
- Feedback: "För varmt", "För kallt", "För formellt", "För casual"
- Slot labels: "Överdel", "Underdel", "Skor", "Ytterkläder", "Accessoar"
- "Byt", "Ny outfit skapad!", "Varför detta funkar", "Betyg", "Feedback"
- "Markera använd", "Använd", "Planera", "Liknande"
- Share: "Dela", "Delning", "Publik länk aktiv", "Privat", "Länk", "Kopiera", "Kopierad!", "Ladda ner", "Aktivera för länk"
- "Hittades inte", "Tillbaka", "Inga alternativ", "Lägg till fler plagg"

### 7. AddGarment.tsx (~25 strängar)
- "Lägg till plagg", "Foto", "Länk", "Ta ett foto eller välj från galleriet", "Kamera", "Galleri"
- "AI analyserar plagget...", "Granska plagg", "Analysera igen"
- Form labels: "Titel", "Kategori", "Underkategori", etc.
- All subcategories, patterns, materials, fits, seasons

### 8. GarmentDetail.tsx (~15 strängar)
- "Hittades inte", "Tillbaka", "Radera?", "Avbryt", "Radera", "Markera använd"
- "använd", "senast", "Aldrig", "I tvätt", "Importerat från länk", "Öppna", "Formalitet:"

### 9. AIChat.tsx (~10 strängar)
- Welcome message, "DRAPE Stylisten", "Skriv till din stylist...", "Beskriv din outfit (valfritt)..."
- "AI-stylist · Råd är personliga, inte professionella"
- Errors and toasts

### 10. LiveScan.tsx (~10 strängar)
- "Auto", "skannade", "Klar", "Håll plagget stilla...", "Rikta mot ett plagg", "Analyserar...", "Tillagt!"
- "Ta om", "Godkänn", "platser kvar", "Gräns nådd"

### 11. Insights.tsx (~15 strängar)
- "Insikter", "Plagg totalt", "Använda (30d)", "Utnyttjande", "Senaste 30 dagarna", "Topplagg", "Mest använda (30d)"
- "Färger", "Dina vanligaste", "Oanvända pärlor", "Oanvända", "Lås upp alla insikter", "Få fler outfits"

### 12. Plan.tsx + DaySummaryCard.tsx (~10 strängar)
- "Din dag", "Planera utifrån detta"
- Various occasion labels in DaySummaryCard

---

## Teknisk plan

### Steg 1: Utöka translations.ts med ~200 nya nycklar

Lägga till alla nycklar i `sv`-blocket och sedan replikera till alla 11 andra språk (en, no, da, fi, de, fr, es, it, pt, nl, pl). 

Nyckelstruktur:
```
home.occasion.vardag, home.occasion.jobb, ...
home.weather.none, home.weather.rain, ...
home.style.minimal, home.style.street, ...
home.your_wardrobe, home.garments_count, ...
settings.appearance, settings.body_data, ...
auth.login, auth.signup, auth.email, ...
wardrobe.title, wardrobe.select, wardrobe.all, ...
outfits.title, outfits.recent, outfits.saved, ...
outfit.swap, outfit.rating, outfit.share, ...
garment.not_found, garment.delete_confirm, ...
addgarment.title, addgarment.photo, addgarment.link, ...
chat.title, chat.welcome, chat.placeholder, ...
scan.auto, scan.scanned, scan.done, ...
insights.title, insights.total, insights.used_30d, ...
plan.your_day, plan.plan_from_this, ...
```

### Steg 2: Refaktorera varje sida

Importera `useLanguage` i varje sida och ersätt alla hårdkodade strängar med `t('nyckel')`.

For arrays (occasions, categories, etc.), behåll `id` men ersätt `label` med `t()`:
```typescript
const occasions = [
  { id: 'vardag', labelKey: 'home.occasion.vardag' },
  ...
];
// Render: t(occasion.labelKey)
```

### Steg 3: Uppdatera komponenter som används i sidorna
- `DaySummaryCard.tsx` - "Din dag", "Planera utifrån detta"
- `OutfitSlotCard.tsx` - slot labels
- `QuickEditPanel.tsx` - om den har hårdkodad text
- `EmptyState` - titlar/descriptions som skickas som props (hanteras i sidorna)
- `CalendarSection.tsx` - synk-relaterad text

---

## Filkomplexitet

| Fil | Strängar | Komplexitet |
|-----|----------|-------------|
| `translations.ts` | ~200 nya nycklar x 12 språk | Hög (bulk) |
| `Home.tsx` | ~40 | Medel |
| `Settings.tsx` | ~35 | Medel |
| `Wardrobe.tsx` | ~30 | Medel |
| `OutfitDetail.tsx` | ~30 | Medel |
| `AddGarment.tsx` | ~25 | Medel |
| `Auth.tsx` | ~15 | Låg |
| `Outfits.tsx` | ~15 | Låg |
| `GarmentDetail.tsx` | ~15 | Låg |
| `Insights.tsx` | ~15 | Låg |
| `AIChat.tsx` | ~10 | Låg |
| `LiveScan.tsx` | ~10 | Låg |
| `DaySummaryCard.tsx` | ~5 | Låg |
| `CalendarSection.tsx` | ~10 | Låg |

Totalt: ~14 filer att ändra, ~200 nya översättningsnycklar i 12 språk.

---

## Ordning

1. **Först**: Utöka `translations.ts` med alla nya nycklar (svenska som bas, sedan alla 11 andra språk)
2. **Sedan**: Refaktorera sidorna i grupper -- Home + Settings + Auth (mest använda), sedan Wardrobe + Outfits + OutfitDetail, sedan resterande
3. **Sist**: Verifiera att inga hårdkodade strängar finns kvar

