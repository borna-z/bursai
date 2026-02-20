

## Fix: PWA Still Opens to Website

The manifest file already has `start_url: "/auth"` set correctly. The most likely reason the PWA still opens the website is that **the old version is cached on your device**. When you first added the app, the manifest said `start_url: "/"`, and that gets baked into the installed app.

### What you need to do

**Remove the app from your home screen, then re-add it.** This forces your phone to read the updated manifest with the new `/auth` start URL.

- **iPhone**: Long-press the app icon > Remove App
- **Android**: Long-press the app icon > Remove/Uninstall

Then go back to the website in your browser and "Add to Home Screen" again.

### Code change (small improvement)

To make the PWA scope explicit, I'll add a `scope` field to the manifest. This tells the browser exactly which URLs belong to the app:

**`public/manifest.json`** -- Add `"scope": "/"` so the entire site is within the PWA scope, but the start point is `/auth`:

```json
{
  "name": "BURS",
  "short_name": "BURS",
  "start_url": "/auth",
  "scope": "/",
  ...
}
```

This is a minor best-practice addition. The main fix is re-adding the app to your home screen.

