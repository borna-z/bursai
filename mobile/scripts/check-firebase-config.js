#!/usr/bin/env node
// Two-mode guard for `mobile/google-services.json`. The two modes have
// opposite expectations of the file's content:
//
//   - Default (build-time, EAS / local `android` script): the on-disk
//     file must be the REAL config — the placeholder marker MUST be
//     absent. The swap step has to happen before any production build,
//     otherwise Android ships with broken FCM (push notifications
//     silently fail). Fails when the marker is still present.
//
//   - `--staged` mode (pre-commit hook): the STAGED content must be
//     the placeholder — the marker MUST be present. A `git add` of a
//     swap-in-place real config would leak project-scoped Firebase
//     API keys to git history despite the .gitignore rule (gitignore
//     is a no-op for tracked files). Reads the staged blob via
//     `git show :mobile/google-services.json` and rejects the commit
//     if the marker is gone. `git commit --no-verify` bypasses for
//     intentional edits.
//
// Wired into:
//   - `package.json` `eas-build-pre-install` + `android` script —
//     default (build-time) mode.
//   - repo-root `.husky/pre-commit` — `--staged` mode.
//
// EAS sets `EAS_BUILD_PLATFORM` to `android` or `ios`; iOS builds
// don't consume google-services.json (Codex P1 PR #885 round 2), so
// the build-time mode skips iOS. The pre-commit mode runs regardless
// of platform — credential leaks are platform-agnostic.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PLACEHOLDER_MARKER = 'PLACEHOLDER_REPLACE_BEFORE_PRODUCTION_BUILD';
const CONFIG_PATH = path.resolve(__dirname, '..', 'google-services.json');
const REPO_REL = 'mobile/google-services.json';

const isStagedMode = process.argv.includes('--staged');

if (isStagedMode) {
  // Pre-commit context. Check whether the staged blob still carries
  // the placeholder marker — if it doesn't, the dev edited the
  // committed file in place with real credentials and is about to
  // publish them. Reject the commit. Bypass with `git commit
  // --no-verify` if you genuinely mean to commit the change.
  let stagedFiles = '';
  try {
    stagedFiles = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--', REPO_REL],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    // Not in a git working tree, or git unavailable — skip silently.
    process.exit(0);
  }
  if (!stagedFiles) {
    // File not staged → nothing to check.
    process.exit(0);
  }
  let stagedContent = '';
  try {
    stagedContent = execFileSync('git', ['show', `:${REPO_REL}`], {
      encoding: 'utf8',
    });
  } catch {
    // Staged blob unreadable (deletion in the index) — let git
    // report the regular delete; not our concern.
    process.exit(0);
  }
  if (!stagedContent.includes(PLACEHOLDER_MARKER)) {
    console.error(
      `ERROR: ${REPO_REL} is staged with content that no longer ` +
        `contains the placeholder marker "${PLACEHOLDER_MARKER}". ` +
        'This looks like real Firebase credentials being committed in ' +
        'place of the placeholder, which would leak project-scoped API ' +
        'keys to git history.\n' +
        '\n' +
        'If you mean to ship the real config to production, use the EAS ' +
        'file-secret pipeline (or untrack the placeholder first via ' +
        '`git rm --cached mobile/google-services.json`) instead of ' +
        'committing the production file to git. If this is a deliberate ' +
        'placeholder edit, re-stage with `git commit --no-verify`.',
    );
    process.exit(1);
  }
  process.exit(0);
}

// Build-time mode.
const easPlatform = process.env.EAS_BUILD_PLATFORM;
if (easPlatform && easPlatform !== 'android') {
  // iOS EAS build — google-services.json is irrelevant, skip the check
  // so a clean iOS build doesn't fail on the Android placeholder.
  process.exit(0);
}

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(
    `ERROR: ${CONFIG_PATH} is missing. EAS / prebuild needs this file; ` +
      'download it from console.firebase.google.com → Project Settings → ' +
      'Android app (me.burs.app).',
  );
  process.exit(1);
}

const contents = fs.readFileSync(CONFIG_PATH, 'utf8');
if (contents.includes(PLACEHOLDER_MARKER)) {
  console.error(
    `ERROR: ${CONFIG_PATH} still contains the placeholder marker ` +
      `"${PLACEHOLDER_MARKER}". An Android build with this file will ship ` +
      'with broken FCM (push notifications will silently fail). Swap in the ' +
      'real google-services.json from console.firebase.google.com before ' +
      'building. If you genuinely need to build locally without FCM, set ' +
      'ALLOW_PLACEHOLDER_FIREBASE=1 in the environment.',
  );
  if (process.env.ALLOW_PLACEHOLDER_FIREBASE !== '1') {
    process.exit(1);
  }
  console.error(
    'ALLOW_PLACEHOLDER_FIREBASE=1 — proceeding with placeholder. FCM will be broken.',
  );
}
