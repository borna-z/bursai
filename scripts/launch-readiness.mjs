#!/usr/bin/env node
// launch-readiness: run every CHECKABLE local launch gate and print PASS/FAIL.
//
// Usage:
//   node scripts/launch-readiness.mjs            # run all gates
//   node scripts/launch-readiness.mjs --json     # machine-readable output
//   node scripts/launch-readiness.mjs --skip=expo-doctor,migration-drift
//
// Exits non-zero on any FAIL. Designed to be the human-runnable mirror of the
// mobile-ci.yml workflow, useful before merging launch-blocking PRs and on
// launch day before flipping the kill switch.
//
// Each gate is a {name, command, cwd, optional} record. Gates run sequentially
// to keep stdout interleaving sane. Optional gates that fail because the tool
// isn't installed surface as SKIP rather than FAIL.
//
// Gates checked locally:
//   - mobile typecheck (npx tsc --noEmit --skipLibCheck)
//   - mobile lint    (npx eslint "src/**/*.{ts,tsx}" --max-warnings 0)
//   - mobile tests   (npm test -- --ci)
//   - expo-doctor    (npx expo-doctor)
//   - i18n diff      (node scripts/i18n-diff.mjs)
//   - migration drift (npx supabase db diff, optional — needs supabase CLI)
//
// Gates NOT checked here (must be verified by humans against the checklist):
//   - App Store Connect submission completeness
//   - vault.secrets contents
//   - cron job error rates last 24h
//   - DNS / SMTP DKIM/SPF/DMARC
//   - RC sandbox flow

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MOBILE = resolve(ROOT, 'mobile');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const skipArg = args.find((a) => a.startsWith('--skip='));
const skipped = new Set((skipArg ? skipArg.slice('--skip='.length) : '').split(',').filter(Boolean));

const isWindows = process.platform === 'win32';

/**
 * @typedef {Object} Gate
 * @property {string} name
 * @property {string} description
 * @property {string} command
 * @property {string[]} args
 * @property {string} cwd
 * @property {boolean} [optional]  // tool may not be installed; FAIL becomes SKIP
 * @property {string} [missingHint] // shown when optional skipped
 */

/** @type {Gate[]} */
const gates = [
  {
    name: 'typecheck',
    description: 'mobile TypeScript compile (tsc --noEmit)',
    command: 'npx',
    args: ['--no-install', 'tsc', '--noEmit', '--skipLibCheck'],
    cwd: MOBILE,
  },
  {
    name: 'lint',
    description: 'mobile ESLint at --max-warnings 0',
    command: 'npx',
    args: ['--no-install', 'eslint', 'src/**/*.{ts,tsx}', '--max-warnings', '0'],
    cwd: MOBILE,
  },
  {
    name: 'jest',
    description: 'mobile Jest unit + integration tests',
    command: 'npm',
    args: ['test', '--', '--ci'],
    cwd: MOBILE,
  },
  {
    name: 'expo-doctor',
    description: 'Expo SDK / dependency sanity',
    command: 'npx',
    args: ['--no-install', 'expo-doctor'],
    cwd: MOBILE,
  },
  {
    name: 'i18n-diff',
    description: 'sv locale parity vs en (mobile/src/i18n/locales)',
    command: 'node',
    args: ['scripts/i18n-diff.mjs'],
    cwd: ROOT,
  },
  {
    name: 'migration-drift',
    description: 'supabase db diff vs linked project (optional)',
    command: 'npx',
    args: ['--no-install', 'supabase', 'db', 'diff', '--linked'],
    cwd: ROOT,
    optional: true,
    missingHint: 'supabase CLI not installed or not linked — run `npx supabase link --project-ref khvkwojtlkcvxjxztduj` to enable',
  },
];

/**
 * @param {Gate} gate
 * @returns {{status: 'PASS'|'FAIL'|'SKIP', durationMs: number, exitCode: number|null, reason?: string}}
 */
