

## Use uploaded logo in landing page and auth page

The uploaded image (`burs-logo-256-2.png`) is the BURS "B" hanger monogram. It needs to be placed in:

1. **Auth page** (`src/pages/Auth.tsx`) — currently uses `burs-landing-logo.png` (a wordmark). Replace with the new monogram.
2. **Landing page** (`public/landing.html`) — nav logo (line 287, inline SVG) and footer logo (line 752, references `ca6398d3...png`). Replace both with the new image.

### Steps

1. **Copy the uploaded image** to `public/burs-logo-256-2.png` (needed for the static HTML landing page) and to `src/assets/burs-logo-256-2.png` (for the React auth page import).

2. **`src/pages/Auth.tsx`**
   - Change the import from `burs-landing-logo.png` to `burs-logo-256-2.png`
   - Adjust the `<img>` tag size if needed (the current logo is `h-8`, the monogram may look better at `h-10` or `h-12`)

3. **`public/landing.html`**
   - **Nav logo** (line ~287): Replace the inline SVG/long element with `<img src="/burs-logo-256-2.png" alt="BURS" />`
   - **Footer logo** (line ~752): Change `src` from the current lovable-uploads path to `/burs-logo-256-2.png`

