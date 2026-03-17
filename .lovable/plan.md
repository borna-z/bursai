

## Problem: Content Security Policy Blocks Auth

The `index.html` has a strict Content-Security-Policy meta tag that blocks connections to Lovable domains. Specifically:

- **`connect-src`** is missing `https://*.lovable.dev` and `https://*.lovable.app` — this blocks Google OAuth via `@lovable.dev/cloud-auth-js` and AI gateway calls.
- **`frame-src 'none'`** blocks any iframe-based OAuth popups the cloud-auth library might use.

### Why email/password login might also fail
The CSP allows `https://*.supabase.co`, so basic email/password *should* work. However, the `script-src` directive is very restrictive (`'self' 'unsafe-inline'` only) — if any Supabase JS SDK code loads external scripts or modules dynamically, those would be blocked too.

### Fix

**File: `index.html` (line 24)**

Update the CSP `connect-src` to include Lovable domains, and update `frame-src` to allow OAuth:

```
connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co
  https://api.openweathermap.org https://*.sentry.io https://nominatim.openstreetmap.org
  https://api.open-meteo.com https://archive-api.open-meteo.com
  https://*.lovable.dev https://*.lovable.app https://*.lovableproject.com;
frame-src https://*.lovable.dev https://accounts.google.com;
```

This is a single-line change in `index.html`. No other files need changes.

