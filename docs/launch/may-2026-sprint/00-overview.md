# May 2026 Launch Sprint — Overview

**Sprint window:** 2026-05-17 → 2026-05-31 (Plan A) · post-launch follow-on (Plans B, C)
**CLAUDE.md is in LAUNCH MODE until 2026-05-31** — ship-only freeze on non-launch work.

## The three workstreams

| Plan | Title | Owner | Target | File |
|---|---|---|---|---|
| **A** | Launch readiness — App Store + Play Store submission | Borna + Claude | 2026-05-31 | [A-launch-readiness.md](A-launch-readiness.md) |
| **B** | Meta Ads autonomous marketing agent | Co-founders + their Claude sessions | 2026-06-28 | [B-meta-ads-agent.md](B-meta-ads-agent.md) |
| **C** | Marketing dashboard webapp | Borna + Claude | 2026-06-21 | [C-marketing-dashboard.md](C-marketing-dashboard.md) |

## Sequencing

- **A is the only workstream with a hard date.** B and C do not block A.
- **Plan C execution does not start until A is submitted** (2026-05-31). The plan is written now so co-founders and stakeholders can review scope; build follows submission.
- **Plan B is fully co-founder-owned.** This repo ships the handoff doc only. Co-founders' Claude sessions read `B-meta-ads-agent.md` standalone — it is self-contained on purpose.
- Until A ships, any non-A work attempted in this session is out of scope per the LAUNCH MODE block in `CLAUDE.md`.

## Cross-plan dependencies

- C's MC3 (ad performance panel) reads Meta Pixel / Conversions API events shipped by A's M2 submission-track work.
- C's MC4 (agent activity feed) reads B's `audit_log` table — gated on B reaching MB2.
- B has no upstream dependency on A or C. It can start the moment co-founders pick it up. B benefits from Pixel/CAPI events shipping in A (better attribution insights), but does not block on them.

## Status tracking

| Milestone | Plan | Target | Status |
|---|---|---|---|
| M45 — Accent contrast hotfix | A (M2) | 2026-05-18 | IN PR |
| M46 — Trial-start offline-queue | A (M2) | 2026-05-19 | IN PR |
| M1 — Audit + Wave R close | A | 2026-05-20 | DONE (audit 2026-05-17 — R-wave already merged 2026-05-15) |
| M2 — Submission-track waves + Pixel/CAPI | A | 2026-05-24 | TODO |
| M3 — Store assets + QA pass | A | 2026-05-27 | TODO |
| M4 — Submitted | A | 2026-05-29 | TODO |
| M5 — Approved | A | 2026-05-31 | TODO |
| MB1 — Read-only insights | B | 2026-06-07 | NOT STARTED |
| MB2 — Draft + human-approval queue | B | 2026-06-14 | NOT STARTED |
| MB3 — Gated autonomous publish | B | 2026-06-21 | NOT STARTED |
| MB4 — Budget reallocation | B | 2026-06-28 | NOT STARTED |
| MC1 — Scaffold + auth + signups | C | 2026-06-03 | NOT STARTED |
| MC2 — Revenue panel | C | 2026-06-07 | NOT STARTED |
| MC3 — Funnel + ad performance | C | 2026-06-14 | NOT STARTED |
| MC4 — B agent activity feed | C | 2026-06-21 | NOT STARTED |

Update this table when a milestone flips. Same PR that closes a milestone updates this row.

## How a session picks up sprint work

1. Read `CLAUDE.md` (always loaded — note the LAUNCH MODE block at top).
2. Read this overview to identify the active milestone.
3. Read the relevant plan file (`A-…`, `B-…`, or `C-…`) — each is self-contained.
4. For Plan A, also read the relevant wave file under `docs/launch/waves/` per the standing per-PR workflow.

## Out of scope for this sprint

- Refactors not required to ship.
- New features not in the audit punch list (M1 deliverable).
- Web `src/` work — being deleted post-launch per `CLAUDE.md`.
- Anything outside Plans A, B, C.
