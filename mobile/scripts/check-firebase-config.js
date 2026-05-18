#!/usr/bin/env node
// Build-time guard against shipping the committed placeholder
// `google-services.json`. Codex P1 on PR #885: EAS / prebuild packages
// the file unconditionally, so an Android build that skipped the swap
// step would produce an app with broken FCM and no warning until users
// notice push notifications never arrive. This script fails loudly
// instead.
//
// Wired into `mobile/package.json` via the `eas-build-pre-install` hook
// (EAS auto-runs that script before installing deps) and prepended to
// the local `android` script. EAS sets `EAS_BUILD_PLATFORM` to `android`
// or `ios`; iOS builds don't consume google-services.json (Codex P1
// round 2 on PR #885), so we skip the check there.

const fs = require('fs');
const path = require('path');

const easPlatform = process.env.EAS_BUILD_PLATFORM;
if (easPlatform && easPlatform !== 'android') {
  // iOS EAS build — google-services.json is irrelevant, skip the check
  // so a clean iOS build doesn't fail on the Android placeholder.
  process.exit(0);
}

const PLACEHOLDER_MARKER = 'PLACEHOLDER_REPLACE_BEFORE_PRODUCTION_BUILD';
const CONFIG_PATH = path.resolve(__dirname, '..', 'google-services.json');

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
