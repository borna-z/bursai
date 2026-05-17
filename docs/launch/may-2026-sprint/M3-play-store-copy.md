# M3 — Google Play Console copy (v1.0.0)

**Owner:** Claude drafts → Borna signs off → Borna pastes into Play Console.
**Default language:** English (United Kingdom) — most permissive English locale for Sweden + Nordics + UK + NL launch markets.
**Package name:** `me.burs.app`

---

## App title (30 chars max)

> `BURS: AI Outfit Stylist`

**Char count:** 23 / 30.

**Rationale:** "AI Outfit Stylist" is the canonical Play Store search phrase for this category (higher volume than "wardrobe"). "BURS:" keeps brand recall while letting the keyword phrase land in the indexed half of the title.

---

## Short description (80 chars max — shown in search results)

> Snap your wardrobe. Get outfit ideas instantly. Your AI stylist, every day.

**Char count:** 75 / 80.

---

## Full description (4000 chars max)

> **BURS turns your wardrobe into a personal stylist.**
>
> Photograph each garment you own once — BURS removes the background, names it, and categorizes it. Then ask for an outfit and get suggestions built entirely from clothes you already have. No "buy this" links. No mood boards full of clothes that aren't yours.
>
> ---
>
> **What BURS does**
>
> 👕 **Build your wardrobe in seconds.** Snap a photo, or batch-import several at once. BURS handles backgrounds, names, and categories.
>
> 🎨 **Get outfit ideas on demand.** "What works for 12°C and rainy?" "Something for a job interview." "What can I do with these new boots?" BURS answers with outfits from your actual closet.
>
> 📅 **Plan your week.** Drag outfits onto your calendar. Weather data folds into the suggestion when you've connected location.
>
> ✈️ **Travel capsules.** Tell BURS the trip ("5 days, Lisbon, casual") and get the smallest set of garments that mixes into the most outfits.
>
> 📝 **Wear log.** One tap to mark what you wore. Over time BURS learns what you actually reach for — and what's been sitting unworn.
>
> 🪞 **Wardrobe gaps.** See where your closet is under-served before you shop again.
>
> 📸 **Outfit photo feedback.** Snap a fit, get a quick honest read.
>
> ---
>
> **What BURS doesn't do**
>
> No social feed. No follower count. No content to scroll. BURS is a private tool, not another timeline.
>
> ---
>
> **Subscription**
>
> Free to try. Premium unlocks unlimited outfit generations, travel capsules, wardrobe gap analysis, and outfit photo feedback.
>
> • Monthly: 119 SEK / month
> • Annual: 899 SEK / year (saves 37%)
>
> Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date. Manage in your Google Play account.
>
> ---
>
> **Privacy first**
>
> Your wardrobe is yours. We never sell your data. Read the full privacy policy: burs.me/privacy
>
> Support: hello@burs.me

**Char count:** 1,634 / 4,000.

---

## Categorization

- **App category:** Lifestyle
- **Tags (Play Store taxonomy, choose up to 5):** Personal Style, Wardrobe, Travel Outfit, Fashion Inspiration, Daily Outfit

---

## Content rating (Google IARC questionnaire)

**Recommended outcome: PEGI 3 / ESRB Everyone.**

Questionnaire answers:

| Question | Answer |
|---|---|
| Violence | No |
| Sexual content | No |
| Profanity | No |
| Controlled substances | No |
| Gambling | No |
| User-generated content shared publicly | No (wardrobe is private) |
| User-to-user interaction | No |
| Shares user location with other users | No |
| Allows users to purchase digital goods | Yes (subscriptions) |
| Unrestricted internet access | No |
| Stores user info | Yes (account + wardrobe content) |
| Digital purchases | Yes (auto-renewing subscriptions only) |

---

## Target audience and content

- **Target age groups:** 13–15, 16–17, 18+
- **Appeals to children:** No
- **Mixed audience disclosure:** N/A (does not appeal to children).

---

## Ads declaration

- **App contains ads:** No.
- **Rationale:** No in-app advertising in v1.0.0. The Meta Ads agent (Plan B) advertises *about* BURS on Meta platforms; it does not show ads inside the app.

---

## Government apps / news / VPN

All NO.

---

## Pricing and distribution

- **Pricing:** Free with in-app subscription.
- **Countries (initial launch):** Sweden (primary), Denmark, Norway, Finland, Iceland, United Kingdom, Netherlands.
- **Distribution channels:** Google Play only (no third-party app stores in v1.0.0).

---

## In-app products — Play Console copy

### `burs_premium_monthly_119sek`

- **Product name (55 chars):** `Premium Monthly — Unlimited Outfits`
- **Description (200 chars):** `Unlock unlimited outfit generations, travel capsules, wardrobe gap analysis, and outfit photo feedback. Cancel anytime in Google Play.`

### `burs_premium_annual_899sek`

- **Product name (55 chars):** `Premium Annual — Save 37%`
- **Description (200 chars):** `Full Premium access for a year. Unlimited outfits, travel capsules, gap analysis, photo feedback. Cancel anytime in Google Play.`

---

## Release notes (What's new — v1.0.0)

> Welcome to BURS. Snap your wardrobe, get outfit ideas in seconds, and let your AI stylist learn what you actually wear. Plan ahead with the calendar, pack smart with travel capsules, and see your style come together over time.

**Char count:** 235 / 500.

---

## Graphics requirements (Borna to capture)

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit, no transparency | TODO |
| Feature graphic | 1024×500 PNG/JPEG | TODO |
| Phone screenshots | 1080×1920 portrait, 3–8 frames | TODO |
| 7" tablet screenshots | Optional — skip for v1.0.0 | SKIP |
| 10" tablet screenshots | Optional — skip for v1.0.0 | SKIP |
| Promo video (YouTube URL) | Optional — skip for v1.0.0 | SKIP |

**Screenshot order (recommended):**
1. Outfit generation result screen — hero shot, full-bleed
2. Wardrobe grid (showing background-removed garments)
3. Snap-a-garment capture flow with the auto-categorization overlay
4. Travel capsule result for "5 days, Lisbon, casual"
5. Wardrobe gap analysis screen
6. Calendar with outfits planned across the week

Each screenshot should include the localized UI in English (UK).

---

## Common Play rejection reasons — pre-screen

| Policy | Risk | Mitigation in v1.0.0 |
|---|---|---|
| User Data | Data Safety form must match in-app behavior. | See `M3-privacy-declarations.md` — declarations match `delete_user_account` + Sentry/Supabase/Gemini/RevenueCat inventory. Meta Pixel / CAPI is deferred to Plan B and not declared in v1.0.0. |
| Subscriptions and Cancellation | Must disclose price, period, renewal cadence, cancellation path. | Disclosure block in full description + deep link to Google Play subs management. |
| Account Deletion | Apps that allow account creation must allow in-app deletion AND offer a web-accessible deletion path. | In-app: Settings → Account → Delete Account (calls `delete_user_account`). Web: burs.me/delete-account (Borna to confirm live). |
| Permissions | Each runtime permission must have a clear in-app rationale. | Camera (snap garments), Photos (import), Notifications (daily outfit reminders if user opts in), Location (weather-aware suggestions, opt-in). |
| Restricted Content | No restricted-permission abuse. | App uses no SMS, no Call Log, no Accessibility Service permissions. |
| AI-Generated Content | Disclose AI-generated outputs and provide a reporting mechanism. | Outfit suggestions are clearly AI-generated; in-app feedback form sends to hello@burs.me. |
