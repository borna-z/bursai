

## Fix Landing Page: Light Theme, Working Animations, Pricing Section

### Problems Found

1. **Dark mode on landing page**: The page uses `bg-background` which follows the user's theme (dark). The landing page should always be light to match the Scandinavian brand identity.

2. **Scroll-reveal animations are broken**: The `useScrollReveal` hook adds `.visible` to the **section wrapper** (the element with `ref`), but the `.scroll-reveal` CSS class is on **child elements** inside those sections. Since `.scroll-reveal.visible` requires both classes on the same element, children never become visible -- they stay at `opacity: 0` permanently. This is why only the header and footer show after scrolling.

3. **No pricing information**: The landing page has no section explaining Free vs Premium plans, monthly (79 kr) and yearly (699 kr) costs, or what features are included.

4. **No "Pricing" nav link**: The header nav has "How it works", "Sustainability", "Our Mission" but no link to pricing.

---

### Plan

#### 1. Force light theme on the landing page

Wrap the entire landing page content in a container with `class="light"` and override CSS variables inline so it always renders in light mode regardless of the user's app theme. This avoids touching the ThemeContext.

```text
<div className="light" style={{ colorScheme: 'light' }}>
  <div className="min-h-screen bg-background text-foreground ...">
    ...
  </div>
</div>
```

#### 2. Fix scroll-reveal animations

Replace `useScrollReveal` (which only observes one parent node) with a new approach inside Landing.tsx: a single `useEffect` that creates one IntersectionObserver targeting all `.scroll-reveal` elements directly. Each element gets `.visible` added individually when it enters the viewport.

```text
useEffect(() => {
  const els = document.querySelectorAll('.scroll-reveal');
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    }),
    { threshold: 0.15 }
  );
  els.forEach(el => observer.observe(el));
  return () => observer.disconnect();
}, []);
```

Remove the four individual `useScrollReveal()` hook calls and their `ref={}` attributes from the sections. Keep the existing `.scroll-reveal` / `.scroll-reveal.visible` CSS unchanged.

#### 3. Add a Pricing section

Insert a new section (id="pricing") between the Trust/Mission section and the Final CTA. Content:

- Section header: "Simple, transparent pricing"
- Two side-by-side cards (Free / Premium)
- **Free card**: 0 kr, 10 garments, 10 outfits/month, basic AI styling
- **Premium card** (highlighted): 79 kr/month or 699 kr/year (save ~26%), unlimited garments, unlimited outfits, smarter AI, priority support
- A "Get Started" CTA button below

This is static content -- no checkout logic needed on the landing page (users sign up first then hit the in-app paywall/pricing page).

#### 4. Add "Pricing" to the nav

Add a fourth nav link "Pricing" in both desktop and mobile nav that scrolls to `#pricing`.

---

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/Landing.tsx` | Wrap in `.light` container; replace `useScrollReveal` hooks with a single `useEffect` observer; add Pricing section; add Pricing nav link |

No other files need changes. The existing CSS animation classes, assets, and routes remain untouched.

### Technical Details

- The `.light` wrapper class triggers the `:root` CSS variables (warm off-white `#F6F4F1` background) regardless of the `<html>` dark class
- The pricing section uses plain HTML/Tailwind -- no Stripe integration or i18n needed (landing page is English-only)
- Scroll-reveal fix targets all `.scroll-reveal` elements in one observer pass, which is more efficient than 4 separate hooks

