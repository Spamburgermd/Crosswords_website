export type GreenMotifWordSlot = {
  targetIndex: number;
  coords: number[][];
  length: number;
};

export type GreenMotifCandidate = {
  coordKey: string;
  row: number;
  col: number;
  targetIndex: number;
  positionInWord: number;
};

type CollectNewGreenIntersectionMotifsArgs = {
  previousConfirmedCoords: Set<string>;
  confirmedBoardLettersByCoord: Map<string, string>;
  coordToTargetIndices: Map<string, number[]>;
  slotByTargetIndex: Map<number, GreenMotifWordSlot>;
  greenLettersByTarget: Record<number, Record<number, string>>;
  motifFiredCoords: Set<string>;
  revealTargetIndex?: number | null;
};

function findPositionInWord(slot: GreenMotifWordSlot, coordKey: string): number {
  for (let i = 0; i < slot.coords.length; i++) {
    const [row, col] = slot.coords[i] ?? [];
    if (`${row}:${col}` === coordKey) {
      return i;
    }
  }
  return -1;
}

export function collectNewGreenIntersectionMotifs({
  previousConfirmedCoords,
  confirmedBoardLettersByCoord,
  coordToTargetIndices,
  slotByTargetIndex,
  greenLettersByTarget,
  motifFiredCoords,
  revealTargetIndex = null,
}: CollectNewGreenIntersectionMotifsArgs): GreenMotifCandidate[] {
  const candidates: GreenMotifCandidate[] = [];

  for (const coordKey of confirmedBoardLettersByCoord.keys()) {
    if (previousConfirmedCoords.has(coordKey)) continue;

    const targets = coordToTargetIndices.get(coordKey);
    if (!targets || targets.length < 2) continue;
    if (motifFiredCoords.has(coordKey)) continue;

    const partiallySolvedOwners = targets
      .map((targetIndex) => {
        const slot = slotByTargetIndex.get(targetIndex);
        if (!slot) return null;
        const positionInWord = findPositionInWord(slot, coordKey);
        if (positionInWord < 0) return null;
        const greenCount = Object.keys(greenLettersByTarget[targetIndex] ?? {}).length;
        if (greenCount >= slot.length) {
          return null;
        }
        return {
          targetIndex,
          slot,
          positionInWord,
        };
      })
      .filter((owner): owner is { targetIndex: number; slot: GreenMotifWordSlot; positionInWord: number } => owner != null);

    if (partiallySolvedOwners.length === 0) continue;

    const chosenOwner =
      (revealTargetIndex != null
        ? partiallySolvedOwners.find((owner) => owner.targetIndex === revealTargetIndex)
        : undefined) ?? partiallySolvedOwners[0];

    if (!chosenOwner) continue;

    const [row, col] = chosenOwner.slot.coords[chosenOwner.positionInWord] ?? [];
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;

    candidates.push({
      coordKey,
      row,
      col,
      targetIndex: chosenOwner.targetIndex,
      positionInWord: chosenOwner.positionInWord,
    });
  }

  return candidates;
}
