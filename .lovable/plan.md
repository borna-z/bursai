

## Update Privacy Policy and Terms of Service

### Changes

#### 1. Remove legal links from landing page header
**File: `src/pages/Landing.tsx`**
- Remove the `legalLinks` array and all references to it in both desktop nav and mobile menu
- Keep the links in the footer only (via `LandingFooter`)

#### 2. Separate routes: `/privacy` for Privacy Policy, `/terms` for Terms of Service
Currently both links point to `/terms`. The routes already exist separately (`/privacy` and `/terms`), so we just need to update the footer links.

**File: `src/components/landing/LandingFooter.tsx`**
- Change "Privacy Policy" link to point to `/privacy`
- Keep "Terms of Service" pointing to `/terms`

#### 3. Update Privacy Policy content
**File: `src/pages/marketing/PrivacyPolicy.tsx`**
- Replace existing generic sections with the full new privacy policy text you provided
- Update effective date to February 22, 2026
- Update contact email to `hello@burs.me`
- Structure: Introduction, Google User Data, AI Processing, Storage & Retention, Sharing & Disclosure, User Controls & Rights, Security, Contact

#### 4. Update Terms of Service content
**File: `src/pages/marketing/Terms.tsx`**
- Remove the Google Calendar Privacy section (now covered in the Privacy Policy page)
- Replace the existing terms sections with the new Terms of Service text
- Sections: Acceptance, Use of Service, Subscription & Payments, Disclaimers, Governing Law
- Update effective date to February 22, 2026

#### 5. Fix footer links on legal pages
**Files: `src/pages/marketing/PrivacyPolicy.tsx` and `src/pages/marketing/Terms.tsx`**
- Update footer links so Privacy Policy points to `/privacy` and Terms points to `/terms`

