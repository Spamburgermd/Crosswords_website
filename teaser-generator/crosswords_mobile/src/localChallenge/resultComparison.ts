/**
 * src/localChallenge/resultComparison.ts
 * ---------------------------------------------
 * PvP result comparison logic for async gameplay.
 * When both players finish, compare their results to determine winner.
 */

export type ChallengeResultPayload = {
  v: 1;
  type: 'result';
  challengeId: string; // Maps to offerId
  totalGuesses: number;
  solvedCount: number;
  guessesByTarget: Array<Array<{ guess: string; codes: string[] }>>;
  submittedAtMs: number;
};

export type ResultComparison = {
  playerResult: ChallengeResultPayload;
  opponentResult: ChallengeResultPayload;
  winner: 'player' | 'opponent' | 'tie';
  playerTotalGuesses: number;
  opponentTotalGuesses: number;
  playerSolvedCount: number;
  opponentSolvedCount: number;
};

/**
 * Compare two players' results to determine winner.
 *
 * Rules:
 * 1. Most words solved wins
 * 2. If tied on words solved, fewest guesses wins
 * 3. If tied on both, declare a tie
 */
export function compareResults(
  playerResult: ChallengeResultPayload,
  opponentResult: ChallengeResultPayload
): ResultComparison {
  const playerSolvedCount = playerResult.solvedCount;
  const opponentSolvedCount = opponentResult.solvedCount;
  const playerTotalGuesses = playerResult.totalGuesses;
  const opponentTotalGuesses = opponentResult.totalGuesses;

  let winner: 'player' | 'opponent' | 'tie';

  // Rule 1: Most words solved wins
  if (playerSolvedCount !== opponentSolvedCount) {
    winner = playerSolvedCount > opponentSolvedCount ? 'player' : 'opponent';
  }
  // Rule 2: Fewest guesses wins (if tied on solved count)
  else if (playerTotalGuesses !== opponentTotalGuesses) {
    winner = playerTotalGuesses < opponentTotalGuesses ? 'player' : 'opponent';
  }
  // Tie: same solved count and same total guesses
  else {
    winner = 'tie';
  }

  return {
    playerResult,
    opponentResult,
    winner,
    playerTotalGuesses,
    opponentTotalGuesses,
    playerSolvedCount,
    opponentSolvedCount,
  };
}

/**
 * Generate a shareable result payload from a completed session.
 */
export function generateResultPayload(
  challengeId: string,
  guessesByTarget: Array<Array<{ guess: string; codes: string[] }>>,
  solvedByTarget: boolean[]
): ChallengeResultPayload {
  const totalGuesses = guessesByTarget.reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
  const solvedCount = solvedByTarget.filter(Boolean).length;

  return {
    v: 1,
    type: 'result',
    challengeId,
    totalGuesses,
    solvedCount,
    guessesByTarget,
    submittedAtMs: Date.now(),
  };
}
