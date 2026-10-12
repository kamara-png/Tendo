const { withGradleProperties } = require("@expo/config-plugins");

const ARCHITECTURES_KEY = "reactNativeArchitectures";

/**
 * Writes `reactNativeArchitectures` into android/gradle.properties so a build
 * only compiles the ABIs it actually ships. Dropping the unused ABIs removes a
 * large share of the native libraries from the APK.
 */
const withArchitectures = (config, { architectures } = {}) => {
  const value = typeof architectures === "string" ? architectures.trim() : "";
  if (!value) return config;

  return withGradleProperties(config, (gradleConfig) => {
    const existing = gradleConfig.modResults.find(
      (item) => item.type === "property" && item.key === ARCHITECTURES_KEY,
    );
    if (existing) {
      existing.value = value;
    } else {
      gradleConfig.modResults.push({
        type: "property",
        key: ARCHITECTURES_KEY,
        value,
      });
    }
    return gradleConfig;
  });
};

module.exports = withArchitectures;
