

## Make Legal Pages Match Landing Page Design

### What's Already Working
- Privacy Policy (`/privacy`), Terms (`/terms`), and Contact (`/contact`) routes exist and are public (no login required)
- Footer on the landing page already links to all three pages

### Problems to Fix

1. **"Back" link goes to `/`** -- which is a protected route. Visitors from the landing page who click "Back" get redirected to login. Should go to `/welcome` instead.

2. **No forced light theme** -- These pages follow the user's system theme, so they can appear dark while the landing page is always light. They should use the same `force-light` CSS class.

3. **No consistent header/footer** -- The legal pages are plain text with a back arrow. They should share the landing page's header (with logo + nav) and footer (with legal links + GDPR note) for a cohesive marketing site feel.

### Changes

#### `src/pages/marketing/Terms.tsx`
- Wrap content in `force-light` class (same as landing page)
- Change back link from `/` to `/welcome`
- Add the landing page header (logo + BURS wordmark) and footer (legal links, copyright, GDPR note)

#### `src/pages/marketing/PrivacyPolicy.tsx`
- Same treatment: `force-light` wrapper, back link to `/welcome`, shared header and footer

#### `src/pages/marketing/Contact.tsx`
- Same treatment: `force-light` wrapper, back link to `/welcome`, shared header and footer

### Technical Details

Each page will:
- Import `burs-landing-logo.png` for the header
- Wrap everything in `<div className="force-light">` to enforce light theme
- Replace `<Link to="/">` with `<Link to="/welcome">` for the back button
- Add a minimal header with the BURS logo linking to `/welcome`
- Add the same footer as the landing page with Privacy Policy, Terms, Contact links, copyright, and GDPR note
- Keep all existing content unchanged

| File | Changes |
|------|---------|
| `src/pages/marketing/Terms.tsx` | Force light theme, back link to `/welcome`, add header + footer |
| `src/pages/marketing/PrivacyPolicy.tsx` | Force light theme, back link to `/welcome`, add header + footer |
| `src/pages/marketing/Contact.tsx` | Force light theme, back link to `/welcome`, add header + footer |
