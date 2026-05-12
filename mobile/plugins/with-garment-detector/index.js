const {
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Wave R-A garment detector dependencies. CameraX version must track
// react-native-vision-camera's pin (see node_modules/.../android/build.gradle).
const APP_DEPS = [
  `    // Wave R-A garment detector`,
  `    implementation 'com.google.mlkit:object-detection:17.0.1'`,
  // ImageProxy + @ExperimentalGetImage live in camera-core. vision-camera
  // already pulls camera-core in, but as 'implementation' — invisible to
  // :app — so we need a direct dep here for the Kotlin Nitro module.
  `    implementation 'androidx.camera:camera-core:1.7.0-alpha01'`,
];
const APP_DEPS_MARKER = 'com.google.mlkit:object-detection';

// Nitrogen autolinking: pulls the generated Kotlin sources (HybridGarmentDetectorSpec,
// DetectedBox, BursGarmentDetectorOnLoad) into the :app sourceSet. We inline the
// equivalent of `BursGarmentDetector+autolinking.gradle` here because that file
// resolves its srcDir against `${project.projectDir}/../nitrogen/...` which, when
// applied from :app, lands at `android/nitrogen/...` (wrong — nitrogen lives at
// `mobile/nitrogen/`). Pointing at `rootProject.projectDir/../nitrogen/...` is
// the right anchor.
const NITROGEN_APPLY_BLOCK = `
// Wave R-A: register nitrogen-generated Kotlin sources for GarmentDetector
android {
    sourceSets {
        main {
            java.srcDirs += [
                "\${rootProject.projectDir}/../nitrogen/generated/android/kotlin"
            ]
        }
    }
}
`;
const NITROGEN_APPLY_MARKER = 'nitrogen/generated/android/kotlin';

function withMlkitGradleDep(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(APP_DEPS_MARKER)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n${APP_DEPS.join('\n')}`,
      );
    }
    if (!cfg.modResults.contents.includes(NITROGEN_APPLY_MARKER)) {
      cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${NITROGEN_APPLY_BLOCK}`;
    }
    return cfg;
  });
}

function withGarmentDetectorPackageRegistration(config) {
  return withMainApplication(config, (cfg) => {
    const importLine = 'import me.burs.app.livescan.GarmentDetectorPackage';
    if (cfg.modResults.contents.includes('GarmentDetectorPackage')) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^(package .+\n)/m,
      `$1\n${importLine}\n`,
    );
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /(PackageList\(this\)\.packages)/,
      `$1.toMutableList().apply { add(GarmentDetectorPackage()) }`,
    );
    return cfg;
  });
}

function withKotlinSourceCopy(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const src = path.join(root, 'plugins', 'with-garment-detector', 'android');
      const destBase = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java', 'me', 'burs', 'app', 'livescan',
      );
      fs.mkdirSync(destBase, { recursive: true });
      if (!fs.existsSync(src)) return cfg;
      for (const file of fs.readdirSync(src)) {
        if (file.endsWith('.kt')) {
          fs.copyFileSync(
            path.join(src, file),
            path.join(destBase, file),
          );
        }
      }
      return cfg;
    },
  ]);
}

module.exports = function withGarmentDetector(config) {
  config = withMlkitGradleDep(config);
  config = withGarmentDetectorPackageRegistration(config);
  config = withKotlinSourceCopy(config);
  return config;
};
