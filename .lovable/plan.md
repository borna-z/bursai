

# Google OAuth Verification Compliance

This plan implements all required changes to pass Google's OAuth verification for the Google Calendar integration.

---

## Part 1: Landing Page — Privacy Policy and Terms Links

### Header (Landing.tsx)
- Add "Privacy Policy" and "Terms of Service" as visible text links in the top navigation bar (desktop), alongside the existing section links (How it works, Sustainability, etc.)
- On mobile, include both links in the hamburger menu
- Links point to `/terms` (as specified)
- Styled as subtle gray-400 text matching existing nav link style

### Footer (LandingFooter.tsx)
- The footer already has "Privacy Policy" and "Terms" links — verify they point to `/terms` and `/privacy` respectively
- Add explicit "Terms of Service" label if not already present (currently uses translation key `landing.footer_terms`)

---

## Part 2: Terms Page — Google Calendar Privacy Section

### Update Terms.tsx
- Add a new "Privacy Policy — Google Calendar Integration" section at the TOP of the page, before existing terms sections
- Include anchor navigation (jump links) at the top for: Overview, Data Accessed, Data Usage, Storage & Retention, Sharing, User Controls, Security, Contact
- Each subsection rendered with proper heading IDs for anchor links
- Content is hardcoded in English (not translated) since this is a legal compliance document for Google's review
- Existing terms sections remain unchanged below

### Content structure:
1. **Overview** — BURS description and optional Google Calendar connection
2. **Google User Data We Access** — Read-only scope, fields accessed, fields NOT accessed
3. **How We Use Google User Data** — Outfit suggestions, weekly planning; no selling/ads
4. **Storage & Retention** — Token storage, encryption at rest, deletion on disconnect
5. **Sharing** — No third-party sharing, no human review
6. **User Controls** — Disconnect in Settings, delete account, revoke via Google
7. **Security** — TLS, encryption at rest, least privilege
8. **Contact** — privacy@burs.me, BURS

---

## Part 3: In-App Disclosure Before Google OAuth

### CalendarConnectBanner.tsx
- Add a disclosure text below the "Google Calendar" connect button:
  *"BURS will read your calendar events to help plan outfits around your schedule. You can disconnect at any time."*
- Add a "Privacy Policy" link pointing to `/terms` below the disclosure text

### CalendarSection.tsx (Settings page)
- Add the same disclosure text above the Google Calendar connect button when not connected
- Include link to `/terms`

---

## Part 4: Internal Consistency (Code Comments)

- Add a code comment block in the Google Calendar auth edge function noting the required Google Cloud Console settings (homepage URL, privacy policy URL, authorized domain, minimum scopes)

---

## Technical Details

### Files to modify:
1. **`src/pages/Landing.tsx`** — Add Privacy Policy + Terms links to header nav and mobile menu
2. **`src/components/landing/LandingFooter.tsx`** — Ensure "Terms of Service" link is explicit and visible
3. **`src/pages/marketing/Terms.tsx`** — Add Google Calendar privacy section with anchor nav at top
4. **`src/components/plan/CalendarConnectBanner.tsx`** — Add disclosure text + privacy link before OAuth
5. **`src/components/settings/CalendarSection.tsx`** — Add disclosure text + privacy link in Google Calendar card
6. **`supabase/functions/google_calendar_auth/index.ts`** — Add checklist comment block

### No database changes required.
### No new dependencies required.

