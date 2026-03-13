

## Fix Landing Page Mobile Layout

### Issues Identified (at 390px)

1. **Nav overflows** — All links + CTA try to fit in one row at `padding: 0 24px`, wrapping awkwardly across 3 lines. The "GET THE APP" CTA is cut off at the right edge.

2. **No mobile breakpoint** — Only a single `@media(max-width:1024px)` exists. Need a `@media(max-width:640px)` for phone-specific fixes.

3. **Hero headline too large** — `clamp(68px,6.5vw,104px)` bottoms out at 68px which is fine, but padding and overall spacing is desktop-oriented.

4. **Stats bar** — At 50% width per stat, the numbers and labels are cramped. Should stack to 1 column on phones.

5. **Screens grid** — Still 2 columns at mobile, phone frames are tiny and text beneath is cramped.

6. **Bento grid** — 2 columns on mobile makes cards very narrow, text barely readable.

7. **How-it-works steps** — `grid-template-columns: 80px 1fr` works but the step numbers are large (44px).

8. **Insight row** — Already 1 column but phone frames inside have fixed widths that may overflow.

9. **Pricing cards** — Already 1 column, but padding `60px 52px` is too wide for 390px.

10. **Footer** — `footer-top` flex layout wraps oddly; links and copyright stack unevenly.

11. **Custom cursor visible on mobile** — The dot + ring cursor elements show on touch devices where they're useless.

12. **Horizontal scrollbar** — Some elements likely cause overflow.

### Changes — `public/landing.html`

Add a `@media(max-width:640px)` block after the existing 1024px breakpoint:

**Nav**: Hide nav links on mobile, show only logo + CTA button. Reduce nav height and padding.

**Hero**: Reduce padding to `60px 20px 40px`. Reduce subtitle font size. Stack hero actions vertically.

**Stats**: Stack to single column (`flex-direction: column`), reduce padding.

**Screens grid**: Single column, limit phone frame width.

**Bento grid**: Single column.

**How-it-works**: Reduce step number size, tighten grid gap.

**Insight row**: Reduce padding, constrain phone frame sizes.

**Pricing**: Reduce card padding to `40px 24px`. Reduce price amount font size.

**Download section**: Reduce padding, stack store buttons vertically.

**Footer**: Stack footer-top vertically, center-align items, reduce padding.

**Cursor**: Hide `#_cur` and `#_ring` on mobile via `display:none`.

**Overflow**: Add `overflow-x: hidden` to body.

**Section padding**: Reduce `.sec` to `60px 20px` on mobile.

### Files to edit
1. `public/landing.html` — Add `@media(max-width:640px)` CSS block with all mobile fixes

