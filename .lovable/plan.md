

## Fix Landing Page Footer Layout

The current footer uses `display: flex; justify-content: space-between` which crams the logo, links, copyright, and AI disclaimer all on one row. The AI disclaimer also has `width: 100%` but can't break to its own line because the parent isn't wrapping.

### Changes (all in `public/landing.html`)

**1. Restructure footer CSS (lines 175-183)**

Replace the current footer styles with a stacked two-row layout:
- **Top row**: Logo on the left, nav links (PRIVACY · TERMS · CONTACT) centered, copyright (© 2026 BURS) on the right — with generous spacing and `flex-wrap: wrap` for mobile
- **Bottom row**: AI disclaimer centered below a subtle divider, with proper top margin

Key style changes:
- `footer` becomes `flex-wrap: wrap` with more padding (e.g. `56px 72px 32px`)
- Add a `.footer-top` wrapper div for the three main elements (logo, links, copyright) as a flex row with `justify-content: space-between`, `align-items: center`, `width: 100%`, and `gap: 48px`
- `.footer-links` gets larger `gap: 40px`
- `.footer-ai` gets `margin-top: 32px`, `padding-top: 24px`, `border-top: 1px solid var(--border)`

**2. Restructure footer HTML (lines 650-667)**

Wrap the logo, links, and copyright in a `.footer-top` div:

```html
<footer>
  <div class="footer-top">
    <div class="footer-logo">...</div>
    <nav class="footer-links">...</nav>
    <div class="footer-copy">© 2026 BURS</div>
  </div>
  <div class="footer-ai">...</div>
</footer>
```

This creates clear visual separation between the main footer content and the AI attribution line, with breathing room between all elements.

