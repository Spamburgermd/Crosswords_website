/**
 * src/lib/boardRevealMap.ts
 * ---------------------------------------------
 * Pure board reveal mapper built from the unified display-guess snapshots.
 * BoardView uses this so every tile reads from the same visible-guess state.
 */

import type { DisplayGuessByTarget } from './guessDisplayState';

export type CanonicalBoardSlot = {
  direction?: 'A' | 'D';
};

export type TileRevealInfo = {
  letter: string;
  primaryTargetIndex: number;
  primaryCode: string;
  primaryDirection: 'A' | 'D';
  positionInWord: number;
  shouldAnimate: boolean;
  isLocked: boolean;
};

export type BoardTileEntry = {
  letter: string;
  code: string;
  targetIndex: number;
  direction: 'A' | 'D';
  positionInWord: number;
  source: 'native' | 'confirmed';
};

export type BoardTile = {
  steadyState: BoardTileEntry;
  candidateEntries: BoardTileEntry[];
  isIntersection: boolean;
  isGreenLocked: boolean;
};

function shouldFailFastForBoardInvariant(): boolean {
  return process.env.NODE_ENV === 'test' || Boolean((globalThis as { __DEV__?: boolean }).__DEV__);
}

function reportBoardInvariant(diagnostics: string[], message: string): void {
  diagnostics.push(message);
  if (shouldFailFastForBoardInvariant()) {
    throw new Error(message);
  }
}

function inferDirectionFromCoords(coords: number[][]): 'A' | 'D' {
  if (coords.length < 2) return 'A';
  return coords[0]?.[0] === coords[1]?.[0] ? 'A' : 'D';
}

function chooseDeterministicBoardOwner<T extends { direction: 'A' | 'D'; code: string }>(
  entries: T[],
): T | undefined {
  return entries.find((entry) => entry.code === 'G') ??
    entries.find((entry) => entry.direction === 'A') ??
    entries[0];
}

function chooseDeterministicSlotOwner<T extends { direction: 'A' | 'D' }>(
  entries: T[],
): T | undefined {
  return entries.find((entry) => entry.direction === 'A') ?? entries[0];
}

export function buildBoardTilesByCoord(
  latestNativeGuessByTarget: DisplayGuessByTarget,
  wordSlots: { targetIndex: number; coords: number[][]; direction?: 'A' | 'D' }[],
  confirmedBoardLettersByCoord: Map<string, string>,
): { boardTilesByCoord: Map<string, BoardTile>; boardDiagnostics: string[] } {
  const boardDiagnostics: string[] = [];
  const ownersByCoord = new Map<string, Array<{ targetIndex: number; direction: 'A' | 'D'; positionInWord: number }>>();
  const nativeCandidatesByCoord = new Map<string, BoardTileEntry[]>();

  for (const slot of wordSlots) {
    const direction = slot.direction ?? inferDirectionFromCoords(slot.coords);
    const latestGuess = latestNativeGuessByTarget[slot.targetIndex];

    for (let positionInWord = 0; positionInWord < slot.coords.length; positionInWord++) {
      const coord = slot.coords[positionInWord];
      if (!coord) continue;

      const [row, col] = coord;
      if (!Number.isInteger(row) || !Number.isInteger(col)) {
        reportBoardInvariant(
          boardDiagnostics,
          `Invalid board coordinate for target ${slot.targetIndex} at position ${positionInWord}`,
        );
        continue;
      }

      const coordKey = `${row}:${col}`;
      const owners = ownersByCoord.get(coordKey) ?? [];
      owners.push({ targetIndex: slot.targetIndex, direction, positionInWord });
      ownersByCoord.set(coordKey, owners);

      if (!latestGuess || positionInWord >= latestGuess.guess.length) continue;

      const letter = latestGuess.guess[positionInWord] ?? '';
      const code = (latestGuess.codes[positionInWord] ?? '').toUpperCase();
      if (!letter || !letter.trim() || !code || code === '_') continue;

      const candidates = nativeCandidatesByCoord.get(coordKey) ?? [];
      candidates.push({
        letter,
        code,
        targetIndex: slot.targetIndex,
        direction,
        positionInWord,
        source: 'native',
      });
      nativeCandidatesByCoord.set(coordKey, candidates);
    }
  }

  const boardTilesByCoord = new Map<string, BoardTile>();
  const allCoordKeys = new Set<string>([
    ...ownersByCoord.keys(),
    ...nativeCandidatesByCoord.keys(),
    ...confirmedBoardLettersByCoord.keys(),
  ]);

  for (const coordKey of allCoordKeys) {
    const owners = ownersByCoord.get(coordKey) ?? [];
    const nativeCandidates = nativeCandidatesByCoord.get(coordKey) ?? [];
    const confirmedLetter = confirmedBoardLettersByCoord.get(coordKey);

    if (owners.length === 0) {
      reportBoardInvariant(
        boardDiagnostics,
        `Coordinate ${coordKey} has board state but is not owned by any word slot`,
      );
      continue;
    }

    if (confirmedLetter) {
      const conflictingGreen = nativeCandidates.find(
        (entry) => entry.code === 'G' && entry.letter !== confirmedLetter,
      );
      if (conflictingGreen) {
        reportBoardInvariant(
          boardDiagnostics,
          `Coordinate ${coordKey} has conflicting green truth (${confirmedLetter} vs ${conflictingGreen.letter})`,
        );
        continue;
      }

      const matchingOwner = chooseDeterministicBoardOwner(
        nativeCandidates.filter((entry) => entry.letter === confirmedLetter),
      ) ?? chooseDeterministicSlotOwner(owners);

      if (!matchingOwner) {
        reportBoardInvariant(
          boardDiagnostics,
          `Coordinate ${coordKey} could not resolve an owner for confirmed letter ${confirmedLetter}`,
        );
        continue;
      }

      boardTilesByCoord.set(coordKey, {
        steadyState: {
          letter: confirmedLetter,
          code: 'G',
          targetIndex: matchingOwner.targetIndex,
          direction: matchingOwner.direction,
          positionInWord: matchingOwner.positionInWord,
          source: 'confirmed',
        },
        candidateEntries: nativeCandidates,
        isIntersection: owners.length > 1,
        isGreenLocked: true,
      });
      continue;
    }

    const steadyState = chooseDeterministicBoardOwner(nativeCandidates);
    if (!steadyState) continue;

    boardTilesByCoord.set(coordKey, {
      steadyState,
      candidateEntries: nativeCandidates,
      isIntersection: owners.length > 1,
      isGreenLocked: false,
    });
  }

  return { boardTilesByCoord, boardDiagnostics };
}

