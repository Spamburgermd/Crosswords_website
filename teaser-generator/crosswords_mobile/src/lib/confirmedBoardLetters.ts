export type CoordinateTruthMap = Map<string, string>;

export type CoordinateWordSlot = {
  targetIndex: number;
  coords: number[][];
};

export function buildConfirmedLettersByTargetFromCoordMap(
  confirmedBoardLettersByCoord: CoordinateTruthMap,
  wordSlots: CoordinateWordSlot[],
): Record<number, Record<number, string>> {
  const result: Record<number, Record<number, string>> = {};

  for (const slot of wordSlots) {
    for (let i = 0; i < slot.coords.length; i++) {
      const [row, col] = slot.coords[i] ?? [];
      const letter = confirmedBoardLettersByCoord.get(`${row}:${col}`);
      if (!letter) continue;
      if (!result[slot.targetIndex]) {
        result[slot.targetIndex] = {};
      }
      result[slot.targetIndex]![i] = letter;
    }
  }

  return result;
}

export function buildConfirmedLettersForTargetFromCoordMap(
  activeTargetIndex: number,
  wordSlots: CoordinateWordSlot[],
  confirmedBoardLettersByCoord: CoordinateTruthMap,
): Record<number, string> {
  const activeSlot = wordSlots.find((slot) => slot.targetIndex === activeTargetIndex);
  if (!activeSlot) return {};

  const result: Record<number, string> = {};
  activeSlot.coords.forEach(([row, col], index) => {
    const letter = confirmedBoardLettersByCoord.get(`${row}:${col}`);
    if (letter) {
      result[index] = letter;
    }
  });
  return result;
}
