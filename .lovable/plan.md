
# Rebranding: "AI Garderobsassistent" → "DRAPE"

The uploaded image shows the official brand identity: the name is **DRAPE** with a distinctive double-D monogram icon (two overlapping "D" letterforms). The plan is to update every instance of the old name and introduce the SVG logo across the entire app.

---

## What changes

### 1. Logo asset
- Copy the uploaded logo image to `src/assets/drape-logo.png`
- Create an inline SVG `DrапeLogo` component in `src/components/ui/DrапeLogo.tsx` that renders the double-D monogram using SVG paths (matching the brand image exactly), so it scales perfectly and supports light/dark mode (stroke color adapts to `currentColor`)

### 2. `index.html` – meta & PWA tags
- `<title>` → `DRAPE | Din personliga stylist`
- `<meta name="description">` → updated to use "DRAPE"
- `<meta name="author">` → `DRAPE`
- `<meta name="apple-mobile-web-app-title">` → `DRAPE`
- All OG and Twitter meta tags updated with the DRAPE name

### 3. `src/config/marketing.ts`
All text references updated:
- `meta.title` → `"DRAPE | Din personliga stylist"`
- `footer.copyright` → `"© 2025 DRAPE"`
- Hero, social proof, FAQ copy updated to say "DRAPE" instead of "AI Garderobsassistent"

### 4. `src/components/marketing/MarketingLayout.tsx`
- Replace `"AI Garderobsassistent"` text in the nav header with the `DrapeLogo` component (icon + "DRAPE" wordmark, horizontal lockup)
- Footer brand name updated to DRAPE

### 5. `src/pages/Auth.tsx`
- Replace the `<Sparkles>` icon with the `DrapeLogo` icon component
- Update the welcome heading area: show the DRAPE monogram prominently above "Välkommen"
- Subtitle: `"Din personliga stylist."` (shorter, brand-consistent)

### 6. `src/pages/Home.tsx` (PageHeader)
- The greeting `"God morgon 👋"` stays, but add a small DRAPE monogram in the top-left or alongside the greeting for brand recognition

### 7. `src/pages/Settings.tsx`
- Any "AI Garderobsassistent" mentions updated to "DRAPE"

### 8. `src/pages/AIChat.tsx`
- Welcome message uses "DRAPE Stylisten" branding
- The `Bot` icon in the chat can be replaced with the DRAPE monogram for the assistant avatar

### 9. `src/pages/marketing/MarketingHome.tsx`
- Page title `<Helmet>` → `"DRAPE | Din personliga stylist"`

---

## Technical approach for the logo

Since the logo is a complex double-D monogram (SVG paths would be complex to recreate perfectly), we will:

1. **Copy the PNG** to `src/assets/drape-logo.png` and use it where an image works well (marketing nav, auth page)
2. **Create a text-based wordmark** component for inline use using the Sora font (already loaded) with `font-weight: 700` and `letter-spacing: 0.05em` — this matches the clean Scandinavian wordmark style from the brand sheet
3. **For the monogram icon** — use a styled `D` letterform with the Sora font in a rounded square container (matching the "App Icon" style from the brand image) for the favicon/PWA icon area

This approach is clean, scalable and avoids image-quality issues.

### Logo Component structure
```text
<DrapeLogo variant="icon" />        → just the monogram D-mark
<DrapeLogo variant="wordmark" />    → "DRAPE" text only
<DrapeLogo variant="horizontal" />  → icon + "DRAPE" text side by side
```

---

## Files to create/edit

| File | Change |
|---|---|
| `src/assets/drape-logo.png` | Copy from user upload |
| `src/components/ui/DrapeLogo.tsx` | New logo component (3 variants) |
| `index.html` | Title, meta, PWA name → DRAPE |
| `src/config/marketing.ts` | Brand name throughout |
| `src/components/marketing/MarketingLayout.tsx` | Nav + footer logo |
| `src/pages/Auth.tsx` | Logo in auth screen header |
| `src/pages/Home.tsx` | Logo in app header |
| `src/pages/Settings.tsx` | Brand name text |
| `src/pages/AIChat.tsx` | Assistant branding |
| `src/pages/marketing/MarketingHome.tsx` | Helmet title |
