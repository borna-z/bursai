

## Add Particle Animation to Hero Section

### What changes
Add a subtle, performant star-field / floating particle effect to the hero section using pure CSS (no external library needed). This creates an immersive "space" feel without impacting performance.

### Implementation

**1. `src/index.css` -- Add particle keyframes and styles**
- Add a `.particles` container class with `pointer-events: none` and full absolute coverage
- Add 15-20 tiny dot elements via a new `StarField` component with randomized positions, sizes (1-3px), opacities (0.05-0.2), and float speeds
- Add a `twinkle` keyframe that subtly pulses opacity
- Add a slow `drift` keyframe for gentle lateral movement

**2. `src/pages/Landing.tsx` -- Add StarField to hero**
- Create an inline `StarField` component that renders ~20 absolutely positioned tiny circles with randomized CSS custom properties for position, size, animation duration, and delay
- Place it inside the hero `<section>` alongside the existing `aurora-glow` div
- Each particle gets a combination of the `twinkle` and `drift` animations at different speeds for organic movement
- All particles use `pointer-events: none` and very low opacity (white at 5-15%) to stay subtle

### Visual result
- Tiny white dots scattered across the hero, gently twinkling and drifting upward
- Complements the existing aurora glow and floating decorative dots
- Zero performance impact (CSS-only animations, no JS animation loop)
- Subtle enough to not distract from the headline and CTAs

