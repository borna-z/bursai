# M3 — Reviewer demo flow + test account

**Owner:** Claude drafts → Borna provisions the account, runs the flow once on a real device to confirm it works, then pastes into App Store Connect + Play Console reviewer notes.

**Purpose:** Apple (Guideline 2.1) and Google both require that a paid-feature app's review team can reproduce the paid flow without a real credit card. A weak demo account is the most common avoidable rejection reason in this category. The script below gives the reviewer a single linear path through every gated feature in ≤ 4 minutes.

---

## Test account

| Field | Value |
|---|---|
| Email | `test@burs.me` |
| Password | (Borna to set — strong, 16+ chars, share via secure note in store reviewer field) |
| Account state at submission | Premium Annual entitlement pre-granted via `grant_trial_gift` (server-side) so the reviewer never has to attempt a sandbox purchase |
| Wardrobe state | Pre-seeded with 24 garments across 6 categories (tops, bottoms, outerwear, footwear, accessories, basics) so outfit generation has real material to work with |
| Calendar state | One outfit planned for "tomorrow" so the calendar surface isn't empty |
| Wear log state | 8 wear entries across the previous two weeks so the "what you actually wear" analytics screen has data |

**Borna provisioning steps (one-time, before submission):**

1. Sign up `test@burs.me` from the production app build that will be submitted (same RC).
2. Run the wardrobe seed: import the 24 garments from `docs/launch/may-2026-sprint/assets/reviewer-wardrobe/` (Borna to capture this set — recommend a neutral, photographable batch from Borna's own closet).
3. Plan one outfit for the next day in-app.
4. Log 8 wear entries spread across 14 days.
5. From Supabase SQL editor, run:
   ```sql
   -- Grant 1-year Premium gift entitlement so reviewer skips sandbox purchase.
   select grant_trial_gift(
     p_user_id := (select id from auth.users where email = 'test@burs.me'),
     p_duration := interval '365 days',
     p_reason := 'app-store-reviewer-account'
   );
   ```
   (Borna: confirm the actual `grant_trial_gift` RPC signature before running — function exists per CLAUDE.md hard rule on edge function inventory; double-check param names against `supabase/functions/grant_trial_gift/index.ts`.)
6. Sign out of the test account on Borna's device before submitting.

---

## Reviewer demo script (the text pasted into ASC/Play reviewer notes)

> **Demo account**
> Email: `test@burs.me`
> Password: (see secure field)
>
> This account has a pre-granted Premium subscription — no sandbox purchase needed to exercise paid features. The wardrobe has been seeded with 24 garments so outfit generation, travel capsules, and gap analysis have real data.
>
> **4-minute walkthrough**
>
> 1. **Sign in.** Use the credentials above. The home screen loads with today's suggested outfit at the top.
>
> 2. **Browse the wardrobe (free feature).** Tap the wardrobe tab. You'll see 24 garments with backgrounds removed, grouped by category. Tap any garment to see its detail screen (color, warmth rating, last worn).
>
> 3. **Generate an outfit (free; first 3/day are free, this account has unlimited).** Tap the "Generate" button. Type "something for 12°C and rainy" and tap submit. Within ~3 seconds you'll see an outfit built from items in this wardrobe. Tap "Try another" to regenerate.
>
> 4. **Travel capsule (Premium).** Tap the menu icon → "Travel Capsule." Type "5 days in Lisbon, casual" and tap submit. The result shows the smallest set of garments that produces the most outfit combinations for that brief.
>
> 5. **Wardrobe gap analysis (Premium).** Tap menu → "Wardrobe Gaps." See a list of under-served categories with concrete examples ("you have 9 tops but only 1 pair of trousers that pairs with them").
>
> 6. **Outfit photo feedback (Premium).** Tap menu → "Outfit Feedback." Skip the camera step by tapping "Use sample" — a pre-loaded photo appears with the AI's feedback already generated. (We pre-loaded one so the reviewer doesn't need to take a photo of themselves.)
>
> 7. **Calendar (free + Premium).** Tap the calendar tab. Tomorrow has a planned outfit. Tap it to see the planned items. Tap "Plan another day" to drag an outfit to any other date.
>
> 8. **Subscription management.** Settings → Subscription. See the active Premium Annual entitlement, renewal date, and cancellation link.
>
> 9. **Account deletion (required by both stores).** Settings → Account → Delete Account. Tap and confirm. The account, wardrobe, and all associated data are deleted within seconds. (Don't actually delete this account during review — the confirmation dialog has a clear cancel button.)
>
> **If anything in the flow fails to load**, please contact `hello@burs.me` and we'll respond within 4 hours.

**Char count of the script above:** ~2,100 chars. Both ASC and Play allow up to 4,000 chars in reviewer notes, so we have headroom for additional clarifications if any.

---

## Apple-specific reviewer-notes addendum

Paste this AFTER the demo script in App Store Connect → App Review Information → Notes:

> **About paid features and sandbox**
>
> The submitted build uses RevenueCat with StoreKit for in-app subscriptions. The demo account above has a pre-granted entitlement so reviewers can exercise paid features without a sandbox purchase. If you would like to test the actual purchase flow, switch to a sandbox Apple ID before signing in — the app will detect no entitlement and present the paywall.
>
> **Two subscription products**
>
> - `burs_premium_monthly_119sek` — 119 SEK / month, auto-renew, 1-week free trial
> - `burs_premium_annual_899sek` — 899 SEK / year, auto-renew, 1-week free trial
>
> Both are configured in App Store Connect → In-App Purchases. Restore Purchases is available in Settings → Subscription.
>
> **About AI-generated content**
>
> Outfit suggestions are generated by an AI model (Google Gemini) using only garments from the user's own wardrobe. Each suggestion is clearly labeled as an AI suggestion. Users can flag a suggestion as wrong via the in-app feedback button which sends to `hello@burs.me`.
>
> **About account deletion**
>
> Per Apple Guideline 5.1.1(v), the app provides in-app account deletion (Settings → Account → Delete Account). The deletion is server-cascaded across user wardrobe, outfits, wear logs, calendar, subscription state, and AI memory tables.

---

## Google-specific reviewer-notes addendum

Paste this AFTER the demo script in Play Console → App content → Reviewer comments:

> **About paid features**
>
> The demo account above has a pre-granted Premium entitlement so reviewers can test paid features without making a Play sandbox purchase. To test the purchase flow itself, sign in with a different account on a device with a Play sandbox tester profile — the app will detect no entitlement and present the paywall.
>
> **Two subscription products** (configured in Play Console → Monetization → Subscriptions):
> - `burs_premium_monthly_119sek` — 119 SEK / month
> - `burs_premium_annual_899sek` — 899 SEK / year
>
> **About permissions**
>
> Each runtime permission has an in-app rationale before the system dialog:
> - Camera — required to photograph garments for the wardrobe
> - Photos — required to import existing garment photos
> - Notifications — optional, for daily outfit reminders
> - Location — optional, for weather-aware outfit suggestions (city-level, not stored)
>
> **About account deletion**
>
> Per Google Play account-deletion policy:
> - In-app: Settings → Account → Delete Account
> - Web: https://burs.me/delete-account
> Both paths trigger the same server-side cascade.

---

## Pre-submission sanity checks for Borna

Run these on a real device with the test account immediately before pressing Submit on each store:

- [ ] Sign in with `test@burs.me` and password from the secure field.
- [ ] Home screen loads with a suggested outfit (not an error or empty state).
- [ ] Wardrobe shows 24 garments.
- [ ] "Generate" with the rainy 12°C prompt returns an outfit in ≤ 5 seconds.
- [ ] Travel capsule with the Lisbon prompt returns a result in ≤ 8 seconds.
- [ ] Wardrobe gaps screen loads with at least one row.
- [ ] Outfit photo feedback → "Use sample" returns pre-loaded feedback.
- [ ] Calendar shows tomorrow's planned outfit.
- [ ] Settings → Subscription shows active Premium Annual.
- [ ] Settings → Account → Delete Account opens the confirmation dialog (do not confirm).

If any check fails, fix before submission — the reviewer will hit the same issue.

---

## Post-submission housekeeping

- Reviewer accounts persist; do not delete `test@burs.me` until the app has been live for 90 days (Apple sometimes re-uses the account during routine re-reviews after updates).
- After v1.0.0 is approved, re-seed the wardrobe + re-grant the gift entitlement so the account stays demo-ready for v1.0.1's submission.
- If the gift entitlement expires before the next submission, run the `grant_trial_gift` SQL above to refresh.
