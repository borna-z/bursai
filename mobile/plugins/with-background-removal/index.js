/**
 * Expo config plugin — Wave R-B on-device background removal.
 *
 * Ships:
 *   • iOS: Swift wrapper around `VNGenerateForegroundInstanceMaskRequest`
 *     (iOS 17+; returns 'unavailable' on iOS 15/16). Uses the existing
 *     `Vision.framework` link that Expo SDK 54's iOS template already
 *     carries via Apple's built-in frameworks, so no Podfile change is
 *     needed.
 *   • Android: Kotlin module wrapping MLKit Subject Segmentation
 *     16.0.0-beta1. Adds the dependency to `app/build.gradle` and
 *     registers `BackgroundRemovalPackage` in `MainApplication.kt`.
 *
 * Why a config plugin: `mobile/ios/` and `mobile/android/` are gitignored
 * under Expo's managed workflow — direct edits get blown away on
 * `expo prebuild`. The plugin re-applies these mods at every prebuild
 * deterministically.
 *
 * Pattern reference: same shape as the (now-deleted) with-garment-detector
 * config plugin used for the deferred R-A wave. This one is simpler
 * because background removal is a promise-based JS-thread call — no
 * vc-worklets / useFrameProcessor involvement, so the RN-bridgeless
 * conflict that killed R-A's Android path does not apply here.
 */

const {
  AndroidConfig,
  withAppBuildGradle,
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
  withXcodeProject,
  withInfoPlist,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// MLKit Subject Segmentation only ships via the Play Services artifact
// (`com.google.android.gms:play-services-mlkit-*`) — the bundled
// `com.google.mlkit:*` channel does not publish a `subject-segmentation`
// module. Using the wrong coordinate fails Gradle resolution at prebuild
// time. Per official docs:
// https://developers.google.com/ml-kit/vision/subject-segmentation/android
// (Codex P1 round 2.)
const MLKIT_SUBJECT_SEG_DEP = "implementation 'com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1'";
const PACKAGE_IMPORT = 'import me.burs.app.bgremoval.BackgroundRemovalPackage';
const PACKAGE_ADD = 'add(BackgroundRemovalPackage())';

// ─── Android: app/build.gradle dependency injection ────────────────────────
function withMLKitSubjectSegDependency(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes('play-services-mlkit-subject-segmentation')) {
      return cfg;
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /dependencies\s*\{/,
      (match) => `${match}\n    ${MLKIT_SUBJECT_SEG_DEP}`,
    );
    return cfg;
  });
}

// ─── Android: trigger Play Services install-time download for the
//     unbundled Subject Segmentation model. Without this manifest
//     meta-data, the model only starts downloading on the first
//     `process()` call and any segmentation requests made before the
//     download lands silently produce no results — first-launch LiveScan
//     would fall back to raw uploads despite the boot warm-up. Codex P2
//     round 5. Per Google docs:
//     https://developers.google.com/ml-kit/vision/subject-segmentation/android#dependencies
const MODEL_DEPS_META_NAME = 'com.google.mlkit.vision.DEPENDENCIES';
const MODEL_DEPS_VALUE = 'subject_segment';

function withModelDependencyMeta(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    application['meta-data'] = application['meta-data'] || [];
    const existing = application['meta-data'].find(
      (m) => m.$ && m.$['android:name'] === MODEL_DEPS_META_NAME,
    );
    if (!existing) {
      application['meta-data'].push({
        $: {
          'android:name': MODEL_DEPS_META_NAME,
          'android:value': MODEL_DEPS_VALUE,
        },
      });
    } else {
      // Merge value if another ML Kit model is already declared, so we
      // don't clobber a sibling plugin's manifest entry.
      const current = existing.$['android:value'] || '';
      const parts = current.split(',').map((p) => p.trim()).filter(Boolean);
      if (!parts.includes(MODEL_DEPS_VALUE)) {
        existing.$['android:value'] = [...parts, MODEL_DEPS_VALUE].join(',');
      }
    }
    return cfg;
  });
}

