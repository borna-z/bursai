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
# We pipe stderr to /dev/null because the CLI emits informational lines like
# `Connecting to remote database...` that we don't want polluting the
# drift signal. Real failures (auth, network) will surface via the non-zero
# exit code from `set -e`.
diff_output="$(npx supabase db diff --linked --password "${SUPABASE_DB_PASSWORD:-}" 2>/dev/null || true)"

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
