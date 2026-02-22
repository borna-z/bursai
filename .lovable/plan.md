

# Prisuppdatering: 59 kr/mån och 499 kr/år

Ändrar all prissättning i appen från 79 kr/mån + 699 kr/år till **59 kr/mån + 499 kr/år**, inklusive Stripe och alla UI-texter.

---

## 1. Skapa nya priser i Stripe

Nya Stripe Price-objekt behöver skapas:
- **Månadsvis**: 59 SEK/månad (recurring monthly)
- **Årsvis**: 499 SEK/år (recurring yearly)

De nya Price ID:na sparas sedan som secrets (ersätter befintliga `STRIPE_PRICE_ID_MONTHLY_*` och `STRIPE_PRICE_ID_YEARLY_*`).

## 2. Uppdatera Pricing-sidan (`src/pages/Pricing.tsx`)

Ändra de hårdkodade värdena:
- `monthlyPrice = 79` -> `59`
- `yearlyPrice = 699` -> `499`

Sparandeprocenten beräknas automatiskt och blir ~30% istället för ~26%.

## 3. Uppdatera alla översättningar (`src/i18n/translations.ts`)

Ersätt i **alla 14 språk** (sv, en, no, da, fi, de, fr, es, it, pt, nl, pl, ar, fa):

| Nyckel | Gammalt | Nytt |
|--------|---------|------|
| `premium.monthly` | 79 kr/månad | 59 kr/månad |
| `premium.yearly` | 699 kr/år (spara 26%) | 499 kr/år (spara 30%) |
| `trial.then_price` | Sedan 79 kr/månad eller 699 kr/år | Sedan 59 kr/månad eller 499 kr/år |
| `landing.premium_then` | Sedan 79 kr/månad ... 699 kr/år — spara ~26% | Sedan 59 kr/månad ... 499 kr/år — spara ~30% |
| `pricing.faq4_a` | ...spara 26% med årsplan | ...spara 30% med årsplan |

## 4. Uppdatera Stripe-secrets

Byta ut befintliga Price ID-secrets med de nyskapade Stripe-priserna:
- `STRIPE_PRICE_ID_MONTHLY_TEST` / `STRIPE_PRICE_ID_MONTHLY_LIVE`
- `STRIPE_PRICE_ID_YEARLY_TEST` / `STRIPE_PRICE_ID_YEARLY_LIVE`
- `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_YEARLY`

---

## Tekniska detaljer

### Filer som ändras:
1. **`src/pages/Pricing.tsx`** -- rad 45-46: ändra `79` -> `59`, `699` -> `499`
2. **`src/i18n/translations.ts`** -- ~20 strängar med prisreferenser i alla språk

### Stripe-åtgärder:
- Skapa 2 nya Price-objekt via Stripe-verktyg (59 SEK monthly, 499 SEK yearly)
- Uppdatera 6 secrets med nya Price IDs

### Ingen databasändring krävs
Priserna lagras inte i databasen -- de finns i Stripe och i UI-texter.