export function buildTileRevealMapFromBoardTiles(
  boardTilesByCoord: Map<string, BoardTile> | undefined,
  revealTargetIndex?: number | null,
  activeTargetIndex?: number | null,
): Map<string, TileRevealInfo> | undefined {
  if (!boardTilesByCoord || boardTilesByCoord.size === 0) {
    return undefined;
  }

  const map = new Map<string, TileRevealInfo>();

  for (const [coordKey, tile] of boardTilesByCoord.entries()) {
    const revealCandidate =
      revealTargetIndex != null
        ? tile.candidateEntries.find((entry) => entry.targetIndex === revealTargetIndex)
        : undefined;
    const revealEntry =
      tile.steadyState.code === 'G'
        ? (revealCandidate?.code === 'G'
            ? {
                ...tile.steadyState,
                targetIndex: revealCandidate.targetIndex,
                direction: revealCandidate.direction,
                positionInWord: revealCandidate.positionInWord,
              }
            : undefined)
        : revealCandidate;
    const activeEntry =
      tile.steadyState.code === 'G'
        ? undefined
        : (activeTargetIndex != null
            ? tile.candidateEntries.find((entry) => entry.targetIndex === activeTargetIndex)
            : undefined);
    const primaryEntry = revealEntry ?? activeEntry ?? tile.steadyState;

    map.set(coordKey, {
      letter: primaryEntry.letter,
      primaryTargetIndex: primaryEntry.targetIndex,
      primaryCode: primaryEntry.code,
      primaryDirection: primaryEntry.direction,
      positionInWord: primaryEntry.positionInWord,
      shouldAnimate: revealEntry != null,
      isLocked: false,
    });
  }

  return map;
}

/**
 * At an intersection tile, merge the primary word's raw feedback code with
 * knowledge of the crossing word's target.  This replaces the old stripe
 * system with a single merged code per tile.
 *
 * Rules:
 *   G → G  (always — correct in primary word)
 *   Y → Y  (already "in at least one of these two words")
 *   B → Y  if letter is in crossing word (in at least one word)
 *   B → B  otherwise (not in either word, but in puzzle)
 *   R → Y  if letter is in crossing word (smartBlue edge case)
 *   R → R  otherwise
 */
