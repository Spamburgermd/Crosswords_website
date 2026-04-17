# Plan: Android App Mode Without Expo

**Purpose:** Evaluate the repo and provide a step-by-step plan for building an Android app that runs without Expo (bare React Native for Android only).

---

## 1. Current State Summary

### 1.1 Expo usage today

| Area | What’s used | Where |
|------|--------------|--------|
| **Entry / bootstrap** | `registerRootComponent` from `expo` | `index.js` |
| **App entry resolution** | Expo CLI resolves entry; Gradle uses `expo/scripts/resolveAppEntry` | `android/app/build.gradle` |
| **Metro / bundle** | Expo CLI for bundling (`@expo/cli`, `export:embed`) | `android/app/build.gradle` |
| **Native Android** | `expo.modules.ReactActivityDelegateWrapper`, `ReactNativeHostWrapper`, `ApplicationLifecycleDispatcher`; JS entry `.expo/.virtual-metro-entry` | `MainActivity.kt`, `MainApplication.kt` |
| **Gradle** | `expo-root-project`, `expo-autolinking-settings`, `expo-modules-autolinking`, Expo version catalog | `android/build.gradle`, `android/settings.gradle` |
| **JS dependencies** | `expo`, `expo-constants`, `expo-dev-client`, `expo-font`, `expo-linear-gradient`, `expo-status-bar`, `babel-preset-expo` | `package.json`, `App.tsx`, 4 screens/components |
| **Config** | `expo/tsconfig.base`, `babel-preset-expo`, `app.json` expo block | `tsconfig.json`, `babel.config.js`, `app.json` |
| **Env / flags** | `EXPO_PUBLIC_*` (optional) | `src/flags.ts` |

### 1.2 Files that import Expo packages

- **App.tsx:** `expo-status-bar`, `expo-font`
- **LobbyScreen.tsx, TitleScreen.tsx, BoardView.tsx, ThemePicker.tsx:** `expo-linear-gradient`
- **index.js:** `expo` (`registerRootComponent`)

### 1.3 Native Android layout

- `android/` is present (Expo prebuild / dev-client style).
- `MainActivity.kt` and `MainApplication.kt` depend on `expo.modules.*` and point to Expo’s virtual Metro entry.

---

## 2. Goals and non-goals

**In scope**

- Single build variant: **Android only**, no Expo.
- Same app behavior: navigation, themes, API, fonts, gradients.
- Scripts: run and build Android via React Native CLI / Gradle (no `expo start` / `expo run:android` for this mode).

**Out of scope (for this plan)**

- iOS or Expo Go; keeping existing Expo-based setup in a separate branch or config is acceptable.
- EAS, OTA updates, or Expo-specific services.

---

## 3. Replacement map (Expo → non-Expo)

