<!-- Extracted from CLAUDE.md (2026-05-03) to keep the always-loaded tracker tight. Append new entries here, not in CLAUDE.md. See CLAUDE.md "Launch Plan Update" + "Findings Discipline" sections for write rules. -->

### Session Workflow Patterns (canonical, established 2026-04-27)

The patterns that emerged across this session's overnight Wave 7 work and proved reliable. Future sessions follow these unless the user explicitly overrides.

**1. Sub-agent dispatch for substantial implementation work.**
Implementation PRs over ~300 LOC use a `general-purpose` sub-agent with a tight brief (file list, scope boundaries, hard rules, deliverables format, "DO NOT commit/push/PR — leave staged"). The orchestrator then verifies the worktree, runs the pipeline locally, dispatches code-reviewer, applies fixes, commits, opens the PR. Saves main-context window for orchestration.

**2. Code-reviewer subagent ALWAYS before push.**
Use `superpowers:code-reviewer` on every diff before opening a PR. The code-reviewer's job is to catch P0/P1 issues the build sub-agent missed. Apply ALL P0+P1 fixes inline before push. This is non-negotiable; it caught 2 P0 bugs in P45 alone.

**3. Codex review loop with `@codex` ping → resolve threads → repeat.**
After PR opens: post `@codex` (just the mention, no narration). Wait 4-7 min. Read findings via `gh api graphql` reviewThreads query. Fix every finding (even P2/P3). Commit + push the fix. Resolve the thread via `resolveReviewThread` mutation. Re-ping `@codex`. Repeat until either (a) Codex posts "Didn't find any major issues. Hooray!" OR (b) Codex 👍 reaction on the latest ping with no new findings. Eyes-only reaction (👀) means processing — wait. P45 went 10 rounds before Codex was clean.

**4. Codex quota fallback to code-reviewer subagent (Gate 10).**
When Codex returns "You have reached your usage limits", fall back to `superpowers:code-reviewer` subagent. The subagent's APPROVED verdict + clean CI is sufficient to merge per overnight authorization. Document this fallback in the PR body and Completion Log row so the audit trail is preserved.

**5. Parallel audit agents for cross-cutting reviews.**
For wave-end audits (or any audit with multiple independent surfaces), dispatch 3-5 code-reviewer subagents IN PARALLEL via a single message with multiple Agent tool blocks. Each agent gets a focused brief covering one surface. Aggregate findings into a single consolidated report. This session ran 4 parallel agents and surfaced 59 findings in ~25 min vs hours sequentially.

**6. Deploy verification via Supabase MCP after each backend PR.**
After `db push` succeeds, run `mcp__plugin_supabase_supabase__execute_sql` to verify schema (column existence, RPC presence, CHECK constraints, index presence, GRANTs). Then `list_edge_functions` to confirm the deploy radius. Don't trust the CLI's "Finished supabase db push" alone — verify the resulting state. This caught zero defects this session but the discipline is cheap.

**7. Worktree-based isolation for every PR.**
Never commit on main. Every PR gets its own worktree under `.claude/worktrees/<descriptive-slug>/`. Branch from `origin/main` (always fetch fresh). Run pipeline + tests in the worktree, not main. This avoided every accidental-on-main concern this session.

**8. Tracker updates IN the fix PR (not after merge).**
CLAUDE.md status flip + Completion Log row + Findings Log entries are committed AS PART of the fix PR. The user's merge ratifies fix + tracker atomically. Use `#698` in the tracker until `gh pr create` returns the number, then `sed` + `git commit --amend --no-edit` + `git push --force-with-lease` to backfill the real number.

**9. Sleep between Codex polls — don't busy-poll.**
Use `ScheduleWakeup` with `delaySeconds: 240-300` between Codex review checks. Stay in cache (under 300s) for active windows; longer for idle waits. Never `sleep` in a loop in Bash — that wastes both context and prompt-cache hits.

**10. Stop on user-explicit halt; no exceptions.**
When user says "we stop" or equivalent, halt the autonomous loop. Don't merge open PRs even if code-reviewer approved. Don't kick off new work. Acknowledge state, summarize what's pending, end the cycle. The /loop wakeup may auto-fire after a stop — re-check user intent before resuming.

