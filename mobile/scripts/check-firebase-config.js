#!/usr/bin/env node
// Two-mode guard for `mobile/google-services.json`:
//
//   - Default (build-time): protects EAS Android PRODUCTION builds
//     from shipping the placeholder. Behaviour depends on context:
//       · EAS Android + production profile (EAS_BUILD_PLATFORM=android
//         + EAS_BUILD_PROFILE=production): HARD FAIL on placeholder —
//         shipping would silently break FCM push notifications.
//       · EAS Android + development/preview profile: WARN and proceed
//         (the placeholder is the documented dev-baseline; failing
//         internal builds would break the dev/preview loop).
//       · EAS iOS: skip (iOS doesn't consume google-services.json).
//       · No EAS context (local `npm run android`, dev sessions):
//         WARN and proceed.
//
//   - `--staged` (pre-commit hook): the staged content MUST still be
//     the placeholder. A `git add` of a swap-in-place real config
//     would leak project-scoped Firebase API keys to git history
//     despite the .gitignore rule (gitignore is a no-op for tracked
//     files). Reads the staged blob via `git show :mobile/...` and
//     rejects the commit if the marker is gone. `git commit
//     --no-verify` bypasses for intentional edits.
//
// Wired into:
//   - `package.json` `eas-build-pre-install` + `android` script —
//     default mode.
//   - repo-root `.husky/pre-commit` — `--staged` mode.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PLACEHOLDER_MARKER = 'PLACEHOLDER_REPLACE_BEFORE_PRODUCTION_BUILD';
const CONFIG_PATH = path.resolve(__dirname, '..', 'google-services.json');
const REPO_REL = 'mobile/google-services.json';

const isStagedMode = process.argv.includes('--staged');

if (isStagedMode) {
  // Pre-commit context. Reject:
  //   1. Staged content that no longer carries the placeholder marker
  //      (in-place edit with real credentials).
  //   2. Staged DELETION of the file — app.json's `googleServicesFile`
  //      points at it, so removing it breaks fresh checkouts and dev
  //      builds. `git rm --cached` followed by commit is the natural
  //      path here; untracking is fine (placeholder vanishes from
  //      future commits), removing the file entirely is not.
  // `git commit --no-verify` bypasses either check for deliberate
  // restructures (e.g. moving to EAS file secrets).
  let stagedStatus = '';
  try {
    stagedStatus = execFileSync(
      'git',
      ['diff', '--cached', '--name-status', '--', REPO_REL],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    // Not in a git working tree, or git unavailable — skip silently.
    process.exit(0);
  }
  if (!stagedStatus) {
    // File not staged → nothing to check.
    process.exit(0);
  }
  // Output format: "<status>\t<path>" — e.g. "M\tmobile/google-services.json"
  // or "D\tmobile/google-services.json".
  const statusChar = stagedStatus.charAt(0);
  if (statusChar === 'D') {
    console.error(
      `ERROR: ${REPO_REL} is staged for deletion, but app.json's ` +
        '`googleServicesFile` references it. Removing the committed ' +
        'placeholder would break fresh checkouts and EAS / dev Android ' +
        'builds (missing-file error during prebuild).\n' +
        '\n' +
        'If you genuinely mean to switch off the committed placeholder ' +
        '(e.g. moving entirely to EAS file secrets), drop the ' +
        '`googleServicesFile` reference from `app.json` in the same ' +
        'commit and use `git commit --no-verify` to bypass this hook.',
    );
    process.exit(1);
  }
  let stagedContent = '';
  try {
    stagedContent = execFileSync('git', ['show', `:${REPO_REL}`], {
      encoding: 'utf8',
    });
  } catch {
    // Defensive: A/M status but blob unreadable. Don't block on
    // ambiguous state; let git surface the real error.
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

// Production-build strictness only kicks in for the EAS Android
// PRODUCTION profile. The placeholder exists precisely so dev / preview
// builds don't need real Firebase credentials — hard-failing them
// would block fresh-checkout `npm run android`, `eas build -p android
// --profile development`, and `--profile preview`. Outside the
// production profile we emit a warning and proceed; the production
// EAS pre-install still fails the build if the swap step didn't
// happen. EAS sets `EAS_BUILD_PROFILE` to the profile name from
// `eas.json`; locally it's unset.
const isEasProduction =
  easPlatform === 'android' &&
  process.env.EAS_BUILD_PROFILE === 'production';

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
  if (!isEasProduction) {
    console.warn(
      `WARNING: ${CONFIG_PATH} contains the placeholder marker. FCM ` +
        'push notifications will not work in this build. This is the ' +
        'expected dev-baseline; swap in the real google-services.json ' +
        '(or use the EAS file-secret pipeline) before any production ' +
        'release.',
    );
    process.exit(0);
  }
  console.error(
    `ERROR: ${CONFIG_PATH} still contains the placeholder marker ` +
      `"${PLACEHOLDER_MARKER}". This is an EAS Android production ` +
      'build — shipping with the placeholder would mean broken FCM ' +
      '(push notifications silently fail). Swap in the real ' +
      'google-services.json from console.firebase.google.com (or wire ' +
      'the EAS file-secret) before building. If you genuinely need to ' +
      'push an EAS Android production build without FCM, set ' +
      'ALLOW_PLACEHOLDER_FIREBASE=1 in the build environment.',
  );
  if (process.env.ALLOW_PLACEHOLDER_FIREBASE !== '1') {
    process.exit(1);
  }
  console.error(
    'ALLOW_PLACEHOLDER_FIREBASE=1 — proceeding with placeholder. FCM will be broken.',
  );
}
