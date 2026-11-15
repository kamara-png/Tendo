const { withGradleProperties } = require("expo/config-plugins");

/**
 * Gradle's memory comes from React Native's template defaults:
 * `-Xmx2048m -XX:MaxMetaspaceSize=512m`.
 *
 * The Tendo release build (new architecture, expo autolinking, R8 minify)
 * blows past the 512m Metaspace cap: the daemon OOMs
 * (`java.lang.OutOfMemoryError: Metaspace`), Gradle discards and restarts it,
 * and the build crawls until the CI job is killed. CI runners have 16 GiB of
 * RAM, so the fix is to size the daemon JVM properly — heap for the Kotlin
 * compile phase, Metaspace headroom for class loading through the whole build.
 */
const JVM_ARGS = "-Xmx4096m -XX:MaxMetaspaceSize=3072m";

function withGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    const existing = props.find(
      (prop) => prop.type === "property" && prop.key === "org.gradle.jvmargs",
    );
    if (existing) {
      existing.value = JVM_ARGS;
    } else {
      props.push({ type: "property", key: "org.gradle.jvmargs", value: JVM_ARGS });
    }
    return config;
  });
}

module.exports = withGradleMemory;
