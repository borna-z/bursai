# BursAI - Codex Guide

## Build & Test
- `npm run build` - production build (Vite)
- `npm test` - run all tests
- `npm run dev` - local dev server on port 8080

## Architecture
- React + TypeScript + Vite
- Supabase backend (auth, DB, storage, edge functions)
- TanStack React Query for data fetching
- Radix UI + Tailwind CSS for styling
- Framer Motion for animations
- `@imgly/background-removal` for client-side WASM background removal

## Key Conventions
- Path alias: `@/` maps to `src/`
- Edge functions invoked via `src/lib/edgeFunctionClient.ts`
- Garment images stored in Supabase `garments` bucket
- Live scan pipeline: capture -> compress -> remove background -> AI analyze -> save
- Background removal runs client-side via WASM (no server round-trip)
- Median WebView compatibility required - avoid `fetch(dataUrl)` patterns

## Figma Design System Rules

These rules apply whenever implementing a Figma design in this repository.

### Required Figma Flow
1. Run `get_design_context` for the exact node(s) first.
2. If the response is too large or truncated, run `get_metadata` to map the page and then re-run `get_design_context` only for the needed nodes.
3. Run `get_screenshot` for the exact variant/state being implemented.
4. Treat the Figma MCP output as structure and behavior reference, not final code style.
5. Rewrite the result into this repo's React + TypeScript + Tailwind conventions before shipping.
6. Validate the final result against the Figma screenshot in the relevant theme/state before marking complete.

### Component Placement
- Reuse existing primitives from `src/components/ui/` first.
- Prefer existing building blocks such as `Button`, `Card`, `Chip`, `Sheet`, `Dialog`, `Tooltip`, `LazyImage`, `AnimatedPage`, and `SectionHeader` before creating new primitives.
- Put reusable cross-feature UI in `src/components/ui/`.
- Put feature-specific Figma compositions in `src/components/<feature>/`.
- Put route-level screens in `src/pages/`.
- Use the `@/` path alias for internal imports.

### Styling and Tokens
- Use Tailwind utility classes for styling and `cn()` from `src/lib/utils.ts` for class composition.
- Use `cva` for components that have real variants or sizes.
- Colors, radii, and semantic surfaces come from the CSS variables in `src/index.css` and the Tailwind mappings in `tailwind.config.ts`.
- Prefer semantic tokens like `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-accent`, and `bg-secondary`.
- IMPORTANT: Do not hardcode hex, HSL, or RGBA values for normal app UI when a semantic token already exists.
- Exception: intentional art-directed marketing surfaces or accent swatches may keep bespoke values when that pattern already exists in the repo.
- Prefer existing utility classes and surface patterns such as `surface-hero`, `surface-secondary`, `surface-inset`, `surface-interactive`, `glass-card`, `label-editorial`, `meta`, and `page-container`.
- Preserve the mobile-first app shell: `AppLayout`, safe-area handling, bottom-nav spacing, and the narrow `max-w-lg` / `max-w-xl` content widths used across app screens.

### Typography, Motion, and Accessibility
- Follow the existing typography system from `src/index.css` and `tailwind.config.ts`; do not introduce ad hoc font stacks.
- Reuse motion presets from `src/lib/motion.ts` and wrappers like `AnimatedPage` instead of inventing new transition systems.
- Respect reduced-motion behavior.
- Keep Radix/shadcn accessibility behavior intact; do not replace accessible primitives with custom `div` widgets.
- Use semantic buttons/links, keyboard support, and visible focus states by default.
- For user-facing app copy, use `t(...)` and update the locale files in `src/i18n/locales/` instead of hardcoding new English-only strings.

### Assets, Icons, and Data
- If Figma MCP returns localhost image or SVG sources, use those sources directly.
- IMPORTANT: Do not add a new icon library.
- Prefer `lucide-react`, existing brand/logo components in `src/components/ui/`, or Figma-provided SVG assets.
- Store bundled static assets in `src/assets/` or `public/` following existing patterns.
- User garment/media assets belong in Supabase storage and should render through the existing signed-URL helpers such as `useCachedSignedUrl` and `LazyImage`, not raw bucket URLs.
- Keep data access in hooks/lib layers. Reuse existing React Query hooks, Supabase clients, and `invokeEdgeFunction()` instead of embedding fetch logic in presentational components.
- IMPORTANT: Preserve Median WebView compatibility and avoid `fetch(dataUrl)` patterns.

### Project-Specific Guardrails
- Treat the React/Vite app as the default implementation target; only touch `public/landing.html` for explicit landing-page work.
- Reuse existing route/page patterns from `src/components/layout/` and `src/components/auth/ProtectedRoute.tsx` for app screens.
- Do not introduce Storybook files unless explicitly requested; this repo does not currently use Storybook.

### Testing
- Add co-located Vitest + Testing Library tests in `__tests__/` for new reusable or stateful Figma-derived components.
- Test the important states for the component: loading, empty, populated, selected/interactive, and error where relevant.
- Reuse the existing jsdom test setup in `src/test/setup.ts`.
