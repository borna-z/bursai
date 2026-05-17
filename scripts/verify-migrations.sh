#!/usr/bin/env bash
# Audit issue #12 — migration drift detection.
#
# Fails the run when the linked Supabase remote DB has schema NOT represented
# in `supabase/migrations/`. Complements the existing `db push --dry-run`
# check in the migration-smoke CI job (which only verifies the new migrations
# apply cleanly on top of remote).
#
# CLI: uses the `supabase` binary on PATH. In CI it's provided by
# `supabase/setup-cli@v1` (pinned to v1.226.4 in mobile-ci.yml). Locally,
# install the CLI globally (`npm i -g supabase` or `brew install supabase`).
# Earlier revisions used `npx supabase` which resolves a different CLI
# version from npm registry — Codex round-3 P2 on PR #884 flagged the
# mismatch as a fragility source (different CLI versions = different flag
# semantics, possible npm auth/network failures).
#
# Required env:
#   SUPABASE_ACCESS_TOKEN  — admin PAT for the Supabase project
#   SUPABASE_DB_PASSWORD   — db password for the linked project
#
# Advisory mode:
#   MIGRATIONS_DRIFT_ADVISORY=1  — log drift but exit 0. Used in CI until
#   the launch-window pre-existing drift (extensions/functions added via
#   Supabase Studio, never captured in migrations) is repaired via a
#   backfill migration (`supabase db pull` + idempotency review per
#   CLAUDE.md migration discipline). Strict (default) is the post-launch
#   target.
#
# Local usage (one-off check):
#   SUPABASE_ACCESS_TOKEN=... SUPABASE_DB_PASSWORD=... bash scripts/verify-migrations.sh
#
# CI usage: wired into `.github/workflows/mobile-ci.yml` migration-smoke job.

set -euo pipefail

# `supabase db diff --linked` prints a unified diff of remote-vs-migrations.
# Empty output = clean. Non-empty = drift.
#
# Stderr → tempfile so CLI failures (auth, network) don't silently produce
# empty `diff_output` and masquerade as "no drift". `set +e` around the call
# so we can inspect exit code explicitly.
#
# Auth: `--linked` reads SUPABASE_DB_PASSWORD from env automatically (v1.x
# also accepts `--password` but the env-var path works for both v1 and v2).
stderr_file="$(mktemp)"
trap 'rm -f "$stderr_file"' EXIT

set +e
diff_output="$(supabase db diff --linked 2>"$stderr_file")"
diff_exit=$?
set -e

if [[ $diff_exit -ne 0 ]]; then
  echo "::error::supabase db diff failed (exit $diff_exit) — drift check could not run."
  echo "::group::stderr"
  cat "$stderr_file"
  echo "::endgroup::"
  exit "$diff_exit"
fi

# Distinguish "clean diff" (informational stdout) from "real drift" (SQL DDL).
# `supabase db diff --linked` writes status messages like "No schema changes
# found" to stdout on clean state — Codex round-7 P2 (PR #884) flagged that
# treating any non-whitespace as drift would create false drift positives
# once advisory mode is removed.
#
# Real drift always emits SQL: lines starting with CREATE/DROP/ALTER/SET/
# COMMENT/REVOKE/GRANT, or SQL comments (`--`), or block punctuation
# (`(`, `)`, `;`). Anything else is informational. We keep only SQL-looking
# lines and check if THOSE are non-empty.
sql_lines="$(echo "$diff_output" | grep -E '^[[:space:]]*(create|drop|alter|set|comment|revoke|grant|insert|update|delete|begin|commit|with|select|--|\(|\)|;)' -i || true)"
trimmed="$(echo "$sql_lines" | tr -d '[:space:]')"

if [[ -n "$trimmed" ]]; then
  if [[ "${MIGRATIONS_DRIFT_ADVISORY:-0}" == "1" ]]; then
    echo "::warning::Migration drift detected (advisory — not failing). See drift dump below."
  else
    echo "::error::Migration drift detected — remote schema differs from supabase/migrations/."
  fi
  echo "::group::Drift diff"
  echo "$diff_output"
  echo "::endgroup::"
  echo ""
  echo "Reproduce locally:"
  echo "  SUPABASE_DB_PASSWORD=... supabase db diff --linked"
  echo ""
  echo "Fix: capture the remote-side change with a backfill migration"
  echo "(supabase db pull → review → commit), or revert the remote change."
  if [[ "${MIGRATIONS_DRIFT_ADVISORY:-0}" == "1" ]]; then
    echo ""
    echo "Advisory mode — exiting 0. Remove MIGRATIONS_DRIFT_ADVISORY=1 once drift is captured."
    exit 0
  fi
  exit 1
fi

echo "✓ No migration drift between remote DB and supabase/migrations/."
