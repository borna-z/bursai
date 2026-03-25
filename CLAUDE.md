# BursAI - Claude Code Guide

## Build & Test
- `npm run build` — production build (Vite)
- `npm test` — run all tests
- `npm run dev` — local dev server on port 8080

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
- Live scan pipeline: capture → compress → remove background → AI analyze → save
- Background removal runs client-side via WASM (no server round-trip)
- Median WebView compatibility required — avoid `fetch(dataUrl)` patterns
