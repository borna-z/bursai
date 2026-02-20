

# Replace BURS Logo with New Brand Mark

## What will change

The uploaded logo image will be copied into the project and the `DrapeLogo` component will be updated to use it instead of the old `drape-logo.png`.

## Steps

### 1. Copy the uploaded logo image
- Copy `user-uploads://Gemini_Generated_Image_qeunkmqeunkmqeun_1-2.png` to `src/assets/burs-logo.png`

### 2. Update `src/components/ui/DrapeLogo.tsx`
- Change the import from `drape-logo.png` to `burs-logo.png`
- The component already supports `icon` and `horizontal` variants, so it will work as-is with the new image

### 3. Update `Landing.tsx` logo usage
- Hero: Change from `variant="wordmark"` (text-only) to `variant="horizontal"` (icon + wordmark) since the right side of the uploaded image shows the icon with "BURS" text below
- Footer: Already uses `variant="horizontal"` -- no change needed

### How it maps to your request
- **Left logo (icon only)** -- Used in the app via `variant="icon"` (e.g., bottom nav, headers)
- **Right logo (icon + BURS wordmark)** -- Used on the landing page via `variant="horizontal"`

### Technical note
The current component renders the icon as an `<img>` tag with the "BURS" wordmark as separate text. This means the icon portion of the uploaded image will be used for the mark, and the text "BURS" is rendered by the component in Sora font. The uploaded image serves as the new icon/mark asset.
