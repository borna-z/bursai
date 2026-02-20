

## Replace Hanger Logo with New B-Hanger Logo

### What Happens
The current hanger logo PNG gets replaced with your new B-hanger monogram (the stylized B integrated with a hanger shape).

### Changes

**1. Replace the logo asset**
- Copy `user-uploads://Gemini_Generated_Image_w3ckqyw3ckqyw3ck.png` to `src/assets/burs-hanger-logo.png`, overwriting the previous file.

**2. No code changes needed**
`BursMonogram.tsx` already imports from `src/assets/burs-hanger-logo.png`, so the new logo will automatically appear everywhere: Landing page, Terms, Privacy, Contact, and in-app via DrapeLogo.

### Files

| File | Change |
|------|--------|
| `src/assets/burs-hanger-logo.png` | Replaced with new B-hanger monogram |

