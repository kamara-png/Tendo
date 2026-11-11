const fs = require("node:fs");
const path = require("node:path");
const { withAppBuildGradle, withDangerousMod } = require("expo/config-plugins");

const KEYSTORE_FILE = "tendo-release.keystore";
const PROPERTIES_FILE = "keystore.properties";
const SIGNING_DIR = "android-signing";

/** Copies the committed keystore + properties next to `app/build.gradle`. */
function withSigningFiles(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const appDir = path.join(config.modRequest.platformProjectRoot, "app");

      for (const file of [KEYSTORE_FILE, PROPERTIES_FILE]) {
        const source = path.join(projectRoot, SIGNING_DIR, file);
        if (!fs.existsSync(source)) {
          throw new Error(
            `Missing ${path.join(SIGNING_DIR, file)}. Release builds must be ` +
              "signed with the committed Tendo key. Create it with " +
              "`node scripts/make-keystore.mjs` (see android-signing/README.md).",
          );
        }
        fs.copyFileSync(source, path.join(appDir, file));
      }

      return config;
    },
  ]);
}

/**
 * Wires the copied keystore into `android/app/build.gradle`:
 * - adds a `release` signing config that reads the passwords from
 *   `keystore.properties`,
 * - points the `release` build type at it instead of the debug key.
 *
 * Android rejects unsigned release APKs ("package appears to be invalid"), and
 * debug keys are not stable across machines, so this is not optional.
 */
function withSigningGradle(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("withReleaseSigning expects a Groovy build.gradle");
    }

    let contents = config.modResults.contents;

    if (!contents.includes("tendoKeystoreProperties")) {
      contents = contents.replace(
        'apply plugin: "com.facebook.react"\n',
        'apply plugin: "com.facebook.react"\n\n' +
          "def tendoKeystoreProperties = new Properties()\n" +
          "tendoKeystoreProperties.load(new FileInputStream(file('" +
          PROPERTIES_FILE +
          "')))\n",
      );
    }

    if (!contents.includes("signingConfigs.release")) {
      contents = contents.replace(
        "    signingConfigs {\n        debug {",
        "    signingConfigs {\n" +
          "        release {\n" +
          "            storeFile file('" +
          KEYSTORE_FILE +
          "')\n" +
          "            storePassword tendoKeystoreProperties['storePassword']\n" +
          "            keyAlias tendoKeystoreProperties['keyAlias']\n" +
          "            keyPassword tendoKeystoreProperties['keyPassword']\n" +
          "        }\n" +
          "        debug {",
      );
    }

    contents = contents.replace(
      "        release {\n" +
        "            // Caution! In production, you need to generate your own keystore file.\n" +
        "            // see https://reactnative.dev/docs/signed-apk-android.\n" +
        "            signingConfig signingConfigs.debug",
      "        release {\n            signingConfig signingConfigs.release",
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withReleaseSigning(config) {
  return withSigningGradle(withSigningFiles(config));
};
