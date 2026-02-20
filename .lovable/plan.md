

## Replace SVG Monogram with Uploaded Hanger Logo

### What Happens
The current auto-generated SVG "B" monogram gets replaced with your actual hanger logo (the uploaded PNG with transparent background).

### Changes

**1. Copy the uploaded logo into the project**
- Copy `user-uploads://Gemini_Generated_Image_tnfimntnfimntnfi-2.png` to `src/assets/burs-hanger-logo.png`

**2. Update `src/components/ui/BursMonogram.tsx`**
- Replace the inline SVG with an `<img>` tag that imports the new hanger logo PNG
- Keep the same `size` and `className` props so all existing usage works without changes
- Use `object-contain` to scale properly at all sizes (20px to 80px)

No other files need to change -- Landing.tsx, Terms.tsx, PrivacyPolicy.tsx, Contact.tsx, and DrapeLogo.tsx all import `BursMonogram` and will automatically use the new image.

### Files

| File | Change |
|------|--------|
| `src/assets/burs-hanger-logo.png` | New file -- your uploaded logo |
| `src/components/ui/BursMonogram.tsx` | Replace SVG with img using the new PNG asset |
