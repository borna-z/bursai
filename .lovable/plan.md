

# Final Polish Pass — /welcome Landing Page

## Diagnosis

After reviewing all 13 section components and the CSS system, here are the specific weaknesses:

1. **Spacing inconsistency** — Some sections use `py-24`, others `py-28`, `py-32`, `py-40`. No consistent rhythm.
2. **Typography hierarchy flat** — Headlines all use the same `text-3xl md:text-5xl` pattern. No variation in scale creates monotony.
3. **CTAs lack urgency/clarity** — "Start Free" repeated everywhere without visual differentiation. Ghost CTAs blend too much.
4. **Trust Strip feels thin** — `py-6` is too cramped for a premium strip.
5. **Social Proof cards too plain** — No quotation mark treatment, no visual distinction.
6. **Pricing section needs more breathing room** — Cards feel cramped at `p-8`.
7. **Footer feels utilitarian** — Needs more generous spacing and brand presence.
8. **CSS animations** — beam-sweep is infinite and can feel repetitive. Float animation travel distance (12px) is modest.
9. **Section dividers** — Current `opacity: 0.15` is barely visible. Needs a touch more presence.
10. **Wardrobe grid cards** — Missing `min-height` on non-span items makes them feel small on mobile.
11. **CTA buttons** — Ghost variant hover is too subtle. Primary needs more glow on hover.

## Changes

### CSS (`src/index.css`)
- Increase section divider opacity to 0.22 and add subtle vertical padding (8px margin)
- Make CTA primary hover glow stronger: `box-shadow: 0 0 40px rgba(245,247,250,0.2), 0 0 80px rgba(30,208,231,0.08)`
- Ghost CTA hover: add subtle text brightness and stronger border
- Float animation: increase to 16px travel
- Beam sweep: slow to 8s, make it run once then pause (use `animation-iteration-count` approach or longer timing)
- Add `.lv2-quote-mark` — large decorative quotation mark for testimonials
- Adjust `.lv2-card` resting state: add `inset 0 1px 0 rgba(255,255,255,0.03)` for default top-light

### Hero (`HeroSection.tsx`)
- Add a subtle line under the eyebrow badge: a 40px horizontal gradient line centered below it, acting as a visual anchor
- Increase mb on subheadline from `mb-12` to `mb-14` for more breathing room before CTAs
- Make "Watch the Experience" CTA text slightly more prominent

### Trust Strip (`TrustStrip.tsx`)
- Increase vertical padding to `py-8`
- Increase text size to `text-[11px]` and tracking to `0.25em`
- Add subtle top/bottom gradient fade overlay at edges for seamless blending

### Problem Section (`ProblemSection.tsx`)
- Standardize padding to `py-32 md:py-44`
- Add a subtle gradient background behind the cards area

### System Section (`SystemSection.tsx`)
- Standardize padding to `py-32 md:py-44`
- Make feature titles more distinct: use gradient text treatment on the active title

### AI Stylist (`AIStylistSection.tsx`)
- Standardize padding to `py-32 md:py-44` (already close)
- No major changes needed — strongest section visually

### Wardrobe Visual (`WardrobeVisualSection.tsx`)
- Standardize padding to `py-32 md:py-44`

### Outfit Builder (`OutfitBuilderSection.tsx`)
- Standardize padding to `py-32 md:py-44`
- Add a subtle eyebrow separator line above the section

### Weekly Planner (`WeeklyPlannerSection.tsx`)
- Standardize padding to `py-32 md:py-44`

### How It Works (`HowItWorksSection.tsx`)
- Standardize padding to `py-32 md:py-44`
- Add subheadline under the headline for more context

### Pricing (`PricingSection.tsx`)
- Standardize padding to `py-32 md:py-44`
- Increase card padding to `p-10`
- Add eyebrow label
- Premium card: stronger glow and a subtle top border gradient line
- Add yearly pricing toggle or annual price note below monthly

### Social Proof (`SocialProofSection.tsx`)
- Standardize padding to `py-32 md:py-44`
- Add eyebrow label
- Add large decorative quotation marks (") in each card
- Add a subtle star rating row or trust indicator
- Remove the float animation from cards — it creates visual noise. Use static reveal instead.
- Add a thin top accent line to each card

### Final CTA (`FinalCTASection.tsx`)
- Increase vertical padding to `py-40 md:py-52`
- Add a subtle "BURS" watermark behind the section at very low opacity

### Footer (`LandingFooter.tsx`)
- Increase top padding to `py-20`
- Increase bottom section spacing
- Add a tagline under the logo ("AI Wardrobe Operating System")
- Add Instagram link (@burs_style per brand guidelines)

### Landing.tsx
- No structural changes needed — dividers already placed correctly

## Files to Edit (11 files)
- `src/index.css` — CSS refinements
- `src/components/landing2/HeroSection.tsx` — spacing + visual anchor
- `src/components/landing2/TrustStrip.tsx` — size + fade edges
- `src/components/landing2/ProblemSection.tsx` — spacing
- `src/components/landing2/SystemSection.tsx` — spacing
- `src/components/landing2/WardrobeVisualSection.tsx` — spacing
- `src/components/landing2/OutfitBuilderSection.tsx` — spacing
- `src/components/landing2/WeeklyPlannerSection.tsx` — spacing
- `src/components/landing2/HowItWorksSection.tsx` — spacing + subheadline
- `src/components/landing2/PricingSection.tsx` — spacing + eyebrow + card padding
- `src/components/landing2/SocialProofSection.tsx` — eyebrow + quote marks + remove float
- `src/components/landing2/FinalCTASection.tsx` — spacing + watermark
- `src/components/landing2/LandingFooter.tsx` — spacing + tagline + Instagram