export function mergeIntersectionCode(
  primaryCode: string,
  letter: string,
  crossingTargetWord: string,
): string {
  if (primaryCode === 'G' || primaryCode === 'Y') return primaryCode;
  const inCrossing = crossingTargetWord.toUpperCase().includes(letter.toUpperCase());
  if (inCrossing) return 'Y';
  return primaryCode;
}

/**
 * Map from targetIndex → (positionInWord → crossingTargetIndex).
 * Only intersection positions are included.
 */
export type IntersectionMap = Map<number, Map<number, number>>;

/**
 * Build an intersection map from word slots.
 * For each target word, records which positions are intersections
 * and what the crossing target index is at each.
 */
export function buildIntersectionMap(
  wordSlots: { targetIndex: number; coords: number[][] }[],
): IntersectionMap {
  const coordToTargets = new Map<string, number[]>();
  for (const slot of wordSlots) {
    for (const [r, c] of slot.coords) {
      const key = `${r}:${c}`;
      const existing = coordToTargets.get(key) ?? [];
      existing.push(slot.targetIndex);
      coordToTargets.set(key, existing);
    }
  }

  const map: IntersectionMap = new Map();
  for (const slot of wordSlots) {
    const posMap = new Map<number, number>();
    for (let pos = 0; pos < slot.coords.length; pos++) {
      const [r, c] = slot.coords[pos];
      const key = `${r}:${c}`;
      const targets = coordToTargets.get(key) ?? [];
      const crossing = targets.find((t) => t !== slot.targetIndex);
      if (crossing != null) {
        posMap.set(pos, crossing);
      }
    }
    if (posMap.size > 0) {
      map.set(slot.targetIndex, posMap);
    }
  }
  return map;
}

/**
 * Extended intersection map that also carries the position in the crossing word.
 */
export type FullIntersectionEntry = {
  crossingTargetIndex: number;
  crossingPosition: number;
};
export type FullIntersectionMap = Map<number, Map<number, FullIntersectionEntry>>;

export function buildFullIntersectionMap(
  wordSlots: { targetIndex: number; coords: number[][] }[],
): FullIntersectionMap {
  // coord → list of { targetIndex, posInWord }
  const coordToSlots = new Map<string, { targetIndex: number; pos: number }[]>();
  for (const slot of wordSlots) {
    for (let pos = 0; pos < slot.coords.length; pos++) {
      const [r, c] = slot.coords[pos];
      const key = `${r}:${c}`;
      const existing = coordToSlots.get(key) ?? [];
      existing.push({ targetIndex: slot.targetIndex, pos });
      coordToSlots.set(key, existing);
    }
  }

  const map: FullIntersectionMap = new Map();
  for (const slot of wordSlots) {
    const posMap = new Map<number, FullIntersectionEntry>();
    for (let pos = 0; pos < slot.coords.length; pos++) {
      const [r, c] = slot.coords[pos];
      const key = `${r}:${c}`;
      const others = coordToSlots.get(key) ?? [];
      const crossing = others.find((o) => o.targetIndex !== slot.targetIndex);
      if (crossing) {
        posMap.set(pos, {
          crossingTargetIndex: crossing.targetIndex,
          crossingPosition: crossing.pos,
        });
      }
    }
    if (posMap.size > 0) {
      map.set(slot.targetIndex, posMap);
    }
  }
  return map;
}

/**
 * Build compacted cross-history entries for crossing words.
 * Intersection evidence for a given crossing target is packed into as few
 * sparse rows as possible without collapsing conflicting letters at the same
 * position. Non-overlapping shadow cells can share a row; conflicting cells
 * stay in separate shadow rows. These rows are prepended to the real history
 * so submitted full-word guesses keep their existing order below.
 */