function runGate(gate) {
  if (skipped.has(gate.name)) {
    return { status: 'SKIP', durationMs: 0, exitCode: null, reason: 'skipped via --skip' };
  }
  if (!existsSync(gate.cwd)) {
    return { status: 'SKIP', durationMs: 0, exitCode: null, reason: `cwd missing: ${gate.cwd}` };
  }

  const started = Date.now();
  // shell: true so npx/npm.cmd resolve correctly on Windows where Node otherwise
  // refuses to spawn .cmd shims directly. The tradeoff is we lose precise
  // arg-quoting, so glob args (eslint "src/**/*.{ts,tsx}") need to round-trip
  // verbatim — we wrap them in double quotes below.
  const quoted = gate.args.map((a) => (/[\s*{}]/.test(a) ? `"${a}"` : a));
  const cmdline = isWindows
    ? `${gate.command} ${quoted.join(' ')}`
    : `${gate.command} ${quoted.join(' ')}`;

  const result = spawnSync(cmdline, {
    cwd: gate.cwd,
    stdio: jsonOutput ? 'pipe' : 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: jsonOutput ? '0' : '1' },
  });
  const durationMs = Date.now() - started;

  if (result.error && /ENOENT|not found|not recognized/i.test(String(result.error))) {
    if (gate.optional) {
      return { status: 'SKIP', durationMs, exitCode: null, reason: gate.missingHint ?? 'tool not installed' };
    }
    return { status: 'FAIL', durationMs, exitCode: null, reason: String(result.error) };
  }

  if (result.status === 0) {
    return { status: 'PASS', durationMs, exitCode: 0 };
  }

  if (gate.optional) {
    return {
      status: 'SKIP',
      durationMs,
      exitCode: result.status,
      reason: gate.missingHint ?? `optional gate exited ${result.status}`,
    };
  }

  return { status: 'FAIL', durationMs, exitCode: result.status, reason: `exit ${result.status}` };
}

function main() {
  /** @type {Array<{gate: Gate, result: ReturnType<typeof runGate>}>} */
  const results = [];

  if (!jsonOutput) {
    process.stdout.write(`\nlaunch-readiness — ${gates.length} gates\n`);
    process.stdout.write(`root: ${ROOT}\n\n`);
  }

  for (const gate of gates) {
    if (!jsonOutput) {
      process.stdout.write(`▶ ${gate.name} — ${gate.description}\n`);
    }
    const result = runGate(gate);
    results.push({ gate, result });
    if (!jsonOutput) {
      const tag = result.status === 'PASS' ? 'PASS' : result.status === 'SKIP' ? 'SKIP' : 'FAIL';
      const reason = result.reason ? ` (${result.reason})` : '';
      process.stdout.write(`  ${tag} — ${result.durationMs}ms${reason}\n\n`);
    }
  }

  const failed = results.filter((r) => r.result.status === 'FAIL');
  const skipped = results.filter((r) => r.result.status === 'SKIP');
  const passed = results.filter((r) => r.result.status === 'PASS');

  if (jsonOutput) {
    process.stdout.write(
      JSON.stringify(
        {
          summary: {
            passed: passed.length,
            failed: failed.length,
            skipped: skipped.length,
            total: results.length,
          },
          results: results.map(({ gate, result }) => ({
            name: gate.name,
            description: gate.description,
            status: result.status,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            reason: result.reason ?? null,
          })),
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    process.stdout.write('─── summary ───\n');
    process.stdout.write(`  PASS: ${passed.length}\n`);
    process.stdout.write(`  SKIP: ${skipped.length}\n`);
    process.stdout.write(`  FAIL: ${failed.length}\n`);
    if (failed.length > 0) {
      process.stdout.write('\nfailed gates:\n');
      for (const { gate, result } of failed) {
        process.stdout.write(`  - ${gate.name}: ${result.reason ?? 'exit ' + result.exitCode}\n`);
      }
    }
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main();
