
# Remove /marketing and all related code

Delete the entire marketing site: landing page, its components, config, analytics lib, and sitemap. Keep `/privacy`, `/terms`, `/contact`, and `/admin` as standalone pages (they serve app-level purposes).

## Files to delete (15 files)

**Components** (10 files):
- `src/components/marketing/BenefitsSection.tsx`
- `src/components/marketing/EmailCaptureSection.tsx`
- `src/components/marketing/FAQSection.tsx`
- `src/components/marketing/FeaturesSection.tsx`
- `src/components/marketing/FinalCTASection.tsx`
- `src/components/marketing/HeroSection.tsx`
- `src/components/marketing/MarketingLayout.tsx`
- `src/components/marketing/PWAInstallSection.tsx`
- `src/components/marketing/ProductDemoSection.tsx`
- `src/components/marketing/SocialProofSection.tsx`

**Pages** (1 file):
- `src/pages/marketing/MarketingHome.tsx`

**Config & lib** (2 files):
- `src/config/marketing.ts`
- `src/lib/marketingAnalytics.ts`

**Static** (1 file):
- `public/sitemap.xml`

## Files to edit (5 files)

### `src/App.tsx`
- Remove imports for `MarketingHome`
- Remove `<Route path="/marketing" ...>` 
- Keep `/privacy`, `/terms`, `/contact`, `/admin` routes but they need to stop using `MarketingLayout` and `MARKETING_CONFIG`

### `src/pages/marketing/PrivacyPolicy.tsx`
- Replace `MarketingLayout` wrapper with a simple standalone layout (plain page with back link)
- Remove dependency on `MARKETING_CONFIG`

### `src/pages/marketing/Terms.tsx`
- Same as PrivacyPolicy: replace `MarketingLayout` with standalone layout

### `src/pages/marketing/Contact.tsx`
- Same: replace `MarketingLayout` with standalone layout
- Remove `MARKETING_CONFIG` references

### `src/pages/marketing/Admin.tsx`
- Remove `trackMarketingEvent` import if present
- The admin page queries `marketing_leads` and `marketing_events` tables directly via Supabase -- those tables stay (they hold real data). Only the marketing UI is removed.

## What stays
- `/privacy`, `/terms`, `/contact`, `/admin` routes and pages (rewritten to be self-contained)
- `marketing_leads` and `marketing_events` database tables (existing data)
- `public/robots.txt`

## Technical notes
- The legal pages (Privacy, Terms) currently pull their content from `MARKETING_CONFIG.privacy` and `MARKETING_CONFIG.terms`. That content will be inlined directly into the page components before deleting the config file.
- The Contact page pulls placeholders and messages from `MARKETING_CONFIG.contact`. Same approach: inline the strings.
