

## GDPR Cookie Consent Banner

### What it does
A cookie consent popup that appears at the bottom of the landing page for first-time visitors. It asks users to accept or decline non-essential cookies, and remembers their choice in `localStorage`. Fully GDPR-compliant: no tracking cookies are set before the user gives consent.

### Design
- Fixed bottom banner, dark glass style matching the landing page aesthetic (dark background, white text, subtle border)
- Two buttons: "Accept" (white filled) and "Decline" (outline/ghost)
- A link to the Privacy Policy (`/privacy`)
- Once dismissed, the choice is saved to `localStorage` and the banner never appears again
- Minimal, non-intrusive -- fits the Scandinavian minimalist design

### Technical changes

#### 1. New component: `src/components/landing/CookieConsent.tsx`
- Reads `localStorage` key `burs-cookie-consent` on mount
- If no value found, show the banner
- "Accept" sets value to `"accepted"`, "Decline" sets to `"declined"`
- Links to `/privacy` for more details
- Animated entrance (slide up) using existing Tailwind animation classes
- Text: "We use cookies to improve your experience. Read our [Privacy Policy](/privacy) for details."

#### 2. Update `src/pages/Landing.tsx`
- Import and render `<CookieConsent />` at the bottom of the page, outside the scroll container so it stays fixed

No database changes needed -- consent is stored client-side in `localStorage` since BURS does not currently use any third-party tracking cookies. If analytics are added later, this component can be extended to gate those scripts.

