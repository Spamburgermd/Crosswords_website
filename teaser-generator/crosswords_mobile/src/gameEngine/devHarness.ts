/**
 * src/gameEngine/devHarness.ts
 * ---------------------------------------------
 * Minimal "manual test" harness you can run with ts-node or plain Node
 * (after transpiling) to sanity check the engine without wiring it to the app.
 *
 * Usage (from repo root):
 *   cd crosswords_mobile
 *   npx ts-node src/gameEngine/devHarness.ts
 * If ts-node is not installed globally, use: npx ts-node ...
 */

import { computeFeedback } from './feedback';
import { initGameFromChallenge, applyGuess, isSolved } from './state';
import { encodeChallenge, decodeChallenge, encodeResult, decodeResult } from './serialize';
import { stableChallengeId } from './hash';
import { ChallengePayload, DEFAULT_RULES, ResultPayload } from './types';

function logSection(title: string): void {
  console.log('\n===', title, '===');
}

// 1) Challenge encode/decode roundtrip
logSection('Challenge encode/decode');
const challenge: ChallengePayload = {
  v: 1,
  words: ['MOUSE', 'HOUSE', 'PLANT', 'RIVER', 'STONE'],
  rules: DEFAULT_RULES,
  createdAtMs: Date.now(),
};
const encodedChallenge = encodeChallenge(challenge);
const decodedChallenge = decodeChallenge(encodedChallenge);
console.log('Encoded challenge:', encodedChallenge);
console.log('Decoded equals original words:', decodedChallenge.words.join(',') === challenge.words.join(','));

// 2) Feedback examples (duplicates + cross-word blues)
logSection('Feedback examples');
const fb1 = computeFeedback('APPLE', 'ALLEY', { ...DEFAULT_RULES, bluePoolLetters: [] });
console.log('APPLE vs ALLEY:', fb1.codes); // expect some greens/yellows

const fb2 = computeFeedback('BRICK', 'CREEK', {
  ...DEFAULT_RULES,
  // Pretend another target word has an R and E so blues can show up.
  bluePoolLetters: ['R', 'E'],
});
console.log('BRICK vs CREEK (with blue pool):', fb2.codes);

// 3) State progression + challengeId + result encode
logSection('State progression');
const game = initGameFromChallenge(challenge);
const { nextState, result } = applyGuess(game, 0, 'MOOSE');
console.log('First guess codes:', result.codes);
console.log('Solved after first guess?', isSolved(nextState));

logSection('Challenge ID');
const cid = stableChallengeId(challenge);
console.log('Stable challenge id:', cid);

logSection('Result encode/decode');
const resultPayload: ResultPayload = {
  v: 1,
  challengeId: cid,
  completed: 'win',
  attempts: 7,
  timeMs: 12345,
  guessesByTarget: nextState.guessesByTarget,
};
const encodedResult = encodeResult(resultPayload);
console.log('Encoded result:', encodedResult);
console.log('Decoded result attempts match:', decodeResult(encodedResult).attempts === resultPayload.attempts);

logSection('Done');
