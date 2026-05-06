# V0 — CI/CD foundations

| Field | Value |
|---|---|
| Goal | Establish per-PR CI gates that every later wave depends on. No wave ships before V0. |
| Status | TODO |
| Branch | `mobile-v0-ci-foundations` |
| PR count | 1 |
| Depends on | — |
| Complexity | M |

## Background

Every later wave's "Acceptance gates" line `V0 CI gates: all green` resolves to the workflow built here. The workflow runs on every PR targeting `main` and blocks merge on any failed gate. Branch protection enforces that.

## Files touched

### New
- `.github/workflows/mobile-ci.yml` — workflow definition
- `mobile/eas.json` — EAS dev client + preview profiles (build runs in M43, configured here)
- `mobile/.eslintrc.cjs` (or `.eslintrc.json`) — ESLint config for `mobile/` if not yet present (TypeScript + RN preset)

### Modified
- `mobile/package.json` — add `lint`, `typecheck` scripts; ensure `eslint`, `@typescript-eslint/*`, `eslint-config-expo` are in `devDependencies`
- `mobile/CLAUDE.md` — add the verbatim "Code-reviewer subagent brief" + V0 gates reference (covered by Phase 4 CLAUDE.md rewrite — this wave verifies the brief is present)

### Tracker
- Flip V0 to `DONE (PR #<num>)` in `docs/launch/overview.md`
- Move CURRENT WAVE pointer to M1
- Append `completion-log.md` row

## Workflow gates

The workflow runs on `pull_request` targeting `main`. Trigger paths: `mobile/**`, `supabase/functions/**`, `supabase/migrations/**`, `.github/workflows/**`.

Each job is its own check so branch protection can require all six.

### 1. typecheck
```yaml
- run: cd mobile && npm ci
- run: cd mobile && npx tsc --noEmit --skipLibCheck
```
Must exit 0.

### 2. lint
```yaml
- run: cd mobile && npx eslint src --ext .ts,.tsx --max-warnings 0
```
ESLint config extends `expo` + `@typescript-eslint/recommended`. Disable rules that conflict with the existing mobile codebase pragmatically — but never `no-unused-vars`, `no-undef`, or `@typescript-eslint/no-explicit-any`.

### 3. expo-doctor
```yaml
- run: cd mobile && npx expo-doctor
```
Sentry version mismatch is the known excluded warning — `package.json` already lists it under `expo.install.exclude` since M0. Any *new* warning fails the gate.

### 4. bundle-size
```yaml
- run: cd mobile && npx expo export -p ios -o /tmp/expo-export
- run: |
    SIZE=$(du -sb /tmp/expo-export/_expo/static/js | cut -f1)
    GZIPPED=$(find /tmp/expo-export/_expo/static/js -name '*.hbc' -o -name '*.js' | xargs cat | gzip | wc -c)
    echo "Raw bundle: $SIZE bytes; gzipped: $GZIPPED bytes"
    if [ "$GZIPPED" -gt 7000000 ]; then echo "Bundle exceeds 7MB gzipped — fail"; exit 1; fi
    if [ "$GZIPPED" -gt 5000000 ]; then echo "::warning::Bundle exceeds 5MB gzipped — investigate"; fi
```
Warn at 5 MB gzipped, fail at 7 MB. Threshold revisited at M42.

### 5. deno-check (when supabase/functions/* changes)
```yaml
- if: contains(github.event.pull_request.changed_files, 'supabase/functions/')
- run: |
    for fn in $(git diff --name-only origin/main...HEAD -- 'supabase/functions/*/index.ts'); do
      deno check "$fn"
    done
```
Skipped when no edge function files changed.

### 6. migration-smoke (when supabase/migrations/* changes)
```yaml
- if: contains(github.event.pull_request.changed_files, 'supabase/migrations/')
- run: npx supabase db lint --linked
- run: npx supabase db push --linked --dry-run --yes
```
Migration-list drift would fail this. New migrations should appear in dry-run output.

## Branch protection (configure in GitHub)

On `main`:
- Require PRs (no direct pushes)
- Require all six checks to pass: `typecheck`, `lint`, `expo-doctor`, `bundle-size`, `deno-check`, `migration-smoke`
- Require linear history
- Allow force-push by admins only (so `git commit --amend && --force-with-lease` for tracker fixups still works)

## EAS dev client profile (mobile/eas.json)

Configured here, used by M43 + M44:
```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "android": { "buildType": "apk" }
    },
    "preview": { "distribution": "internal", "channel": "preview" },
    "production": { "channel": "production" }
  },
  "submit": { "production": {} }
}
```

The actual `eas build` command does not run in V0 — that's M43. V0 only commits the config.

## Code-reviewer subagent brief

The verbatim brief lives in `mobile/CLAUDE.md` after the Phase 4 rewrite ships in this same documentation PR. V0 verifies it's present and reviewers paste it before pushing.

CI does not gate on the subagent (humans run it locally) but the convention is mandatory for every wave PR. Wave acceptance gates always reference it.

## Test fixtures

`jest-expo` is **not** required by V0. Unit tests are deferred to a follow-up testing wave (track in `findings-log.md`). V0 ships CI-only.

Note in `findings-log.md`:
> Unit-test infrastructure (jest-expo + RN testing library) deferred. Tracking for: post-launch testing wave.

## Acceptance gates

- TypeScript: workflow `typecheck` job passes
- Lint: workflow `lint` job passes
- Branch protection: all six checks listed as required on `main`
- Negative test: open a throwaway PR that intentionally fails `tsc` (e.g., add `const x: number = "string"` to a screen), confirm CI blocks merge, close PR
- Positive test: open a throwaway PR that passes (e.g., add a no-op comment), confirm green checks, close PR
- Code-reviewer subagent: approved (brief in `mobile/CLAUDE.md`)

## Deploy

None. Workflow file lands on the branch and triggers on the next PR. No edge function or migration changes.

## PR template

```
Title: feat(ci): mobile V0 — GitHub Actions + branch protection + EAS profile

Body:
## Wave
V0 — CI/CD foundations (`docs/launch/waves/m-v0-ci-foundations.md`)

## Problem
No CI runs on mobile PRs. Every later wave's "V0 CI gates" line resolves to nothing.

## Fix
- New .github/workflows/mobile-ci.yml with 6 jobs
- New mobile/eas.json with development/preview/production profiles
- ESLint config + lint script in mobile/package.json
- Branch protection configured in GitHub UI (manual step, screenshot in PR)
- Throwaway PR negative + positive tests confirm gates work

## Verification
- TypeScript: 0 errors
- V0 CI gates: 6 checks green on this PR
- Negative throwaway PR: blocked at typecheck (link)
- Positive throwaway PR: green checks (link)
- Code-reviewer subagent: approved

## Out of scope
- Unit tests (jest-expo) — tracked in findings-log.md for post-launch testing wave
```

## Tracker updates (same PR)

- `docs/launch/overview.md`: V0 row → `DONE (PR #<num>)`; CURRENT WAVE → M1
- `docs/launch/completion-log.md`: append V0 row
- `docs/launch/findings-log.md`: append jest-expo deferral row