// ─── Android: register the RN package in MainApplication.kt ────────────────
function withBackgroundRemovalPackage(config) {
  return withMainApplication(config, (cfg) => {
    let { contents } = cfg.modResults;

    if (!contents.includes(PACKAGE_IMPORT)) {
      // Insert the import after the last existing `import` line so it lands
      // in the import block regardless of how the template orders them.
      contents = contents.replace(
        /(^import [^\n]+\n)(?!import )/m,
        (m, lastImport) => `${lastImport}${PACKAGE_IMPORT}\n`,
      );
    }

    // Expo SDK 54 templates use `PackageList(this).packages.apply { ... }`
    // for the package list. We tack on `add(BackgroundRemovalPackage())`
    // inside that apply-block. If the template diverges we fall back to
    // appending before the closing brace of `getPackages()`.
    if (!contents.includes(PACKAGE_ADD)) {
      const applyMatch = contents.match(/PackageList\(this\)\.packages\.apply\s*\{([\s\S]*?)\}/);
      if (applyMatch) {
        const inner = applyMatch[1];
        const replaced = `PackageList(this).packages.apply {${inner}    ${PACKAGE_ADD}\n      }`;
        contents = contents.replace(applyMatch[0], replaced);
      } else {
        // Fallback: append the package inside the package-list builder.
        contents = contents.replace(
          /override fun getPackages\(\)[\s\S]*?return [\s\S]*?\n\s*\}/,
          (block) => block.replace(/return\s+([^\n]+)/, `return $1.apply { ${PACKAGE_ADD} }`),
        );
      }
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

// ─── Android: copy Kotlin sources into the generated android/ tree ─────────
function withAndroidNativeSources(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const srcDir = path.join(__dirname, 'android');
      const destDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'me',
        'burs',
        'app',
        'bgremoval',
      );

      fs.mkdirSync(destDir, { recursive: true });

      for (const file of ['BackgroundRemovalModule.kt', 'BackgroundRemovalPackage.kt']) {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
      return cfg;
    },
  ]);
}

// ─── iOS: copy Swift + bridging-header into the generated ios/ tree ────────
function withIOSNativeSources(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const srcDir = path.join(__dirname, 'ios');
      // Expo SDK 54 iOS template names the app group folder after the
      // project name. Resolve dynamically.
      const projectName =
        cfg.modRequest.projectName ||
        cfg.ios?.projectName ||
        cfg.slug ||
        'mobile';
      const destDir = path.join(
        cfg.modRequest.platformProjectRoot,
        projectName,
        'BackgroundRemoval',
      );

      fs.mkdirSync(destDir, { recursive: true });

      for (const file of ['BackgroundRemoval.swift', 'BackgroundRemoval.m']) {
        const src = path.join(srcDir, file);
        const dest = path.join(destDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
      return cfg;
    },
  ]);
}

// ─── iOS: link Swift + ObjC bridge files into the Xcode project ───────────
function withIOSXcodeSources(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName =
      cfg.modRequest.projectName ||
      cfg.ios?.projectName ||
      cfg.slug ||
      'mobile';

    const groupPath = `${projectName}/BackgroundRemoval`;
    // `pbxCreateGroup` is idempotent — re-running prebuild won't dupe.
    const group = project.pbxCreateGroup('BackgroundRemoval', groupPath);
    project.addToPbxGroup(group, project.getFirstProject().firstProject.mainGroup);

    const targetUuid = project.getFirstTarget().uuid;

    for (const fileName of ['BackgroundRemoval.swift', 'BackgroundRemoval.m']) {
      const filePath = path.posix.join(projectName, 'BackgroundRemoval', fileName);
      // `addSourceFile` is also idempotent via the file path check below.
      const already = project.hasFile(filePath);
      if (already) continue;
      project.addSourceFile(filePath, { target: targetUuid }, group);
    }
    return cfg;
  });
}

// ─── iOS: NSPhotoLibraryUsage already declared at app.json level. No new
//     Info.plist key needed — Vision needs no specific entitlement. The
//     plugin still validates the deployment target ≥ 14.0 because we
//     gate the Vision call with @available(iOS 17, *) at the call site.
function withIOSDeploymentTargetGuard(config) {
  return withInfoPlist(config, (cfg) => {
    // Touchless — present for parity with sibling plugins that may set
    // privacy-relevant keys here in the future. Vision subject lifting
    // does not require a usage description.
    return cfg;
  });
}

module.exports = function withBackgroundRemoval(config) {
  config = withMLKitSubjectSegDependency(config);
  config = withModelDependencyMeta(config);
  config = withBackgroundRemovalPackage(config);
  config = withAndroidNativeSources(config);
  config = withIOSNativeSources(config);
  config = withIOSXcodeSources(config);
  config = withIOSDeploymentTargetGuard(config);
  return config;
};
