# M3 — App Store Connect copy (v1.0.0)

**Owner:** Claude drafts → Borna signs off → Borna pastes into App Store Connect.
**Locale:** English (Sweden primary market, but App Store metadata is English for first submission — Swedish localization deferred to v1.1).
**App name shown in store:** `BURS`
**Subtitle (30 chars max):** `Your AI personal stylist`
**Bundle ID:** `me.burs.app`

---

## Promotional text (170 chars max — editable post-launch without re-review)

> Snap your clothes, get outfit ideas in seconds. BURS learns your taste and turns your wardrobe into daily outfits — built for the way you actually dress.

**Char count:** 168 / 170.

---

## Description (4000 chars max)

> BURS turns your wardrobe into a personal stylist.
>
> Snap a photo of every garment you own once — BURS handles the background, categorizes it, and remembers it. Then ask for an outfit: "something for a 12°C walk to coffee," "what works with these new boots," or just "what should I wear today." You get suggestions built entirely from clothes you already own.
>
> **Why BURS is different**
>
> Most styling apps either show you outfits with clothes you'd have to buy, or ask you to spend hours tagging your wardrobe. BURS does neither. Add a garment in under five seconds. Get an outfit in under three. Every suggestion comes from your real closet.
>
> **What you can do**
>
> • Build your wardrobe — Photograph or batch-import garments. BURS removes backgrounds, names them, and groups by category, color, and warmth.
> • Generate outfits — Daily picks based on weather and what's clean. Or open Style Me to pick an occasion (Work, Date, Travel…), nudge the weather slider, and let BURS build a look from your closet. There's a Custom occasion field if you want to type your own ("brunch with my in-laws," "long flight").
> • Plan ahead — Save any generated outfit to a date from the outfit screen. BURS uses the day's forecast when it suggests what to wear.
> • Travel capsules — Tell BURS "5 days, Lisbon, casual." It picks the smallest set of garments that mixes into the most outfits.
> • Wear log — One tap to mark what you wore. Over time, BURS notices what you actually reach for and what's gathering dust.
> • Wardrobe gaps — See where you're under-served (e.g., "you have nine tops and one pair of trousers that work with them").
> • Outfit photo feedback — Snap a fit, get a quick read from your stylist. Friendly, not preachy.
>
> **What BURS doesn't do**
>
> No social feed. No follower count. No content to scroll. BURS is a tool, not another timeline.
>
> **Subscription**
>
> BURS is free to try. Premium unlocks unlimited outfit generations, travel capsules, wardrobe gap analysis, and outfit photo feedback.
>
> • Monthly: 119 SEK / month
> • Annual: 899 SEK / year (37% off monthly)
>
> 3-day free trial on first subscription. Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date. Manage in Settings → Subscriptions on your Apple ID.
>
> Privacy: burs.me/privacy
> Terms: burs.me/terms
> Support: hello@burs.me

**Char count:** 2,278 / 4,000.

---

## Keywords (100 chars max — comma-separated, no spaces after commas)

> stylist,outfit,wardrobe,closet,fashion,clothing,smart,style,what to wear,ootd,capsule,travel,planner

**Char count:** 100 / 100.

**Rationale:**
- High-intent search terms first ("stylist", "outfit", "wardrobe").
- Long-tail discovery: "what to wear" is a top App Store query in fashion.
- "ootd" captures the daily-outfit content angle without spending a slot on a hashtag.
- "smart" replaces "AI" — Apple's keyword field requires each token to be **greater than 2 characters** (https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information). "AI" (2 chars) would block the metadata save. "smart" captures the AI-adjacent positioning while staying compliant.
- "capsule" and "travel" target the Travel Capsule feature directly.

---

## What's New (release notes — v1.0.0)

> Welcome to BURS. Snap your wardrobe, get outfit ideas in seconds, and let your AI stylist learn what you actually wear. Plan ahead with the calendar, pack smart with travel capsules, and see your style come together over time.

**Char count:** 235 / 4,000.

---

## Categories

- **Primary:** Lifestyle
- **Secondary:** Shopping

**Rationale:** Lifestyle is where every personal-styling app indexes (Stylebook, Whering, Indyx). Shopping captures the wardrobe-management/inventory angle without the "fashion ecommerce" connotation that would mislead reviewers.

---

## Age rating

**Recommended: 4+** (Apple) — no objectionable content, no user-generated public content, no in-app purchases beyond auto-renewing subscriptions.

Questionnaire answers (all NO unless noted):
- Cartoon or fantasy violence: NO
- Realistic violence: NO
- Sexual content or nudity: NO
- Profanity or crude humor: NO
- Alcohol, tobacco, or drug use: NO
- Mature/suggestive themes: NO
- Horror/fear themes: NO
- Medical/treatment information: NO
- Gambling and contests: NO
- Unrestricted web access: NO (no in-app browser; external links open in Safari)
- User-generated content visible to others: NO (wardrobe is private)
- Frequent/intense versions of the above: NO

---

## URLs

| Field | URL |
|---|---|
| Marketing URL | https://burs.me |
| Support URL | https://burs.me/support |
| Privacy Policy URL | https://burs.me/privacy |

**Borna action items before submission:**
- **`burs.me/support` MUST be a live HTTPS webpage** (not a `mailto:` URL). Apple's App Store Connect reference defines the Support URL as the URL of a support website and requires the full HTTPS protocol — `mailto:` URLs fail metadata validation (https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information). Build a minimal static page on `burs.me/support` with the support email (`hello@burs.me`) plus FAQ / contact form before submission.
- Confirm `burs.me/privacy` is live with the data declarations matched in `M3-privacy-declarations.md`.

---

## In-app purchases — display copy

For App Store Connect's IAP metadata fields (separate from the descriptive text above):

### `burs_premium_monthly_119sek`

- **Display name (30 chars):** `Premium Monthly`
- **Description (45 chars):** `Unlimited outfits, capsules, and feedback.`

### `burs_premium_annual_899sek`

- **Display name (30 chars):** `Premium Annual`
- **Description (45 chars):** `Save 37% — full access for a year.`

---

## Common Apple rejection reasons — pre-screen

| Guideline | Risk | Mitigation in v1.0.0 |
|---|---|---|
| 3.1.1 In-App Purchase | Apple requires StoreKit for digital subscriptions. | RevenueCat wraps StoreKit; no external payment links surfaced in iOS app. |
| 3.1.2 Subscriptions | Must disclose price, period, renewal, cancellation. | Disclosure block above + Settings → Subscriptions deep link. |
| 4.0 Design / 4.2 Minimum Functionality | "Looks like a wrapper / no real functionality." | Five distinct features (wardrobe, generate, plan, capsule, feedback). |
| 5.1.1 Privacy — Data Collection and Storage | Need privacy policy URL + App Privacy Details. | Live URL + completed declarations (see `M3-privacy-declarations.md`). |
| 5.1.1(v) Account Deletion | iOS apps that allow account creation must allow in-app deletion. | `delete_user_account` edge function (deployed) + Settings → Account → Delete Account. |
| 2.1 App Completeness | Demo account must reproduce paid features. | Demo flow in `M3-reviewer-demo.md`. |
