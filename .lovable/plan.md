

# Fix: Header Design + 3D Animation

## Root Cause
Two issues found:

1. **3D not rendering**: `@react-three/fiber` and `three` are **missing from `package.json`**. Only `@react-three/drei` was installed. The Canvas component fails silently, and the console shows `THREE.WebGLRenderer: Context Lost`.

2. **Header looks flat**: The `glass-panel` class uses only 2% white opacity with no visible background, making it nearly invisible against the dark hero.

## Changes

### 1. Install missing 3D packages
Add to `package.json`:
- `@react-three/fiber@^8.18.0`
- `three@^0.170.0`

### 2. Improve header styling (Landing.tsx)
- Replace `glass-panel` on the header with a stronger glassmorphism treatment: higher background opacity (`rgba(3,3,5,0.7)`), stronger blur, subtle bottom border glow
- Add `backdrop-saturate-150` for richer glass effect
- Make header background darken further on scroll (via a scroll-aware class or inline style)

### 3. Fix Scene3D frameloop
- Change `frameloop="demand"` to `frameloop="always"` so the hanger continuously animates (the `useFrame` in FloatingHanger calls `invalidate()` but demand mode can still cause stalls on initial render)

### 4. Verify FloatingHanger renders
- No code changes needed in FloatingHanger — it's correct, just couldn't render without the core packages

## Files Modified
- `package.json` — add `@react-three/fiber`, `three`
- `src/pages/Landing.tsx` — header class upgrade
- `src/components/landing/Scene3D.tsx` — change frameloop to "always"