export function buildCrossHistoryEntries(
  rawHistoryByTarget: Map<number, { guess: string; codes: string[] }[]>,
  fullIntersectionMap: FullIntersectionMap,
  wordSlots: { targetIndex: number; coords: number[][]; length: number }[],
): Map<number, { guess: string; codes: string[] }[]> {
  type ShadowRow = { letters: string[]; codes: string[] };
  const codePriority: Record<string, number> = {
    _: 0,
    R: 1,
    B: 2,
    Y: 3,
    G: 4,
  };

  const lengthByTarget = new Map<number, number>();
  for (const slot of wordSlots) {
    lengthByTarget.set(slot.targetIndex, slot.length);
  }

  const makeEmptyShadowRow = (wordLen: number): ShadowRow => ({
    letters: Array(wordLen).fill(' '),
    codes: Array(wordLen).fill('_'),
  });

  const canMergeIntoRow = (
    row: ShadowRow,
    fragmentLetters: string[],
    fragmentCodes: string[],
  ): boolean => {
    for (let i = 0; i < fragmentCodes.length; i++) {
      const nextCode = fragmentCodes[i];
      if (nextCode === '_') continue;

      const rowCode = row.codes[i];
      const nextLetter = fragmentLetters[i];
      const rowLetter = row.letters[i];

      if (rowCode === '_') continue;
      if (rowLetter === nextLetter) continue;
      return false;
    }
    return true;
  };

  const mergeFragmentIntoRow = (
    row: ShadowRow,
    fragmentLetters: string[],
    fragmentCodes: string[],
  ): void => {
    for (let i = 0; i < fragmentCodes.length; i++) {
      const nextCode = fragmentCodes[i];
      if (nextCode === '_') continue;

      if (row.codes[i] === '_' || row.letters[i] === ' ') {
        row.letters[i] = fragmentLetters[i];
        row.codes[i] = nextCode;
        continue;
      }

      if (row.letters[i] !== fragmentLetters[i]) continue;

      if ((codePriority[nextCode] ?? 0) > (codePriority[row.codes[i]] ?? 0)) {
        row.codes[i] = nextCode;
      }
    }
  };

  // Pack shadow evidence per crossing target in stable history order.
  const accumulated = new Map<number, ShadowRow[]>();

  for (const [targetIndex, entries] of rawHistoryByTarget.entries()) {
    const posMap = fullIntersectionMap.get(targetIndex);
    if (!posMap || posMap.size === 0) continue;

    for (const entry of entries) {
      const fragmentsByCrossTarget = new Map<number, ShadowRow>();

      for (const [pos, crossing] of posMap.entries()) {
        if (pos >= entry.guess.length || pos >= entry.codes.length) continue;
        const letter = entry.guess[pos];
        const code = entry.codes[pos];
        if (!letter || !code) continue;

        const wordLen = lengthByTarget.get(crossing.crossingTargetIndex) ?? 0;
        if (wordLen === 0 || crossing.crossingPosition >= wordLen) continue;

        if (!fragmentsByCrossTarget.has(crossing.crossingTargetIndex)) {
          fragmentsByCrossTarget.set(crossing.crossingTargetIndex, makeEmptyShadowRow(wordLen));
        }

        const fragment = fragmentsByCrossTarget.get(crossing.crossingTargetIndex)!;
        fragment.letters[crossing.crossingPosition] = letter;
        fragment.codes[crossing.crossingPosition] = code;
      }

      for (const [crossTargetIndex, fragment] of fragmentsByCrossTarget.entries()) {
        if (!fragment.codes.some((cellCode) => cellCode !== '_')) continue;

        if (!accumulated.has(crossTargetIndex)) {
          accumulated.set(crossTargetIndex, []);
        }

        const packedRows = accumulated.get(crossTargetIndex)!;
        const compatibleRow = packedRows.find((row) =>
          canMergeIntoRow(row, fragment.letters, fragment.codes)
        );

        if (compatibleRow) {
          mergeFragmentIntoRow(compatibleRow, fragment.letters, fragment.codes);
          continue;
        }

        const newRow = makeEmptyShadowRow(fragment.codes.length);
        mergeFragmentIntoRow(newRow, fragment.letters, fragment.codes);
        packedRows.push(newRow);
      }
    }
  }

  const result = new Map<number, { guess: string; codes: string[] }[]>();
  for (const [crossTargetIndex, packedRows] of accumulated.entries()) {
    const entriesForTarget = packedRows
      .filter((row) => row.codes.some((cellCode) => cellCode !== '_'))
      .map((row) => ({
        guess: row.letters.join(''),
        codes: row.codes,
      }));

    if (entriesForTarget.length > 0) {
      result.set(crossTargetIndex, entriesForTarget);
    }
  }
  return result;
}

/**
 * Wraps buildCrossHistoryEntries, excluding contributions from a single source
 * target so that cross-history doesn't leak while a reveal animation is in flight.
 * Pass `null` to disable the gate (pass-through).
 */
export function buildGatedCrossHistoryEntries(
  rawHistoryByTarget: Map<number, { guess: string; codes: string[] }[]>,
  fullIntersectionMap: FullIntersectionMap,
  wordSlots: { targetIndex: number; coords: number[][]; length: number }[],
  blockedSourceTarget: number | null,
): Map<number, { guess: string; codes: string[] }[]> {
  if (blockedSourceTarget == null) {
    return buildCrossHistoryEntries(rawHistoryByTarget, fullIntersectionMap, wordSlots);
  }
  const filtered = new Map(rawHistoryByTarget);
  filtered.delete(blockedSourceTarget);
  return buildCrossHistoryEntries(filtered, fullIntersectionMap, wordSlots);
}

