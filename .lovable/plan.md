

## Change PWA Start URL to /auth

When users add the app to their home screen, it currently opens at `/` (the landing/website page). You want it to open at `/auth` instead, so home screen users go straight to the login screen.

Visitors who find the site via a web browser will still land on the website as normal -- this only affects the "Add to Home Screen" behavior.

### What will change

**`public/manifest.json`** -- Change `start_url` from `"/"` to `"/auth"`:

```json
"start_url": "/auth",
```

This single change tells the browser that when the PWA is launched from the home screen, it should navigate to `/auth` (the login/signup page) instead of the marketing landing page.

### How it works

- **Browser visit** (typing burs.me): Opens `/` which shows the Landing page as usual
- **Home screen launch**: The PWA manifest tells the browser to open `/auth`, taking the user straight to login
- If the user is already logged in, your existing auth logic can redirect them to the app home

### Technical note

No code changes are needed beyond the manifest file. The `start_url` property in the web app manifest is what controls where the app opens when launched from the home screen.

