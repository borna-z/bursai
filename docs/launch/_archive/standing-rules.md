# BURS Launch Plan — Standing Rules

Cross-wave conventions extracted from `LAUNCH_PLAN.md` (split via `refactor/wave-8.5-and-split-launch-plan` for token efficiency). Anything in this file applies to every wave unless that wave's prompt explicitly overrides it.

---

## Standing Rules

### Wave Closure Rule — Findings Cleanup Before Advancing (effective 2026-04-23)

Every wave ends with an **Nx.9 Findings Cleanup sub-wave**. The next wave does not begin until the cleanup closes. Goal: drain the Findings Log's "NOT RESOLVED" rows attributable to that wave (plus any inherited from earlier waves) to zero.

**Mechanics**
1. After Wave N's last functional sub-wave ships, the next agent opens **Wave N.9**.
2. The opening agent re-reads the entire Findings Log in CLAUDE.md, filters rows whose Action column does NOT contain `RESOLVED in PR #...`, and groups them into PR-sized clusters by theme (schema, docs, i18n, observability, housekeeping).
3. Each cluster ships as a focused PR. Completion Log rows carry the `[cleanup]` suffix for trivial filtering.
4. `CURRENT PROMPT` does not advance past Wave N.9 until every open row attributable to Wave N or earlier is either `RESOLVED` or carries a `Scheduled: Wave Y` deferral annotation.
5. User-action items (secret provisioning, dashboard checks, manual git housekeeping) live as checkbox lists inside N.9 PR bodies — not as their own PRs.

**Scope freeze**: N.9 is NOT for new features or scope-expanded fixes. Anything requiring architectural decisions gets `Scheduled:` + opens its own prompt in the next wave.

**History carryover**: Waves 0-3 accumulated findings before this rule existed. They all roll into **Wave 4.9** (first application). Waves 5+ keep findings self-contained.

**Suffix convention on the prompt ID:** cleanup PRs are numbered `W<N>.9-A`, `W<N>.9-B`, etc., in alphabetical order of merge sequence. They do not consume P-numbers from the main prompt list (those are reserved for forward work).
