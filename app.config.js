const withArchitectures = require("./plugins/with-architectures");

const ALL_ABIS = "arm64-v8a,armeabi-v7a,x86,x86_64";
const APP_BUNDLE_ABIS = "arm64-v8a,armeabi-v7a";
const APK_ABIS = "arm64-v8a";

/** Map an EAS build profile to the ABIs that build should compile. */
function architecturesForProfile(profile) {
  if (!profile || profile === "development") return ALL_ABIS;
  if (profile === "production-bundle") return APP_BUNDLE_ABIS;
  return APK_ABIS;
}

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      withArchitectures,
      { architectures: architecturesForProfile(process.env.EAS_BUILD_PROFILE) },
    ],
  ],
});
