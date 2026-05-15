const { withModelDependencyMeta } = require('../index');

jest.mock('@expo/config-plugins', () => ({
  AndroidConfig: {
    Manifest: {
      getMainApplicationOrThrow: (manifest) =>
        manifest.manifest.application[0],
    },
  },
  withAndroidManifest: (_config, action) =>
    action({
      modResults: {
        manifest: {
          $: {},
          application: [
            {
              'meta-data': [
                {
                  $: {
                    'android:name': 'com.google.mlkit.vision.DEPENDENCIES',
                    'android:value': 'barcode_ui',
                  },
                },
              ],
            },
          ],
        },
      },
    }),
  withAppBuildGradle: (config) => config,
  withMainApplication: (config) => config,
  withDangerousMod: (config) => config,
  withXcodeProject: (config) => config,
  withInfoPlist: (config) => config,
}));

describe('with-background-removal config plugin', () => {
  it('merges MLKit model dependencies with expo-camera and marks android:value replaceable', () => {
    const cfg = withModelDependencyMeta({});
    const manifest = cfg.modResults.manifest;
    const application = manifest.application[0];
    const metadata = application['meta-data'][0].$;

    expect(manifest.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
    expect(metadata['android:value']).toBe('barcode_ui,subject_segment');
    expect(metadata['tools:replace']).toBe('android:value');
  });
});
