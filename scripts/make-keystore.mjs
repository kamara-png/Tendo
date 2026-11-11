#!/usr/bin/env node
// Creates the release keystore for this repository in android-signing/.
// Requires the Java `keytool` (ships with any JDK, including the one Expo/Gradle
// already uses).
//
//   node scripts/make-keystore.mjs [--password <pass>]
//
// Without --password a strong random password is generated and printed once.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SIGNING_DIR = "android-signing";
const KEYSTORE = `${SIGNING_DIR}/tendo-release.keystore`;
const PROPERTIES = `${SIGNING_DIR}/keystore.properties`;
const ALIAS = "tendo";

const passwordIndex = process.argv.indexOf("--password");
const password =
  passwordIndex > -1 && process.argv[passwordIndex + 1]
    ? process.argv[passwordIndex + 1]
    : randomBytes(18).toString("base64url");

if (existsSync(KEYSTORE)) {
  console.error(`✖ ${KEYSTORE} already exists. Delete it first to make a new key.`);
  process.exit(1);
}

mkdirSync(SIGNING_DIR, { recursive: true });

try {
  execFileSync(
    "keytool",
    [
      "-genkeypair",
      "-v",
      "-keystore", KEYSTORE,
      "-storetype", "PKCS12",
      "-alias", ALIAS,
      "-keyalg", "RSA",
      "-keysize", "2048",
      "-validity", "10000",
      "-storepass", password,
      "-keypass", password,
      "-dname", "CN=Tendo",
    ],
    { stdio: "inherit" },
  );
} catch {
  console.error(
    "✖ keytool failed. Install a JDK (it is the same one Gradle needs) and retry.",
  );
  process.exit(1);
}

writeFileSync(
  path.join(SIGNING_DIR, "keystore.properties"),
  `storePassword=${password}\nkeyAlias=${ALIAS}\nkeyPassword=${password}\n`,
);

console.log(
  `✔ Created ${KEYSTORE} and ${PROPERTIES} (alias ${ALIAS}).\n\n` +
    `Password: ${password}\n` +
    "It is also stored in keystore.properties. Back both files up — if the\n" +
    "keystore is lost, installed copies must be uninstalled before updating.",
);
