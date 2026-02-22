

# Prisuppdatering: 59 kr/mån och 499 kr/år

Ändrar all prissättning i appen från 79 kr/mån + 699 kr/år till **59 kr/mån + 499 kr/år**. Sparandeprocenten uppdateras från ~26% till ~30%.

---

## Steg 1 -- Skapa nya Stripe-priser

Eftersom Stripe-verktyget för att skapa produkter inte kunde användas direkt, behöver vi skapa nya Price-objekt manuellt i Stripe Dashboard:

- **BURSE Premium Monthly**: 5900 öre (59 SEK), recurring monthly
- **BURSE Premium Yearly**: 49900 öre (499 SEK), recurring yearly

Sedan uppdateras secrets med de nya Price ID:na:
- `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_MONTHLY_TEST` / `STRIPE_PRICE_ID_MONTHLY_LIVE`
- `STRIPE_PRICE_ID_YEARLY` / `STRIPE_PRICE_ID_YEARLY_TEST` / `STRIPE_PRICE_ID_YEARLY_LIVE`

**Alternativ**: Om du redan har skapat dessa priser i Stripe Dashboard, meddela mig Price ID:na (format: `price_xxx`) så uppdaterar jag secrets direkt.

---

## Steg 2 -- Uppdatera Pricing-sidan

**Fil**: `src/pages/Pricing.tsx` (rad 45-46)

Ändra:
- `monthlyPrice = 79` till `monthlyPrice = 59`
- `yearlyPrice = 699` till `yearlyPrice = 499`

Sparandeprocenten beraknas automatiskt och blir ~30%.

---

## Steg 3 -- Uppdatera alla oversattningar

**Fil**: `src/i18n/translations.ts`

Folande nycklar uppdateras i **alla 14 sprak** (sv, en, no, da, fi, de, fr, es, it, pt, nl, pl, ar, fa):

| Nyckel | Gammalt varde | Nytt varde |
|--------|--------------|------------|
| `premium.monthly` | 79 kr/manad | 59 kr/manad |
| `premium.yearly` | 699 kr/ar (spara 26%) | 499 kr/ar (spara 30%) |
| `trial.then_price` | Sedan 79 kr/manad eller 699 kr/ar | Sedan 59 kr/manad eller 499 kr/ar |
| `landing.premium_then` | 79 kr/manad ... 699 kr/ar -- spara ~26% | 59 kr/manad ... 499 kr/ar -- spara ~30% |
| `pricing.faq4_a` | spara 26% med arsplan | spara 30% med arsplan |

Totalt ca 60+ strangar som behover andras (5 nycklar x 14 sprak).

---

## Steg 4 -- Uppdatera Stripe secrets

Sex secrets uppdateras med de nya Price ID:na fran Stripe. Befintliga edge functions (`create_checkout_session`, `restore_subscription`, `stripe_webhook`) behover inte andras -- de laser redan Price ID fran secrets dynamiskt.

---

## Tekniska detaljer

### Filer som andras:
1. `src/pages/Pricing.tsx` -- 2 rader (hardkodade prisvarden)
2. `src/i18n/translations.ts` -- ~60 strangar (prisreferenser i alla sprak)

### Filer som INTE andras:
- `supabase/functions/create_checkout_session/index.ts` -- laser Price ID fran environment secrets
- `supabase/functions/_shared/stripe-config.ts` -- ingen andring behövs
- Ingen databasandring kravs

### Stripe-atgarder:
- Skapa 2 nya Price-objekt i Stripe Dashboard (59 SEK monthly, 499 SEK yearly) for produkten "BURSE Premium"
- Uppdatera 6 secrets med nya Price IDs

