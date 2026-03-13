

## 10-Step Plan: From 72 → 85+ Score

Based on your breakdown, here are 10 high-impact steps ordered by effort-to-value ratio.

---

### Step 1 — Remove `.env` from Git history
The `.env` file with real keys in the repo is the single biggest diligence red flag. We need to add it to `.gitignore` (it's already there but was committed before). Rotate any leaked keys.

**Impact**: Security +10 | Investor readiness +5

---

### Step 2 — Fix lockfile sync
The `bun.lock`, `bun.lockb`, and `package-lock.json` all exist simultaneously. Pick one package manager, delete the others, and ensure `ci` installs pass cleanly.

**Impact**: Code quality +3 | Investor readiness +3

---

### Step 3 — Replace placeholder README
Write a real README with: product description, architecture overview, local dev setup, environment variables needed (without values), deployment instructions, and tech stack summary.

**Impact**: Investor readiness +5 | Defensibility +3

---

### Step 4 — Reduce main bundle to under 500KB
The ~1.6MB chunk is the biggest performance issue. Actions:
- Audit `AnimatedRoutes.tsx` — several eagerly-imported pages (Auth, Landing, Home) pull in heavy deps like `framer-motion`, `recharts`, `three.js`
- Lazy-load `@react-three/*`, `recharts`, `three` — these are massive and only used on specific pages
- Add `manualChunks` in `vite.config.ts` to split vendor libs
- Tree-shake `lucide-react` (import individual icons, not the barrel)

**Impact**: Product scope +3 | Scalability +8 | Code quality +5

---

### Step 5 — Add critical-path test coverage (target: 40%)
No tests = no confidence in refactoring. Priority test targets:
- `useSubscription` (billing logic)
- `useGarments` / `useOutfits` (core CRUD)
- `ProtectedRoute` (auth gating)
- `AuthContext` (session handling)
- Key edge functions: `stripe_webhook`, `create_checkout_session`, `delete_user_account`

**Impact**: Code quality +10 | Investor readiness +8 | Scalability +5

---

### Step 6 — Harden RLS and audit edge function auth
Several edge functions have `verify_jwt = false` in `config.toml` but handle sensitive operations (e.g., `delete_user_account`, `create_checkout_session`). For each:
- Confirm the function itself validates the JWT internally (most do, but audit all 36)
- Document which functions are intentionally public (webhooks, VAPID key)
- Run the security scan tool and resolve all `warn`-level findings

**Impact**: Security +12 | Investor readiness +5

---

### Step 7 — Add error monitoring and observability
Sentry is initialized but only with `tracesSampleRate: 0.2` and no replay. Add:
- Sentry session replay for error sessions
- Structured error boundaries per route section (not just top-level)
- Edge function error logging to an `error_logs` table or Sentry via `@sentry/deno`

**Impact**: Scalability +5 | Code quality +3

---

### Step 8 — Add rate limiting to AI edge functions
The AI functions (`style_chat`, `generate_outfit`, `mood_outfit`, etc.) have no rate limiting. A single user could burn through API credits. Add per-user rate limits via a simple counter in the database or in-memory per-request check.

**Impact**: Security +5 | Scalability +5 | Defensibility +3

---

### Step 9 — Implement proper CI pipeline
Add a GitHub Actions workflow that runs on every PR:
- `npm ci` (validates lockfile)
- `npm run build` (catches type errors)
- `npm run test` (once tests exist from Step 5)
- `npm run lint`
- Bundle size check (fail if main chunk exceeds threshold)

**Impact**: Code quality +5 | Investor readiness +5 | Scalability +3

---

### Step 10 — Document architecture and IP
Create a `/docs` folder with:
- Architecture diagram (data flow, AI pipeline, billing flow)
- AI abstraction layer docs (`burs-ai.ts` is genuinely defensible IP — document it)
- API reference for edge functions
- Security model documentation (RLS policies, auth flow)

**Impact**: Defensibility +10 | Investor readiness +8

---

### Projected score after all 10 steps

| Category | Current | Projected |
|---|---|---|
| Product scope | 82 | 85 |
| Infrastructure | 78 | 85 |
| Code quality | 67 | 82 |
| Scalability | 71 | 84 |
| Security | 58 | 80 |
| Defensibility | 62 | 78 |
| Investor readiness | 60 | 81 |
| **Overall** | **72** | **~82** |

Steps 1–4 are quick wins (1–2 days each). Steps 5–6 are medium effort (3–5 days). Steps 7–10 are ongoing but each individually moves the needle.

I can start implementing any of these steps. Which ones would you like to tackle first?