| Expo dependency | Replacement | Notes |
|-----------------|-------------|--------|
| `registerRootComponent(App)` | `AppRegistry.registerComponent('main', () => App)` | From `react-native`. |
| `expo-status-bar` | `react-native` `StatusBar` | Same API surface for `style`, etc. |
| `expo-font` | `@react-native-async-storage/async-storage` not needed; use **react-native custom fonts** via asset linking + `fontFamily` in styles, or **expo-font** kept as standalone (it can work in bare RN). Prefer **react-native-asset** or manual copy to `android/app/src/main/assets/fonts` + `fontFamily: 'Cinzel-Regular'` etc. Or keep **expo-font** as the only Expo package (it’s minimal). | Font loading: either bare RN assets + `fontFamily` or keep `expo-font` only. |
| `expo-linear-gradient` | `react-native-linear-gradient` (community) or implement with nested `View` + absolute positioning | Same visual result; API slightly different. |
| `expo-constants` | Not used in `src/`. Remove from deps or replace with `react-native-config` / `__DEV__` / build-time constants if needed later. | Safe to drop for this mode. |
| `expo-dev-client` | Remove. Use standard RN dev build (Metro + `react-native run-android`). | No replacement. |
| Babel | `babel-preset-expo` → `babel-preset-react-native` (or `@react-native/babel-preset`) | Keep `babel-plugin-module-resolver` and path aliases. |
| TypeScript | `expo/tsconfig.base` → extend from `@react-native/typescript-config` or inline equivalent (`strict`, `jsx`, `paths`). | Already have paths; replicate in base. |
| Env vars | `EXPO_PUBLIC_*` → `process.env` with Metro `env` config or `react-native-config` (optional). | In no-Expo mode use Metro’s `process.env` or a small env module. |
| Android entry | Replace Expo wrappers with standard `ReactActivity` / `DefaultReactActivityDelegate` and `DefaultReactNativeHost`; point to `index.js` (or a dedicated `index.android.js`). | Remove `ReactActivityDelegateWrapper`, `ReactNativeHostWrapper`, `ApplicationLifecycleDispatcher`; set `getJSMainModuleName()` to `"index"` (or chosen entry). |
| Gradle | Remove `expo-root-project`, Expo autolinking, Expo version catalog; use only React Native Gradle Plugin and RN autolinking. | `settings.gradle` and `build.gradle` edited to drop Expo. |

---

## 4. Implementation plan (phased)

### Phase 0: Branch and baseline

- Create branch e.g. `feat/android-no-expo`.
- Ensure current Expo Android build runs: `npx expo run:android`.
- Document exact Node/Yarn/OS and any env (e.g. `ANDROID_HOME`).

### Phase 1: New entry and Babel/TypeScript (no native yet)

1. **Entry point**
   - Add `index.android.js` (or keep single `index.js` and use it for Android):
     - Use `AppRegistry.registerComponent('main', () => App)` from `react-native`.
   - Later, Gradle will point to this file; for this phase, only add the file and optionally switch `index.js` to it so Metro can load it when you test.

2. **Babel**
   - In `babel.config.js`, replace `babel-preset-expo` with `babel-preset-react-native` (or `@react-native/babel-preset`).
   - Keep `babel-plugin-module-resolver` and path aliases.
   - Run Metro once to confirm bundling: `npx react-native start` (may fail on native until Phase 2).

3. **TypeScript**
   - Stop extending `expo/tsconfig.base`.
   - Use a base from `@react-native/typescript-config` or copy needed options (strict, jsx, paths, types) into `tsconfig.json`.
   - Ensure path aliases match Babel.

4. **Env / flags**
   - In `src/flags.ts`, for the no-Expo build read from `process.env.REACT_APP_*` or a small `env.js` that Metro injects, so you don’t depend on `EXPO_PUBLIC_*`.

Deliverable: JS bundle builds with Metro (entry = `index.js` or `index.android.js`), no Expo in entry or Babel/TS config.

### Phase 2: Replace Expo JS dependencies in app code

1. **StatusBar**
   - In `App.tsx`, replace `expo-status-bar` with `import { StatusBar } from 'react-native'` and same props (e.g. `style="auto"` → `barStyle="dark-content"` etc.).

2. **Fonts**
   - **Option A (recommended for true no-Expo):** Copy font files to `android/app/src/main/assets/fonts/`, reference in styles with `fontFamily: 'Cinzel-Regular'` etc., and remove `useFonts` from `App.tsx` (show app as soon as React mounts; fonts load from system/asset).
   - **Option B:** Keep `expo-font` as the only Expo package and use it only for font loading (still need to remove other Expo deps and native Expo modules).

3. **Linear gradient**
   - Replace `expo-linear-gradient` with `react-native-linear-gradient` in:
     - `LobbyScreen.tsx`, `TitleScreen.tsx`, `BoardView.tsx`, `ThemePicker.tsx`.
   - Adjust import and component name (e.g. `LinearGradient` from `react-native-linear-gradient`); props are similar (colors, start/end, locations).

