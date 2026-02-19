
# Rebrand: DRAPE to BURS

## Overview
Full rebrand of the application from "DRAPE" to "BURS". This includes replacing the logo image with the uploaded one, updating all text references across the codebase, and renaming the PWA manifest.

## Logo Usage
From the uploaded image:
- **Left version** (icon only, no text): Used on the marketing website
- **Right version** (icon + "BURS" wordmark): Used in the PWA app (auth page, etc.)

The uploaded image will be copied to `src/assets/burs-logo.png` and used as the new logo source.

## Changes

### 1. Copy logo asset
- Copy `user-uploads://Gemini_Generated_Image_qeunkmqeunkmqeun_1.png` to `src/assets/burs-logo.png`

### 2. Rename and update logo component
- Rename `src/components/ui/DrapeLogo.tsx` content to `BursLogo`
- Update import to use `burs-logo.png`
- Change all alt text and wordmark text from "DRAPE" to "BURS"
- The component will still support `icon`, `wordmark`, and `horizontal` variants

### 3. Update all consuming files
Files that import or reference `DrapeLogo`:
- `src/components/marketing/MarketingLayout.tsx` -- update import to `BursLogo`

### 4. Update Auth page
- `src/pages/Auth.tsx` -- change the "DRAPE" heading text to "BURS"

### 5. Update PWA manifest
- `public/manifest.json` -- change `name` and `short_name` from "DRAPE" to "BURS"

### 6. Update index.html
- Change all `<title>`, `<meta>` tags from "DRAPE" to "BURS"

### 7. Update marketing config
- `src/config/marketing.ts` -- replace all "DRAPE" references with "BURS" (title, footer copyright, terms content, etc.)

### 8. Update translations (i18n)
- `src/i18n/translations.ts` -- replace "DRAPE AB" with "BURS AB", "privacy@drape.se" with "privacy@burs.se", "DRAPE Stylisten" with "BURS Stylisten", all tutorial references, and chat welcome messages across all locales (sv, en, no, da, fi, de, fr, es, it, pt, nl, pl, ar, fa)

### 9. Update privacy settings page
- `src/pages/settings/SettingsPrivacy.tsx` -- change `drape-export-` filename to `burs-export-`, update `mailto:privacy@drape.se` to `privacy@burs.se`

### 10. Update structured data & marketing pages
- `src/pages/marketing/MarketingHome.tsx` -- change JSON-LD `name` from "DRAPE" to "BURS"
- `src/pages/marketing/Admin.tsx` -- update Helmet title
- `src/pages/marketing/Terms.tsx` -- update Helmet title/meta
- `src/pages/marketing/PrivacyPolicy.tsx` -- update Helmet title/meta

### 11. CSS and animation names (keep as-is)
The animation names `drape-in`, `drape-out`, `stagger-drape` in `tailwind.config.ts` and `src/index.css` are internal CSS identifiers. Renaming them is optional and carries risk of missing references. They will be kept as-is since they are not user-facing.

## Technical Summary

| File | Change |
|------|--------|
| `src/assets/burs-logo.png` | New logo file (copied from upload) |
| `src/components/ui/DrapeLogo.tsx` | Rename export to `BursLogo`, update image source and text |
| `src/components/marketing/MarketingLayout.tsx` | Update import |
| `src/pages/Auth.tsx` | "DRAPE" to "BURS" |
| `public/manifest.json` | Name and short_name |
| `index.html` | All meta tags |
| `src/config/marketing.ts` | All "DRAPE" references |
| `src/i18n/translations.ts` | All DRAPE references across all locales |
| `src/pages/settings/SettingsPrivacy.tsx` | Export filename, email |
| `src/pages/marketing/MarketingHome.tsx` | JSON-LD name |
| `src/pages/marketing/Admin.tsx` | Helmet title |
| `src/pages/marketing/Terms.tsx` | Helmet title/meta |
| `src/pages/marketing/PrivacyPolicy.tsx` | Helmet title/meta |
