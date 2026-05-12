const {
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MLKIT_DEP_LINE =
  `    implementation 'com.google.mlkit:object-detection:17.0.1'`;
const MLKIT_DEP_MARKER = 'com.google.mlkit:object-detection';

function withMlkitGradleDep(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MLKIT_DEP_MARKER)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /dependencies\s*\{/,
      (match) => `${match}\n${MLKIT_DEP_LINE}\n    // ^ Wave R-A garment detector`,
    );
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
