

# Fix: Install Reproducibility (package.json ↔ lockfile sync)

## Root Cause

`package.json` declares `"vitest": "^4.1.0"` but Vitest 4.x does not exist — the latest stable release is **3.x**. The lockfile correctly has `3.2.4` resolved, but `npm ci` will fail because `3.2.4` does not satisfy `^4.1.0`.

## Fix

### 1. Downgrade vitest version in `package.json`
Change line 92:
```
"vitest": "^4.1.0"  →  "vitest": "^3.2.4"
```

This aligns `package.json` with the lockfile and with what actually exists on npm. No code changes needed — the `vitest.config.ts` and all test files already work with Vitest 3.x APIs.

### 2. Verify build passes
The CI workflow runs `bun run test` and `bun run build`. With the version aligned, `npm ci` (and `bun install --frozen-lockfile`) will succeed from a clean clone.

---

That is the entire fix — one version string change in `package.json`.

