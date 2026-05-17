# M3 — Reviewer demo flow + test account

**Owner:** Claude drafts → Borna provisions the account, runs the flow once on a real device to confirm it works, then pastes into App Store Connect + Play Console reviewer notes.

**Purpose:** Apple (Guideline 2.1) and Google both require that a paid-feature app's review team can reproduce the paid flow without a real credit card. A weak demo account is the most common avoidable rejection reason in this category. The script below gives the reviewer a single linear path through every gated feature in ≤ 4 minutes.

---

## Test account

| Field | Value |
|---|---|
| Email | `test@burs.me` |
| Password | (Borna to set — strong, 16+ chars, share via secure note in store reviewer field) |
| Account state at submission | Premium Annual entitlement pre-granted via direct write to the `subscriptions` table (server-side) so the reviewer never has to attempt a sandbox purchase. The `grant_trial_gift` edge function grants 3 render credits, NOT subscription entitlement — do not use it for this purpose. |
| Wardrobe state | Pre-seeded with 24 garments across 6 categories (tops, bottoms, outerwear, footwear, accessories, basics) so outfit generation has real material to work with |
| Calendar state | One outfit planned for "tomorrow" so the calendar surface isn't empty |
| Wear log state | 8 wear entries across the previous two weeks so the "what you actually wear" analytics screen has data |

**Borna provisioning steps (one-time, before submission):**