4. **Remove unused**
   - Remove from `package.json`: `expo`, `expo-constants`, `expo-dev-client`, `expo-status-bar`, `expo-linear-gradient`; if not using Option B, remove `expo-font` too.
   - Delete or stub `src/types/expo-font.d.ts` if you drop expo-font.

5. **App entry**
   - Ensure root component is registered as `'main'` in the chosen `index.js` / `index.android.js` (to match `getMainComponentName()`).

Deliverable: App code has no Expo imports; optional single exception is `expo-font` if Option B is used.

### Phase 3: Android native – remove Expo from Gradle and Kotlin

1. **settings.gradle**
   - Remove Expo plugin resolution and `includeBuild(expoPluginsPath)`.
   - Remove `id("expo-autolinking-settings")` and `expoAutolinking.*` usage.
   - Keep React Native’s `com.facebook.react.settings` and autolinking from React Native only (no Expo autolinking).

2. **Root build.gradle**
   - Remove `apply plugin: "expo-root-project"`.
   - Keep `apply plugin: "com.facebook.react.rootproject"`.

3. **app/build.gradle**
   - Remove Expo-specific `react { }` config: especially `entryFile` (Expo resolve), `cliFile` (Expo CLI), `bundleCommand = "export:embed"`.
   - Set explicit `entryFile = file("../index.js")` (or `../index.android.js`) and remove any Expo CLI reference.
   - Remove or replace `expoLibs` / Expo version catalog usage (e.g. GIF/WebP via standard React Native or explicit deps).
   - Keep Hermes, `react-android`, and standard RN configuration.

4. **MainActivity.kt**
   - Remove `import expo.modules.ReactActivityDelegateWrapper`.
   - Use `DefaultReactActivityDelegate` only in `createReactActivityDelegate()` (no wrapper).
   - Keep `getMainComponentName() = "main"`.
   - Keep theme/splash comment or remove if not using expo-splash-screen.

5. **MainApplication.kt**
   - Remove `expo.modules.ApplicationLifecycleDispatcher` and `ReactNativeHostWrapper`.
   - Extend `DefaultReactNativeHost` directly and assign to `reactNativeHost`.
   - Set `getJSMainModuleName()` to `"index"` (or `"index.android"` if you use that file name for Metro).
   - Remove `reactHost` override if it only existed for Expo; use default RN host.
   - Remove `onConfigurationChanged` / lifecycle calls that only forwarded to Expo.

6. **gradle.properties**
   - Remove Expo-specific keys (`expo.gif.enabled`, `expo.webp.*`, `expo.useLegacyPackaging`, `expo.edgeToEdgeEnabled`, etc.) or leave harmless ones; add any needed defaults for RN.

7. **Dependencies**
   - Ensure no `expo-modules-*` or Expo packages are referenced in Gradle. After removing Expo plugin and autolinking, they won’t be applied.

Deliverable: Android project builds with `./gradlew assembleDebug` (or `react-native run-android`) and loads JS from the chosen entry file without Expo.

### Phase 4: Scripts, docs, and optional dual mode

1. **package.json scripts**
   - Add or switch Android scripts for no-Expo mode, e.g.:
     - `"android:bare": "react-native run-android"`
     - `"start:bare": "react-native start"`
   - Keep existing `expo start` / `expo run:android` if you retain an Expo branch for iOS/Expo Go.

2. **README / AGENTS.md**
   - Document “Android without Expo”: prerequisites (JDK, Android SDK, env), commands (`npm run android:bare`, `npm run start:bare`), and that this is Android-only.
   - Add “Reupload list” and rollback steps (e.g. revert to branch that uses Expo).

3. **Optional: dual mode**
   - Use an env flag (e.g. `NO_EXPO=1`) or a separate `index.android.js` that uses `AppRegistry` only when building the bare Android app; keep `index.js` with `registerRootComponent` for Expo. Gradle can point to `index.android.js` only in the no-Expo build.

### Phase 5: Testing and cleanup

