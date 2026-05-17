#!/usr/bin/env bash
# Audit issue #12 — migration drift detection.
#
# Fails the run when the linked Supabase remote DB has schema NOT represented
# in `supabase/migrations/`. Complements the existing `db push --dry-run`
# check in the migration-smoke CI job (which only verifies the new migrations
# apply cleanly on top of remote).
#
# Required env:
#   SUPABASE_ACCESS_TOKEN  — admin PAT for the Supabase project
#   SUPABASE_DB_PASSWORD   — db password for the linked project
#
# Local usage (one-off check):
#   SUPABASE_ACCESS_TOKEN=... SUPABASE_DB_PASSWORD=... bash scripts/verify-migrations.sh
#
# CI usage: wired into `.github/workflows/mobile-ci.yml` migration-smoke job.

set -euo pipefail

# `supabase db diff --linked` prints a unified diff of remote-vs-migrations.
# Empty output = clean. Non-empty = drift.
#
# We capture stderr to a tempfile (not /dev/null) so CLI failures (auth,
# network, npx resolution) don't silently produce empty `diff_output` and
# masquerade as "no drift". `set +e` is required around the command so we
# can inspect its exit code explicitly; without that `set -e` would abort
# before the empty-vs-failure distinction.
#
# Auth: supabase CLI v2.x removed the `--password` flag from `db diff` —
# it now reads `SUPABASE_DB_PASSWORD` from env automatically when `--linked`
# is set. CLI v1.x accepted the flag; we drop it to stay compatible with
# both (the env var works for both versions).
stderr_file="$(mktemp)"
trap 'rm -f "$stderr_file"' EXIT

set +e
diff_output="$(npx supabase db diff --linked 2>"$stderr_file")"
diff_exit=$?
set -e

if [[ $diff_exit -ne 0 ]]; then
  echo "::error::supabase db diff failed (exit $diff_exit) — drift check could not run."
  echo "::group::stderr"
  cat "$stderr_file"
  echo "::endgroup::"
  exit "$diff_exit"
fi

# Trim whitespace so "  \n  " (which has length but no content) counts as empty.
trimmed="$(echo "$diff_output" | tr -d '[:space:]')"

if [[ -n "$trimmed" ]]; then
  echo "::error::Migration drift detected — remote schema differs from supabase/migrations/."
  echo "::group::Drift diff"
  echo "$diff_output"
  echo "::endgroup::"
  echo ""
  echo "Reproduce locally:"
  echo "  SUPABASE_DB_PASSWORD=... npx supabase db diff --linked"
  echo ""
  echo "Fix: either commit a new migration capturing the remote-side change,"
  echo "or revert the remote change so it matches migrations."
  exit 1
fi

echo "✓ No migration drift between remote DB and supabase/migrations/."