1. Sign up `test@burs.me` from the production app build that will be submitted (same RC).
2. Seed the wardrobe with 24 garments. No pre-captured asset set ships in this repo — Borna captures fresh photos at provisioning time. Recommended set: a neutral, photographable batch from Borna's own closet (6 tops, 5 bottoms, 3 outerwear, 4 footwear, 3 accessories, 3 basics). Import via the in-app camera or batch-import flow that ships in the v1.0 build. Goal is realistic outfit-generation material, not a specific scripted set.
3. Plan one outfit for the next day in-app.
4. Log 8 wear entries spread across 14 days.
5. From Supabase SQL editor, grant a 1-year Premium entitlement so the reviewer skips the sandbox purchase. The `grant_trial_gift` edge function does NOT do this (it grants render credits) — use a direct upsert on `subscriptions` instead:
   ```sql
   -- Grant Premium Annual to the reviewer account.
   -- Borna: confirm column names against `supabase/migrations/*subscriptions*.sql`
   -- before running — the table schema has evolved over multiple waves.
   insert into public.subscriptions (
     user_id, plan, status, current_period_end, created_at, updated_at
   )
   values (
     (select id from auth.users where email = 'test@burs.me'),
     'premium',
     'active',
     now() + interval '365 days',
     now(),
     now()
   )
   on conflict (user_id) do update
     set plan = 'premium',
         status = 'active',
         current_period_end = now() + interval '365 days',
         updated_at = now();
   ```
   Borna should sanity-check the actual columns the app reads (`useSubscription` hook reads `plan` + `status` + `current_period_end` at minimum) before pasting — if the column names have shifted, adjust accordingly.
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
> 3. **Generate an outfit (free; first 3/day are free, this account has unlimited).** Open the Generate tab — an outfit auto-generates on mount from this account's wardrobe within ~3 seconds. To request something specific, open **Style Me** instead: pick an occasion chip (Work, Date, Evening, Workout, Travel, or tap **Custom…** and type your own e.g. "brunch with friends"), nudge the weather slider, and tap **Generate outfit**. There is no free-form chat prompt in v1.0.0 — generation is driven by the occasion chips + weather slider + (optional) anchor item lock.
>
> 4. **Travel capsule (Premium).** Tap the menu icon → "Travel Capsule." Type "5 days in Lisbon, casual" and tap submit. The result shows the smallest set of garments that produces the most outfit combinations for that brief.
>
> 5. **Wardrobe gap analysis (Premium).** Tap menu → "Wardrobe Gaps." See a list of under-served categories with concrete examples ("you have 9 tops but only 1 pair of trousers that pairs with them").
>
> 6. **Outfit photo feedback (Premium).** This feature is reached from an outfit, not from a top-level menu. From the outfit you just generated in step 3 (or from the planned outfit in step 7), tap the outfit to open its detail screen and tap **Try it on**. The camera opens — point it at any item of clothing (your own shirt, a piece of fabric, a folded garment on the desk) and tap the capture button, then tap **Use this selfie** on the confirm screen. The AI returns a short outfit critique within a few seconds. There is no sample-photo bypass in the submitted build — a real camera capture is required.
>
> 7. **Calendar (free + Premium).** Tap the calendar tab. Tomorrow shows a planned outfit. Tap the date to reveal the planned-outfit card, which has two buttons: **View outfit** (opens the outfit detail with all four planned items) and **Change** (opens the outfit generator to swap in a different outfit for that day). There is no drag interaction — planning happens via the generator's save-to-calendar action.
>
> 8. **Restore Purchases (subscription affordance).** Settings → Account → Subscription → "Restore Purchases" (this is the only row in this section in v1.0.0). Tap it to confirm the restore flow runs — required by Apple Guideline 3.1.1 to be discoverable outside the paywall. Cancellation and renewal management live in the system subscription manager (iOS: Settings app → your Apple ID → Subscriptions; Android: Play Store → Profile → Payments & subscriptions → Subscriptions). The in-app entitlement summary card (status / renewal date / manage link) is intentionally deferred to a post-launch hardening pass, so do not expect to see it in this build.
>
> 9. **Account deletion (required by both stores).** Settings → Account → Delete Account. Tap the row to open the typed confirmation dialog so you can verify the deletion flow exists — then tap **Cancel**. Please do NOT confirm deletion on this account: it is the shared reviewer credential for both stores and any follow-up reviews. If you need to verify the deletion completes end-to-end, sign up a throwaway account first and delete that one instead.
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
> - `burs_premium_monthly_119sek` — 119 SEK / month, auto-renew, 3-day free trial
> - `burs_premium_annual_899sek` — 899 SEK / year, auto-renew, 3-day free trial
>
> Both are configured in App Store Connect → In-App Purchases. Restore Purchases is available at Settings → Account → Subscription → Restore Purchases (the only row in that section in v1.0.0).
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
> Runtime permission behavior:
> - **Camera** — in-app rationale before the system dialog. Required to photograph garments for the wardrobe.
> - **Photos** — in-app rationale before the system dialog. Required to import existing garment photos.
> - **Notifications** — in-app rationale before the system dialog. Optional, for daily outfit reminders.
> - **Location** — in v1.0.0 the OS location prompt may surface directly from the Home screen's weather widget without a preceding rationale screen (the weather hook calls `requestForegroundPermissionsAsync` when no city is configured). Optional — denying it falls back to the user-entered home city from onboarding. A dedicated pre-prompt rationale is planned for a post-launch hardening pass.
>
> **About account deletion**
>
> Per Google Play account-deletion policy:
> - In-app: Settings → Account → Delete Account (calls the `delete_user_account` edge function which cascades across 24+ tables and storage paths).
> - Web: `https://burs.me/delete-account` — **PRE-SUBMISSION BLOCKER FOR BORNA: this page does not yet ship in the repo (`public/` has only the privacy and terms pages).** Play requires the web-accessible deletion path even when in-app deletion exists; the URL must be live and return a working form before Play submission, or this reviewer note must be rewritten to point only at the in-app path with a Play Console "no web deletion offered" attestation.

---

## Pre-submission sanity checks for Borna

Run these on a real device with the test account immediately before pressing Submit on each store:

- [ ] Sign in with `test@burs.me` and password from the secure field.
- [ ] Home screen loads with a suggested outfit (not an error or empty state).
- [ ] Wardrobe shows 24 garments.
- [ ] "Generate" with the rainy 12°C prompt returns an outfit in ≤ 5 seconds.
- [ ] Travel capsule with the Lisbon prompt returns a result in ≤ 8 seconds.
- [ ] Wardrobe gaps screen loads with at least one row.
- [ ] From the generated outfit's detail screen, tap **Try it on** → camera capture returns AI feedback in ≤ 8 seconds. (There is no top-level "Outfit Feedback" menu entry and no "Use sample" shortcut in v1.0.0 — the only entry point is `Try it on` from an outfit detail, and a real camera capture is required.)
- [ ] Calendar shows tomorrow's planned outfit. Tapping the date reveals **View outfit** and **Change** buttons (no drag-to-plan interaction in v1.0.0).
- [ ] Settings → Account → Subscription shows the "Restore Purchases" row and tapping it runs without error. (There is no entitlement-summary card in v1.0.0 — that ships post-launch.)
- [ ] Settings → Account → Delete Account opens the confirmation dialog (do not confirm).

If any check fails, fix before submission — the reviewer will hit the same issue.

---

## Post-submission housekeeping

- Reviewer accounts persist; do not delete `test@burs.me` until the app has been live for 90 days (Apple sometimes re-uses the account during routine re-reviews after updates).
- After v1.0.0 is approved, re-seed the wardrobe + re-grant the gift entitlement so the account stays demo-ready for v1.0.1's submission.
- If the entitlement expires before the next submission, re-run the `subscriptions` upsert SQL above to refresh.
