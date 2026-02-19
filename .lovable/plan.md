# Rebrand: DRAPE to BURS

## Overview

Full rebrand of the application from "DRAPE" to "BURS". This includes replacing the logo image with the uploaded one, updating all text references across the codebase, and renaming the PWA manifest.

## Logo Usage

From the uploaded image:

- **Right version** (icon + "BURS" wordmark): Used on the marketing website
- **Left version** (icon only, no text): Used in the PWA app (auth page, etc.)

## Changes

### 1. Copy logo asset

Copy `user-uploads://Gemini_Generated_Image_qeunkmqeunkmqeun_1.png` to `src/assets/burs-logo.png`

### 2. Update logo component

- Rename the export in `src/components/ui/DrapeLogo.tsx` to `BursLogo`
- Update image source to `burs-logo.png`
- Change alt text and wordmark from "DRAPE" to "BURS"
- Keep backward-compatible alias for safety

### 3. Update consuming files

- `src/components/marketing/MarketingLayout.tsx` -- import `BursLogo`

### 4. Update Auth page

- `src/pages/Auth.tsx` -- heading "DRAPE" becomes "BURS"

### 5. Update PWA manifest

- `public/manifest.json` -- name and short_name

### 6. Update index.html

- All title and meta tags: "DRAPE" becomes "BURS"

### 7. Update marketing config

- `src/config/marketing.ts` -- footer copyright, terms content, all brand references

### 8. Update translations (i18n)

- `src/i18n/translations.ts` -- "DRAPE AB" to "BURS AB", email addresses, chat titles, tutorial text, welcome messages across all 14 locales

### 9. Update privacy settings

- `src/pages/settings/SettingsPrivacy.tsx` -- export filename prefix, mailto link

### 10. Update marketing pages

- `MarketingHome.tsx` -- JSON-LD structured data name
- `Admin.tsx` -- Helmet title
- `Terms.tsx` -- Helmet title/meta
- `PrivacyPolicy.tsx` -- Helmet title/meta

### 11. CSS animation names (kept as-is)

Internal identifiers like `drape-in`, `drape-out`, `stagger-drape` are not user-facing and will remain unchanged.

## Technical Summary


| File                                           | Change                                         |
| ---------------------------------------------- | ---------------------------------------------- |
| `src/assets/burs-logo.png`                     | New logo file                                  |
| `src/components/ui/DrapeLogo.tsx`              | Export renamed to `BursLogo`, new image + text |
| `src/components/marketing/MarketingLayout.tsx` | Import update                                  |
| `src/pages/Auth.tsx`                           | Brand name                                     |
| `public/manifest.json`                         | PWA name                                       |
| `index.html`                                   | Meta tags                                      |
| `src/config/marketing.ts`                      | All brand references                           |
| `src/i18n/translations.ts`                     | All locales updated                            |
| `src/pages/settings/SettingsPrivacy.tsx`       | Export filename, email                         |
| `src/pages/marketing/MarketingHome.tsx`        | JSON-LD                                        |
| `src/pages/marketing/Admin.tsx`                | Helmet title                                   |
| `src/pages/marketing/Terms.tsx`                | Helmet title/meta                              |
| `src/pages/marketing/PrivacyPolicy.tsx`        | Helmet title/meta                              |
