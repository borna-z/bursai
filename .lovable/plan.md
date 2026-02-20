

## Revert Logo to Original PNG (Higher Quality Rendering)

The last edit replaced your original hanger logo (`burs-hanger-logo.png`) with a hand-drawn SVG. You want the original logo back.

### What will change

**`src/components/ui/BursMonogram.tsx`** -- Revert to the PNG-based version:
- Re-import `burs-hanger-logo.png`
- Remove all the inline SVG paths
- Render as an `<img>` tag with `object-contain` for crisp scaling
- Use higher rendered resolution: load the image at 2x the display `size` and constrain it with CSS `width`/`height`, so on retina/hi-DPI screens it stays sharp instead of looking blurry

### Technical Detail

The component will render something like:

```tsx
<img
  src={hangerLogo}
  alt="BURS"
  width={size}
  height={size}
  className="flex-shrink-0 object-contain"
  style={{ imageRendering: 'auto' }}
/>
```

No other files change. The landing page hero already uses `<BursMonogram size={80} />` and will automatically pick up the reverted logo.
