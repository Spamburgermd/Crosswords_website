/**
 * src/flags.ts
 * -----------------------------------------------------------
 * Central place to read feature toggles. Expo exposes vars that
 * start with EXPO_PUBLIC_ at runtime, so we only need to parse
 * strings into booleans once here.
 *
 * Example (.env):
 *   EXPO_PUBLIC_ENABLE_CROSSROADS_STYLES=true
 *   EXPO_PUBLIC_PREVIEW_SCREEN=crossroads-gallery
 */

/**
 * Convert a string flag into a boolean. Accepts "true", "1",
 * and "yes" (case-insensitive) as truthy values so novices do
 * not get stuck on casing.
 */
function toBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback;
  }
  return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
}

/**
 * Toggle for the Crossroads visual refresh. Defaults to false so
 * existing parchment styling stays active until we are ready.
 */
export const ENABLE_CROSSROADS_STYLES = toBoolean(
  process.env.EXPO_PUBLIC_ENABLE_CROSSROADS_STYLES,
  false,
);

/**
 * Optional override that will later let us boot directly into a
 * preview gallery. Left as a string so navigation can read it.
 */
export const PREVIEW_SCREEN = process.env.EXPO_PUBLIC_PREVIEW_SCREEN ?? '';

/**
 * When true, the real first screen uses the Atlantic preview look (light bg, header, footer).
 * When false, the original layout is used.
 */
export const USE_ATLANTIC_SKIN = true;

/**
 * USE_SERVERLESS_GUESS_SCORING
 * ----------------------------
 * When false (default): the app submits guesses to the FastAPI server via
 * POST /games/{id}/guess and renders whatever codes the server returns.
 * When true: the app keeps game creation/join/polling the same, but guess
 * scoring is computed locally using the client-side game engine. Use this
 * for serverless/local experiments only. Flip by setting
 * EXPO_PUBLIC_USE_SERVERLESS_GUESS_SCORING=true in .env, then restart Expo.
 */
export const USE_SERVERLESS_GUESS_SCORING = toBoolean(
  process.env.EXPO_PUBLIC_USE_SERVERLESS_GUESS_SCORING,
  false,
);

/**
 * OFFLINE_LOCAL_ONLY
 * ------------------
 * When true, the app must not call any backend API on launch and should
 * land directly in the local-only flow (ChallengeScreen). Use for fully
 * offline demos or when the server is unavailable. Default is false to
 * keep server mode unchanged.
 */
const OFFLINE_LOCAL_ONLY_VALUE = toBoolean(
  process.env.EXPO_PUBLIC_OFFLINE_LOCAL_ONLY,
  false,
);

/**
 * ENABLE_SERVER_FUNCTIONS
 * -----------------------
 * Master switch for any server-backed feature (auth, game state, guesses,
 * friends, etc.). Set EXPO_PUBLIC_ENABLE_SERVER_FUNCTIONS=false to force the
 * client into local-only behavior without deleting server code paths.
 *
 * Default:
 * - true in normal builds
 * - false when OFFLINE_LOCAL_ONLY is true
 */
const ENABLE_SERVER_FUNCTIONS_VALUE = toBoolean(
  process.env.EXPO_PUBLIC_ENABLE_SERVER_FUNCTIONS,
  !OFFLINE_LOCAL_ONLY_VALUE,
);

export function isServerFunctionsEnabled(): boolean {
  return ENABLE_SERVER_FUNCTIONS_VALUE && !OFFLINE_LOCAL_ONLY_VALUE;
}

export const ENABLE_SERVER_FUNCTIONS = ENABLE_SERVER_FUNCTIONS_VALUE;

export function isOfflineLocalOnly(): boolean {
  return OFFLINE_LOCAL_ONLY_VALUE;
}

export const OFFLINE_LOCAL_ONLY = OFFLINE_LOCAL_ONLY_VALUE;

/**
 * SHOW_DEV_TARGET_WORDS
 * ---------------------
 * Controls whether the Alphabet side panel shows raw target words.
 * Keep this OFF for store/internal release builds. You can turn it ON
 * locally for debugging by setting EXPO_PUBLIC_SHOW_DEV_TARGET_WORDS=true.
 *
 * Default behavior:
 * - true while running Metro in dev (__DEV__)
 * - false in release builds
 */
export const SHOW_DEV_TARGET_WORDS = toBoolean(
  process.env.EXPO_PUBLIC_SHOW_DEV_TARGET_WORDS,
  __DEV__,
);
