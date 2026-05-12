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

// Nitrogen autolinking: pulls the generated Kotlin sources
// (HybridGarmentDetectorSpec, DetectedBox, BursGarmentDetectorOnLoad) into
// the :app sourceSet AND wires the BursGarmentDetector C++ shared library
// build so `System.loadLibrary("BursGarmentDetector")` resolves at runtime.
//
// We inline the equivalent of `BursGarmentDetector+autolinking.gradle` here
// because that file resolves its srcDir against
// `${project.projectDir}/../nitrogen/...` which, when applied from :app,
// lands at `android/nitrogen/...` (wrong — nitrogen lives at
// `mobile/nitrogen/`). Pointing at `rootProject.projectDir/../nitrogen/...`
// is the right anchor.
//
// The externalNativeBuild config points at `../CMakeLists.txt` so the file
// lives at `android/CMakeLists.txt` rather than `android/app/CMakeLists.txt`;
// this matters because the nitrogen-generated autolinking.cmake's
// `../nitrogen/...` paths only resolve to `mobile/nitrogen/` when the
// CMakeLists.txt sits at `android/` (one level above `:app`).
const NITROGEN_APPLY_BLOCK = `
// Wave R-A: nitrogen-generated GarmentDetector sources + native build wiring
android {
    sourceSets {
        main {
            java.srcDirs += [
                "\${rootProject.projectDir}/../nitrogen/generated/android/kotlin"
            ]
        }
    }
    defaultConfig {
        externalNativeBuild {
            cmake {
                cppFlags "-frtti -fexceptions -Wall -Wextra"
                arguments "-DANDROID_STL=c++_shared"
            }
        }
    }
    externalNativeBuild {
        cmake {
            path "../CMakeLists.txt"
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

// Kotlin sources under `plugins/with-garment-detector/android/` are organised
// in package-mirrored subdirs (`com/margelo/nitro/burs/...` for the Nitro
// hybrid — its package is dictated by the JNI descriptor in the nitrogen-
// generated `BursGarmentDetectorOnLoad.cpp` — and `me/burs/app/livescan/...`
// for the placeholder ReactPackage). We mirror that tree verbatim into the
// app's `src/main/java/` root, preserving every `.kt` file's package path.
//
// CMakeLists.txt + placeholder.cpp are copied to `android/` (one level
// above `:app`) so the nitrogen autolinking.cmake's `../nitrogen/...` paths
// resolve correctly — see the NITROGEN_APPLY_BLOCK comment above.
function withKotlinSourceCopy(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const src = path.join(root, 'plugins', 'with-garment-detector', 'android');
      const destJavaRoot = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java',
      );
      if (!fs.existsSync(src)) return cfg;
      copyKotlinTree(src, destJavaRoot);

      // Native-build files: CMakeLists.txt + placeholder.cpp land at
      // `android/CMakeLists.txt` and `android/placeholder.cpp`. The
      // externalNativeBuild block injected by `withMlkitGradleDep` references
      // these via `path "../CMakeLists.txt"` from `:app/build.gradle`.
      for (const name of ['CMakeLists.txt', 'placeholder.cpp']) {
        const srcFile = path.join(src, name);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(
            srcFile,
            path.join(cfg.modRequest.platformProjectRoot, name),
          );
        }
      }
      return cfg;
    },
  ]);
}

function copyKotlinTree(srcDir, destRoot) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      // Recurse with the same destRoot so package subdirs accumulate under it.
      const nestedDest = path.join(destRoot, entry.name);
      fs.mkdirSync(nestedDest, { recursive: true });
      copyKotlinSubtree(srcPath, nestedDest);
    }
    // Top-level non-.kt files (e.g. `.gitkeep`) are intentionally skipped.
  }
}

function copyKotlinSubtree(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyKotlinSubtree(srcPath, destPath);
    } else if (entry.name.endsWith('.kt')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = function withGarmentDetector(config) {
  config = withMlkitGradleDep(config);
  config = withGarmentDetectorPackageRegistration(config);
  config = withKotlinSourceCopy(config);
  return config;
};
