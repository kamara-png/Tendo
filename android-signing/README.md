# Android release signing

`tendo-release.keystore` is the key every APK from this repository is signed
with. It is committed on purpose (like Budgeter's): GitHub Actions builds the
APK without any signing secrets, and a stable key means new releases install
over old ones instead of failing with a signature mismatch.

> **First time setup:** this file does not exist yet. Generate it once with
>
> ```
> node scripts/make-keystore.mjs
> ```
>
> then commit `tendo-release.keystore` and `keystore.properties`. EAS and CI
> release builds fail until both files are present — the signing plugin tells
> you exactly that if they are missing.

The key is **public**. Anyone with access to this repository can sign an APK
that Android will accept as an update to Tendo. That is acceptable for a
sideload-only app distributed from this repo's Releases page, which is how
Tendo is shipped — it is not published on Google Play. Treat the keystore as a
build artifact, not as a secret.

- Keystore: `tendo-release.keystore` (PKCS#12)
- Alias: `tendo`
- Passwords: see `keystore.properties`

**Back this file up.** If it is lost, every installed copy must be uninstalled
before it can be replaced, and all local data goes with it.

CI refuses to publish an APK that is unsigned or signed by any key other than
this one (`CN=Tendo`).
