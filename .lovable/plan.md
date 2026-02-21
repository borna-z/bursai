

# Update Pressable Component Transition

## What
Change the `Pressable` component's tap animation from a spring-based transition to a tween-based transition, matching the consistent `[0.25, 0.1, 0.25, 1]` easing curve used across the rest of the app (AnimatedRoutes, AnimatedPage, AnimatedTab).

## Technical Details

### File: `src/components/ui/pressable.tsx`

Replace the current spring transition:
```typescript
transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
```

With the app-wide tween transition:
```typescript
transition={{ type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.15 }}
```

A short `0.15s` duration keeps the tap feedback feeling snappy while staying consistent with the tween pattern used everywhere else.

**1 file modified:** `src/components/ui/pressable.tsx`

