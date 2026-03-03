

# Localized Pricing on Landing Page

## Problem
All 14 languages currently show prices in SEK ("kr"), even for users viewing in German (should be €), English (could be £), Arabic (could be AED), etc.

## Approach
Rather than doing runtime geolocation (unreliable, adds latency), we tie currency to the **selected language** — since language already implies region. This is how Spotify, Apple, and most SaaS apps handle it.

### Currency mapping

| Language | Currency | Free | Monthly | Yearly |
|----------|----------|------|---------|--------|
| sv (Swedish) | SEK | 0 kr | 59 kr | 499 kr |
| no (Norwegian) | NOK | 0 kr | 59 kr | 499 kr |
| da (Danish) | DKK | 0 kr | 39 kr | 329 kr |
| fi (Finnish) | EUR | €0 | €4.99 | €44.99 |
| en (English) | GBP | £0 | £3.99 | £34.99 |
| de (German) | EUR | €0 | €4.99 | €44.99 |
| fr (French) | EUR | €0 | €4.99 | €44.99 |
| es (Spanish) | EUR | €0 | €4.99 | €44.99 |
| it (Italian) | EUR | €0 | €4.99 | €44.99 |
| pt (Portuguese) | EUR | €0 | €4.99 | €44.99 |
| nl (Dutch) | EUR | €0 | €4.99 | €44.99 |
| pl (Polish) | PLN | 0 zł | 19,99 zł | 179 zł |
| ar (Arabic) | AED | 0 د.إ | 19 د.إ | 169 د.إ |
| fa (Farsi) | IRR | Display in EUR as fallback |

*Note: These are approximate equivalents of 59 SEK/month. You can adjust exact amounts before implementation.*

### Changes

**1. Update `src/i18n/translations.ts`** — For each of the 14 languages, update these 3 translation keys:
- `landing.free_price` — currency-appropriate "0"
- `landing.premium_price` — currency-appropriate "0" (trial)
- `landing.premium_then` — localized "Then X/month · or Y/year — save ~30%"

**2. No component changes needed** — `PricingSection.tsx` already reads all prices from translation keys, so it will automatically display the correct currency once translations are updated.

### Important note
This is a **display-only** change for the landing page. The actual Stripe checkout still charges in SEK (59 kr / 499 kr). If you want to charge in different currencies, that requires separate Stripe Price IDs per currency — a bigger change we can tackle separately.