- Run `npm run typecheck` and fix any type errors (e.g. from removing Expo types).
- Run `npm run lint`.
- Manual test: cold start, navigation (Title → Lobby → Board), themes, fonts, gradients, and one full game flow.
- Remove leftover Expo references in comments and `app.json` if this variant never uses Expo.

---

## 5. File checklist (summary)

| File | Action |
|------|--------|
| `index.js` or new `index.android.js` | Use `AppRegistry.registerComponent('main', () => App)` |
| `App.tsx` | StatusBar from RN; fonts via assets or keep expo-font only |
| `src/screens/LobbyScreen.tsx`, `TitleScreen.tsx` | Use `react-native-linear-gradient` |
| `src/components/BoardView.tsx`, `ThemePicker.tsx` | Same |
| `src/flags.ts` | Use `process.env.REACT_APP_*` or env module for no-Expo |
| `src/types/expo-font.d.ts` | Remove or keep only if using expo-font |
| `package.json` | Drop Expo deps (and optionally keep expo-font); add RN CLI scripts |
| `babel.config.js` | `babel-preset-react-native`, keep module-resolver |
| `tsconfig.json` | Extend RN TS config or inline base |
| `android/settings.gradle` | Remove Expo plugins and includeBuild |
| `android/build.gradle` | Remove `expo-root-project` |
| `android/app/build.gradle` | RN-only `react { }`, entryFile, no Expo CLI |
| `android/app/.../MainActivity.kt` | DefaultReactActivityDelegate only |
| `android/app/.../MainApplication.kt` | DefaultReactNativeHost, getJSMainModuleName = "index" |
| `android/gradle.properties` | Remove or replace Expo keys |
| `app.json` | Optional: keep for version/slug; remove Expo block if not used |

---

## 6. Risks and mitigations

- **Font loading:** If you remove expo-font, ensure custom fonts are in `android/.../assets/fonts` and that `fontFamily` matches the file names (without extension). Test on device.
- **Gradient behavior:** `react-native-linear-gradient` may have slightly different default behavior (e.g. direction); verify each screen.
- **Metro config:** Bare RN uses `metro.config.js` from React Native. If you currently rely on Expo’s Metro, ensure resolver and asset config still support your path aliases and assets (or add a minimal `metro.config.js`).
- **Single codebase:** If you want both “Expo Android” and “bare Android” from the same repo, use two entry files and/or build flavors so one build uses Expo and the other does not; the plan above assumes one Android variant without Expo.

---

## 7. Rollback

- Keep branch `main` (or current default) as Expo-based.
- All changes for no-Expo live on a feature branch; rollback = switch back and run `npx expo run:android`.
- Reupload list (for your process): after each phase, list changed files (e.g. `index.js`, `App.tsx`, `android/...`) per AGENTS.md.

---

## 8. Next steps

1. Create branch `feat/android-no-expo`.
2. Execute Phase 1 (entry, Babel, TS, flags).
3. Execute Phase 2 (replace StatusBar, fonts, LinearGradient; remove Expo deps).
4. Execute Phase 3 (Gradle and Kotlin changes).
5. Add scripts and docs (Phase 4), then test and cleanup (Phase 5).

**Reupload list (after full implementation):**  
`index.js` (or `index.android.js`), `App.tsx`, `src/flags.ts`, `src/screens/LobbyScreen.tsx`, `src/screens/TitleScreen.tsx`, `src/components/BoardView.tsx`, `src/components/ThemePicker.tsx`, `src/types/expo-font.d.ts` (if removed), `package.json`, `babel.config.js`, `tsconfig.json`, `android/settings.gradle`, `android/build.gradle`, `android/app/build.gradle`, `android/app/src/main/java/com/crosswords/mobile/MainActivity.kt`, `android/app/src/main/java/com/crosswords/mobile/MainApplication.kt`, `android/gradle.properties`, `ANDROID_NO_EXPO_PLAN.md` (this file).
