/**
 * src/lib/captureGuessResponse.ts
 * ---------------------------------------------
 * Opt-in helper for developers to record server responses for POST /games/{id}/guess
 * and turn them into fixtures. This file is NOT wired into runtime to avoid
 * side effects. Usage (manual):
 *
 * import { captureGuessResponse } from './captureGuessResponse';
 * ...
 * const res = await submitGuess(...);
 * captureGuessResponse({
 *   enabled: true, // flip to true when you want to log a fixture
 *   name: 'my-case',
 *   targetWord: 'APPLE',
 *   guessWord: 'AMPLE',
 *   responseCodes: res.codes,
 * });
 *
 * Copy the printed JSON into src/gameEngine/__fixtures__/guess_fixtures.json.
 */

type CaptureParams = {
  enabled: boolean;
  name: string;
  targetWord: string;
  guessWord: string;
  responseCodes: string[] | undefined;
};

export function captureGuessResponse(params: CaptureParams): void {
  if (!params.enabled) return;
  const { name, targetWord, guessWord, responseCodes } = params;
  if (!responseCodes) {
    console.log('[captureGuessResponse] skipped: no codes to record');
    return;
  }
  const fixture = {
    name,
    targetWord,
    guessWord,
    rules: { smartBlue: true },
    expectedCodes: responseCodes,
  };
  console.log('[captureGuessResponse] copy into fixtures:', JSON.stringify(fixture, null, 2));
}
