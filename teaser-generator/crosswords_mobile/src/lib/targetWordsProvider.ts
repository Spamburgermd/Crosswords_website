/**
 * src/lib/targetWordsProvider.ts
 * ---------------------------------------------
 * Stable helper to obtain target words for serverless-local scoring without
 * relying on debug-only fields. Returns null when unavailable and explains why.
 *
 * Why this exists:
 * - Serverless-local scoring needs the full target words to compute feedback.
 * - The FastAPI /games/{id}/state payload only includes solution words in
 *   debug fields today (e.g., debug_solution_words). We try every safe source
 *   we have and surface a clear reason when missing.
 *
 * NOTE: This helper is intentionally conservative and read-only; it does not
 * mutate the incoming game state.
 */

type MaybeGameState = {
  // Non-debug fields we might hope to use in the future:
  // target_words?: string[]; // not present today
  // target_seed?: string;    // not present today
  debug_solution_words?: unknown;
  debug_bot_words?: unknown;
};

/**
 * Attempt to extract target words from a game state/response.
 * Current priority:
 * 1) target_words (if server ever exposes it) — preferred, not present today.
 * 2) debug_solution_words (string[]) — current dev-only source.
 * 3) debug_bot_words (string[]) — secondary fallback.
 * Returns null if no reliable list is present.
 */
export function getTargetWordsForGame(
  gameStateOrResponse: MaybeGameState | null | undefined,
  _gameId?: number,
): string[] | null {
  if (!gameStateOrResponse) return null;

  const maybeTargets = (gameStateOrResponse as { target_words?: unknown }).target_words;
  if (Array.isArray(maybeTargets) && maybeTargets.every((w) => typeof w === 'string')) {
    return maybeTargets as string[];
  }

  const maybeSolutions = gameStateOrResponse.debug_solution_words;
  if (Array.isArray(maybeSolutions) && maybeSolutions.every((w) => typeof w === 'string')) {
    return maybeSolutions as string[];
  }

  // Secondary fallback: some dev builds expose bot words; this is less ideal but better than nothing.
  const maybeBotWords = gameStateOrResponse.debug_bot_words;
  if (Array.isArray(maybeBotWords) && maybeBotWords.every((w) => typeof w === 'string')) {
    return maybeBotWords as string[];
  }

  return null;
}

/**
 * Provide a concise, developer-facing explanation when target words are missing.
 * Keep this in sync with getTargetWordsForGame so error messages stay actionable.
 */
export function explainWhyMissingTargetWords(gameStateOrResponse: MaybeGameState | null | undefined): string {
  if (!gameStateOrResponse) {
    return 'Game state is null or undefined; cannot read target words.';
  }
  if (Array.isArray((gameStateOrResponse as { target_words?: unknown }).target_words)) {
    return 'Unexpected: target_words present but not a string array.';
  }
  if (!Array.isArray(gameStateOrResponse.debug_solution_words)) {
    return 'Server response does not include target_words; debug_solution_words not present (server hides solutions).';
  }
  if (!gameStateOrResponse.debug_solution_words.every((w: unknown) => typeof w === 'string')) {
    return 'debug_solution_words existed but was not a string array.';
  }
  return 'Unknown reason; target words could not be derived.';
}