/**
 * Convenience view of the intersection map for UI rendering.
 * Each target gets the set of local positions that land on shared board cells.
 */
export function buildIntersectionPositionsByTarget(
  wordSlots: { targetIndex: number; coords: number[][] }[],
): Map<number, Set<number>> {
  const intersectionMap = buildIntersectionMap(wordSlots);
  const result = new Map<number, Set<number>>();

  for (const [targetIndex, positionMap] of intersectionMap.entries()) {
    result.set(targetIndex, new Set(positionMap.keys()));
  }

  return result;
}

/**
 * Apply mergeIntersectionCode to reconciled history at intersection positions.
 * Returns a new history map with merged codes — both board tiles and history
 * rows consume the result for consistent cross-cell feedback.
 */
export function applyIntersectionMerge<T extends { guess: string; codes: string[] }>(
  historyByTarget: Map<number, T[]>,
  intersectionMap: IntersectionMap,
  targetWords: string[],
): Map<number, T[]> {
  const merged = new Map<number, T[]>();

  for (const [targetIndex, entries] of historyByTarget.entries()) {
    const posMap = intersectionMap.get(targetIndex);
    if (!posMap || posMap.size === 0) {
      merged.set(targetIndex, entries);
      continue;
    }

    merged.set(
      targetIndex,
      entries.map((entry) => {
        const mergedCodes = entry.codes.map((code, pos) => {
          const crossingTargetIndex = posMap.get(pos);
          if (crossingTargetIndex == null) return code;
          const crossingWord = targetWords[crossingTargetIndex];
          if (!crossingWord) return code;
          return mergeIntersectionCode(code, entry.guess[pos] ?? '', crossingWord);
        });
        return { ...entry, codes: mergedCodes };
      }),
    );
  }

  return merged;
}

export function buildTileRevealMapFromDisplayGuess(
  displayGuessByTarget: DisplayGuessByTarget,
  coordToSegmentPosition: Map<string, { segmentIndex: number; positionInWord: number }[]>,
  slotIndexToTargetIndex: Map<number, number>,
  canonicalSlots: CanonicalBoardSlot[],
  activeTargetIndex?: number | null,
  revealTargetIndex?: number | null,
): Map<string, TileRevealInfo> | undefined {
  const map = new Map<string, TileRevealInfo>();

  for (const [coordKey, positions] of coordToSegmentPosition.entries()) {
    type Entry = {
      code: string;
      direction: 'A' | 'D';
      letter: string;
      posInWord: number;
      targetIndex: number;
      locked: boolean;
    };

    const entries: Entry[] = [];

    for (const { segmentIndex, positionInWord } of positions) {
      const targetIdx = slotIndexToTargetIndex.get(segmentIndex);
      if (targetIdx == null) continue;

      const displayGuess = displayGuessByTarget[targetIdx];
      if (!displayGuess || positionInWord >= displayGuess.guess.length) continue;

      const letter = displayGuess.guess[positionInWord];
      const code = (displayGuess.codes[positionInWord] ?? '').toUpperCase();
      if (!letter || !letter.trim() || !code || code === '_') continue;

      entries.push({
        code,
        direction: canonicalSlots[segmentIndex]?.direction ?? 'A',
        letter,
        posInWord: positionInWord,
        targetIndex: targetIdx,
        locked: displayGuess.locked,
      });
    }

    if (entries.length === 0) continue;

    // During an active reveal, prefer the revealing word's entry at intersections
    // so cross-populated letters flip in sync rather than popping in instantly.
    const primaryEntry =
      entries.find((entry) => entry.code === 'G') ??
      (revealTargetIndex != null
        ? entries.find((entry) => entry.targetIndex === revealTargetIndex)
        : undefined) ??
      entries.find((entry) => entry.targetIndex === activeTargetIndex) ??
      entries.find((entry) => entry.direction === 'A') ??
      entries[0];

    map.set(coordKey, {
      letter: primaryEntry.letter,
      primaryTargetIndex: primaryEntry.targetIndex,
      primaryCode: primaryEntry.code,
      primaryDirection: primaryEntry.direction,
      positionInWord: primaryEntry.posInWord,
      shouldAnimate: primaryEntry.targetIndex === revealTargetIndex,
      isLocked: primaryEntry.locked,
    });
  }

  return map.size > 0 ? map : undefined;
}
