# Upgrade Path Comparison: Expo 55 vs RN/Gradle/Android Studio

**Context:** You're on Expo 54, React 19.1, RN 0.81.4, Gradle 8.14.3, **New Architecture off**. This doc compares (1) upgrading to Expo 55 + latest React + Gradle vs (2) going to bare React Native CLI + Gradle + Android Studio.

---

## Option A: Upgrade to Expo 55 + New React + Gradle (Stay on Expo)

### What you’d update

| Area | Current | Target | Notes |
|------|---------|--------|--------|
| **Expo** | 54.0.11 | **55.x** (e.g. `expo@next`) | New SDK versioning: all `expo-*` packages use **^55.0.0** |
| **React** | 19.1.0 | **19.2.0** | Bumped with Expo 55 |
| **React Native** | 0.81.4 | **0.83.1** | Pinned by Expo 55 |
| **Gradle** | 8.14.3 | **8.14.3 or 8.7+** | You’re already above RN 0.83’s minimum (8.7); no change required unless Expo template bumps it |
| **New Architecture** | `newArchEnabled=false` | **Required (always on)** | SDK 55 drops Legacy Architecture; you must enable New Arch |

### Retooling effort (Expo 55 path)

1. **Dependencies**
   - Run: `npx expo install expo@next --fix` to align all Expo and RN versions.
   - Manually set all `expo-*` to `^55.0.0` if the new versioning scheme is enforced before `--fix` does it.

2. **New Architecture**
   - Set `newArchEnabled=true` in `android/gradle.properties` (and remove the flag from `app.json` if present; SDK 55 removes the option).
   - Fix any native or third‑party code that assumes the old bridge (TurboModules/Fabric are now default).
   - Test the app and any native modules for New Arch compatibility.

3. **Native project**
   - Run `npx expo prebuild --clean` so Android (and iOS) are regenerated for SDK 55 / RN 0.83.
   - Resolve any new Gradle/AGP/NDK requirements that the new template introduces.

4. **Breaking changes (Expo 55)**
   - `app.json`: remove top-level `notification` config; use `expo-notifications` config plugin if you use push.
   - Push in Expo Go on Android is no longer allowed; use a dev build for push.
   - `expo-av` removed from Expo Go; use `expo-video` / `expo-audio` if you rely on it.
   - Optional: Hermes v1 (opt‑in) and bytecode diffing for OTA; new Router/native tabs if you adopt Expo Router.

5. **Gradle / Android Studio**
   - No separate “Gradle retooling” beyond what prebuild gives you. You stay within Expo’s chosen Gradle/AGP/NDK matrix; Android Studio remains the IDE for opening `android/` when needed.

**Rough effort:** Low–medium if your app and deps are New Arch–ready; medium if you have custom native code or fragile native modules.

---

## Option B: RN/Gradle/Android Studio (Drop Expo)

### What you’d do

- Remove Expo from the project (entry, Gradle, native wrappers, Expo-only deps).
- Use React Native CLI for run/build, Gradle for Android, Android Studio for native editing and debugging.
- Pick React/RN versions yourself (e.g. latest stable RN 0.79/0.80/0.83 when you’re ready).
- Upgrade Gradle (and AGP) on your own schedule to match the React Native version you choose.

**Retooling:** As in `ANDROID_NO_EXPO_PLAN.md`: replace Expo bootstrap and JS deps, strip Expo from Gradle and Kotlin, add scripts. No Expo 55–specific steps; you follow RN’s own upgrade guides for future bumps.

---

## Benefit: Expo 55 Upgrade vs RN/Gradle/AS

### Why choose **Expo 55 + new React + Gradle** (Option A)

| Benefit | Detail |
|--------|--------|
| **Single upgrade command** | `npx expo install expo@next --fix` + `npx expo prebuild --clean` gets you to RN 0.83, React 19.2, and aligned native projects. |
| **Managed native stack** | Expo chooses and tests Gradle, AGP, NDK, Hermes. Fewer “wrong combination” issues. |
| **Expo Go + EAS** | Keep using Expo Go for quick testing; use EAS Build and EAS Update (OTA) without building your own pipeline. |
| **New Arch + Hermes v1** | You get New Architecture and can opt into Hermes v1 for better perf and modern JS; Expo handles the build setup. |
| **Expo ecosystem** | Router, native tabs, expo-blur stable on Android, widgets, sharing, etc. If you use or plan to use these, staying on Expo is a clear win. |
| **Less ownership of native** | You don’t own Gradle/AGP versioning; you follow Expo’s matrix. Good if you want to focus on JS/features. |

**Tradeoffs:** You must adopt New Architecture (no legacy). You’re tied to Expo’s release cycle and dependency choices. Native customizations stay within Expo’s config plugins and prebuild.

---

### Why choose **RN/Gradle/Android Studio** (Option B)

| Benefit | Detail |
|--------|--------|
| **Full control** | You choose RN, React, Gradle, and AGP versions and upgrade on your own timeline. |
| **Android Studio first‑class** | No Expo layer; Gradle and native code are standard RN. Easier for native-focused devs or teams that live in Android Studio. |
| **Simpler stack** | No Expo CLI, prebuild, or config plugins for the Android app. Fewer moving parts. |
| **No New Arch forced now** | You can stay on Legacy Architecture until you’re ready, then follow RN’s migration guide. |
| **Smaller surface** | Only the React Native and community deps you add; no Expo SDK surface to track. |

**Tradeoffs:** You own upgrades (RN, Gradle, AGP) and compatibility. No Expo Go or EAS Update unless you reintroduce them (e.g. dev build + your own OTA). You replace expo-* features (fonts, status bar, linear gradient) with RN or community packages once.

---

## Summary Table

| Criterion | Expo 55 upgrade (A) | RN/Gradle/AS (B) |
|----------|----------------------|-------------------|
| **Upgrade effort** | Medium (New Arch + prebuild + breaking changes) | Medium (one-time Expo removal; then normal RN upgrades) |
| **Who picks versions** | Expo (RN 0.83, React 19.2, Gradle by template) | You |
| **New Architecture** | Required in SDK 55 | Optional until you choose to enable |
| **Gradle / Android Studio** | Use both; versions driven by Expo prebuild | Use both; you control versions |
| **Expo Go / EAS** | Yes | No (unless you add alternatives) |
| **Ongoing maintenance** | Follow Expo SDK upgrades | Follow React Native releases |
| **Best fit** | Want managed stack, OTA, Expo ecosystem | Want full control, minimal stack, Android‑first |

---

## Recommendation (short)

- **Stay on Expo and upgrade to 55** if you want one upgrade path, EAS/OTA, Expo Go, and are okay turning on New Architecture now. Then retool only as needed for Expo 55 (deps, prebuild, breaking changes).
- **Go RN/Gradle/Android Studio** if you want to own the Android toolchain and versions and don’t need Expo Go or EAS. You retool once to remove Expo; after that, “new versions” mean upgrading React Native (and Gradle when RN requires it), not Expo SDK.

**Reupload list (if you edit this file):** `crosswords_mobile/UPGRADE_COMPARISON.md`
