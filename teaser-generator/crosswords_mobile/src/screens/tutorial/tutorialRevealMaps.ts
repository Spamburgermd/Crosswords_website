import {
  buildConfirmedLettersByTargetFromCoordMap,
  buildConfirmedLettersForTargetFromCoordMap,
} from '@src/lib/confirmedBoardLetters';

export function buildTutorialGreenLettersByTarget(
  wordSlots: Array<{ targetIndex: number; coords: number[][] }>,
  confirmedBoardLettersByCoord: Map<string, string>,
): Record<number, Record<number, string>> {
  return buildConfirmedLettersByTargetFromCoordMap(confirmedBoardLettersByCoord, wordSlots);
}

export function buildTutorialGreenLettersForActive(
  activeTargetIndex: number,
  wordSlots: Array<{ targetIndex: number; coords: number[][] }>,
  confirmedBoardLettersByCoord: Map<string, string>,
): Record<number, string> {
  return buildConfirmedLettersForTargetFromCoordMap(
    activeTargetIndex,
    wordSlots,
    confirmedBoardLettersByCoord,
  );
}

/**
 * Build the exact green-letter contract TutorialScreen passes to the shared
 * board panel. This gives us one pure seam to test without needing a React
 * renderer in the Jest environment.
 */
export function buildTutorialBoardRevealContract(
  activeTargetIndex: number,
  wordSlots: Array<{ targetIndex: number; coords: number[][] }>,
  confirmedBoardLettersByCoord: Map<string, string>,
): {
  greenLettersByTarget: Record<number, Record<number, string>>;
  greenLettersForActive: Record<number, string>;
} {
  const greenLettersByTarget = buildTutorialGreenLettersByTarget(
    wordSlots,
    confirmedBoardLettersByCoord,
  );
  const greenLettersForActive = buildTutorialGreenLettersForActive(
    activeTargetIndex,
    wordSlots,
    confirmedBoardLettersByCoord,
  );

  return {
    greenLettersByTarget,
    greenLettersForActive,
  };
}
