## Wave 11 — Launch Prep

### P78 — App Store Connect listing

- Screenshots (5 required per device size)
- App description
- Privacy policy URL (must exist before submission)
- Support URL
- Marketing URL
- Categories, age rating

---

### P79 — App Privacy labels

- Fill out App Privacy questionnaire
- Declare data collection (email, usage, purchases)
- ATT if analytics SDKs require it

---

### P80 — TestFlight beta

- Internal testers first (team + self)
- External beta (friends, small group) — up to 10k testers
- Collect crash reports via Sentry

---

### P81 — Play Store listing + monitoring + launch checklist

**Play Store:**
- Screenshots, description
- Content rating
- Data safety section

**Monitoring:**
- Sentry alerts for high error rates
- Supabase log retention set
- Render queue depth dashboard (Grafana / Supabase + queries)

**Launch checklist (one-shot):**
- All env vars set in production Supabase
- Migration freeze audit (no pending local migrations)
- Webhook endpoints verified (Stripe + RevenueCat both hit production)
- Resend DNS records verified
- App Store + Play Store both approved
- Marketing plan greenlit

---

# End of Detailed Launch Plan

Status tracking lives in CLAUDE.md's Launch Plan section. This file holds scope only.
