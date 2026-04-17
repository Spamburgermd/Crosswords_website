/**
 * src/lib/boardHistoryPipeline.ts
 * ---------------------------------------------
 * Shared pure history pipeline for the live board.
 *
 * Purpose:
 * - keep cross-history compaction aligned with the board's merged feedback
 * - make the ordering testable outside of React / BoardScreen state
 *
 * Flow:
 * 1. Build baseline confirmed greens from raw history + solved words.
 * 2. Reconcile raw history.
 * 3. Apply intersection merge to that reconciled history.
 * 4. Build gated compact cross-history from the merged history.
 * 5. Prepend compact rows to the merged history.
 * 6. Recompute confirmed greens from the enriched merged history.
 * 7. Run a final reconcile + intersection merge pass for the display layer.
 */

import { reconcileEvidenceFeedback, type FeedbackGuessEntry } from './evidenceFeedback';
import {
  applyIntersectionMerge,
  buildBoardTilesByCoord,
  buildGatedCrossHistoryEntries,
  type BoardTile,
  type FullIntersectionMap,
  type IntersectionMap,
} from './boardRevealMap';
import {
  type DisplayGuessByTarget,
  type DisplayGuessSnapshot,
} from './guessDisplayState';

export type Provenance = 'native' | 'shadow';

export type ProvenancedEntry = FeedbackGuessEntry & {
  provenance: Provenance;
  rowId: string;
  nativeSourceIndex: number | null;
  rawCodes?: string[];
};

export type CanonicalWordSnapshot = {
  targetIndex: number;
  latestLiteralGuess: string | null;
  latestMergedCodes: string[] | null;
  confirmedGreensByPosition: Record<number, string>;
  nativeHistoryRows: ProvenancedEntry[];
  shadowHistoryRows: ProvenancedEntry[];
  latestNativeRow: DisplayGuessSnapshot<ProvenancedEntry> | null;
};

export type SplitHistoryResult = {
  wordSnapshotsByTarget: Map<number, CanonicalWordSnapshot>;
  shadowHistoryByTarget: Map<number, ProvenancedEntry[]>;
  combinedHistoryByTarget: Map<number, ProvenancedEntry[]>;
  /** Coordinate truth for hard board locks, derived from raw greens + solved words only. */
  confirmedBoardLettersByCoord: Map<string, string>;
  /** Canonical steady-state board tile state keyed by coordinate. */
  boardTilesByCoord: Map<string, BoardTile>;
  /** Non-fatal diagnostics emitted only when production does not fail fast. */
  boardDiagnostics: string[];
};

export type BoardHistoryWordSlot = {
  targetIndex: number;
  coords: number[][];
  length: number;
};

type BoardHistoryArgs = {
  rawHistoryByTarget: Map<number, FeedbackGuessEntry[]>;
  wordSlots: BoardHistoryWordSlot[];
  targetWords?: string[] | null;
  solvedFlags?: boolean[];
  intersectionMap: IntersectionMap;
  fullIntersectionMap: FullIntersectionMap;
  blockedSourceTarget: number | null;
};

function normalizeCode(code: string | undefined): string {
  return ((code ?? '')[0] ?? '').toUpperCase();
}

function normalizeLiteralEntry(entry: FeedbackGuessEntry): FeedbackGuessEntry {
  return {
    guess: String(entry.guess ?? '').toUpperCase(),
    codes: (entry.codes ?? []).map((code) => normalizeCode(code)),
  };
}

function buildConfirmedLettersByTargetFromCoordMap(
  coordToConfirmedLetter: Map<string, string>,
  wordSlots: BoardHistoryWordSlot[],
): Record<number, Record<number, string>> {
  const confirmedByTarget: Record<number, Record<number, string>> = {};
  for (const slot of wordSlots) {
    for (let i = 0; i < slot.coords.length; i++) {
      const [row, col] = slot.coords[i] ?? [];
      const letter = coordToConfirmedLetter.get(`${row}:${col}`);
      if (!letter) continue;
      if (!confirmedByTarget[slot.targetIndex]) confirmedByTarget[slot.targetIndex] = {};
      confirmedByTarget[slot.targetIndex]![i] = letter;
    }
  }

  return confirmedByTarget;
}

function buildConfirmedBoardLettersByCoord(
  historyByTarget: Map<number, FeedbackGuessEntry[]>,
  wordSlots: BoardHistoryWordSlot[],
  solvedFlags: boolean[],
  targetWords: string[],
): Map<string, string> {
  const coordToConfirmedLetter = new Map<string, string>();

  for (const slot of wordSlots) {
    const entries = historyByTarget.get(slot.targetIndex) ?? [];
    for (const entry of entries) {
      const guess = (entry.guess ?? '').toUpperCase();
      const codes = entry.codes ?? [];
      const len = Math.min(slot.coords.length, guess.length, codes.length);
      for (let i = 0; i < len; i++) {
        if ((codes[i] ?? '').toUpperCase() !== 'G') continue;
        const [row, col] = slot.coords[i] ?? [];
        const letter = guess[i];
        if (!Number.isInteger(row) || !Number.isInteger(col) || !letter) continue;
        coordToConfirmedLetter.set(`${row}:${col}`, letter);
      }
    }

    if (solvedFlags[slot.targetIndex] && targetWords[slot.targetIndex]) {
      const solvedWord = targetWords[slot.targetIndex]!.toUpperCase();
      const len = Math.min(slot.coords.length, solvedWord.length);
      for (let i = 0; i < len; i++) {
        const [row, col] = slot.coords[i] ?? [];
        const letter = solvedWord[i];
        if (!Number.isInteger(row) || !Number.isInteger(col) || !letter) continue;
        coordToConfirmedLetter.set(`${row}:${col}`, letter);
      }
    }
  }

  return coordToConfirmedLetter;
}

function buildConfirmedLettersByTarget(
  historyByTarget: Map<number, FeedbackGuessEntry[]>,
  wordSlots: BoardHistoryWordSlot[],
  solvedFlags: boolean[],
  targetWords: string[],
): Record<number, Record<number, string>> {
  return buildConfirmedLettersByTargetFromCoordMap(
    buildConfirmedBoardLettersByCoord(historyByTarget, wordSlots, solvedFlags, targetWords),
    wordSlots,
  );
}

function prependCrossHistory(
  mergedHistoryByTarget: Map<number, FeedbackGuessEntry[]>,
  crossEntries: Map<number, FeedbackGuessEntry[]>,
): Map<number, FeedbackGuessEntry[]> {
  if (crossEntries.size === 0) {
    return new Map(mergedHistoryByTarget);
  }

  const next = new Map<number, FeedbackGuessEntry[]>();

  for (const [targetIndex, entries] of mergedHistoryByTarget.entries()) {
    next.set(targetIndex, [...entries]);
  }

  for (const [targetIndex, shadowEntries] of crossEntries.entries()) {
    const existing = next.get(targetIndex) ?? [];
    next.set(targetIndex, [...shadowEntries, ...existing]);
  }

  return next;
}

function normalizeLiteralHistoryByTarget(
  rawHistoryByTarget: Map<number, FeedbackGuessEntry[]>,
  wordSlots: BoardHistoryWordSlot[],
): Map<number, ProvenancedEntry[]> {
  const normalized = new Map<number, ProvenancedEntry[]>();

  for (const [targetIndex, entries] of rawHistoryByTarget.entries()) {
    normalized.set(
      targetIndex,
      (entries ?? []).map((entry, nativeSourceIndex) => {
        const normalizedEntry = normalizeLiteralEntry(entry);
        return {
          ...normalizedEntry,
          rawCodes: [...normalizedEntry.codes],
          provenance: 'native' as Provenance,
          rowId: `native:${targetIndex}:${nativeSourceIndex}`,
          nativeSourceIndex,
        };
      }),
    );
  }

  for (const slot of wordSlots) {
    if (!normalized.has(slot.targetIndex)) {
      normalized.set(slot.targetIndex, []);
    }
  }

  return normalized;
}

function buildLatestNativeRow(
  nativeHistoryRows: ProvenancedEntry[],
): DisplayGuessSnapshot<ProvenancedEntry> | null {
  if (nativeHistoryRows.length === 0) {
    return null;
  }

  const sourceIndex = nativeHistoryRows.length - 1;
  return {
    ...nativeHistoryRows[sourceIndex],
    sourceIndex,
    locked: false,
  };
}

/**
 * Build the final board-visible merged history for the live game screen.
 */
export function buildBoardMergedHistory(args: BoardHistoryArgs) {
  const targetWords = (args.targetWords ?? []).map((word) => String(word ?? '').toUpperCase());
  const solvedFlags = args.solvedFlags ?? [];

  const baselineConfirmedLetters = buildConfirmedLettersByTarget(
    args.rawHistoryByTarget,
    args.wordSlots,
    solvedFlags,
    targetWords,
  );

  const baselineReconciled = reconcileEvidenceFeedback({
    targetWords,
    historyByTarget: args.rawHistoryByTarget,
    confirmedLettersByTarget: baselineConfirmedLetters,
  });

  const baselineMerged =
    targetWords.length > 0
      ? applyIntersectionMerge(
          baselineReconciled.historyByTarget,
          args.intersectionMap,
          targetWords,
        )
      : baselineReconciled.historyByTarget;

  const crossEntries = buildGatedCrossHistoryEntries(
    baselineMerged,
    args.fullIntersectionMap,
    args.wordSlots,
    args.blockedSourceTarget,
  );

  const enrichedMergedHistory = prependCrossHistory(baselineMerged, crossEntries);

  const enrichedConfirmedLetters = buildConfirmedLettersByTarget(
    enrichedMergedHistory,
    args.wordSlots,
    solvedFlags,
    targetWords,
  );

  const finalReconciled = reconcileEvidenceFeedback({
    targetWords,
    historyByTarget: enrichedMergedHistory,
    confirmedLettersByTarget: enrichedConfirmedLetters,
  });

  return targetWords.length > 0
    ? applyIntersectionMerge(
        finalReconciled.historyByTarget,
        args.intersectionMap,
        targetWords,
      )
    : finalReconciled.historyByTarget;
}

/**
 * Build split history with provenance tagging.
 *
 * Returns separate native, shadow, and combined views of per-target history.
 * Native history contains only the player's submitted guesses (reconciled + merged).
 * Shadow history contains only cross-word compacted rows.
 * Combined history is shadow prepended before native (matches legacy buildBoardMergedHistory).
 */
export function buildBoardSplitHistory(
  args: BoardHistoryArgs,
): SplitHistoryResult {
  const targetWords = (args.targetWords ?? []).map((word) => String(word ?? '').toUpperCase());
  const solvedFlags = args.solvedFlags ?? [];
  const literalNativeHistoryByTarget = normalizeLiteralHistoryByTarget(
    args.rawHistoryByTarget,
    args.wordSlots,
  );
  const confirmedBoardLettersByCoord = buildConfirmedBoardLettersByCoord(
    args.rawHistoryByTarget,
    args.wordSlots,
    solvedFlags,
    targetWords,
  );

  // Step 1-3: reconcile + intersection merge on raw native history
  const baselineConfirmedLetters = buildConfirmedLettersByTargetFromCoordMap(
    confirmedBoardLettersByCoord,
    args.wordSlots,
  );

  const baselineReconciled = reconcileEvidenceFeedback({
    targetWords,
    historyByTarget: args.rawHistoryByTarget,
    confirmedLettersByTarget: baselineConfirmedLetters,
  });

  const baselineMerged =
    targetWords.length > 0
      ? applyIntersectionMerge(
          baselineReconciled.historyByTarget,
          args.intersectionMap,
          targetWords,
        )
      : baselineReconciled.historyByTarget;

  // Step 4: build cross-history entries (shadow rows)
  const crossEntries = buildGatedCrossHistoryEntries(
    baselineMerged,
    args.fullIntersectionMap,
    args.wordSlots,
    args.blockedSourceTarget,
  );

  // Step 5: prepend and run final reconcile pass for combined output
  const enrichedMergedHistory = prependCrossHistory(baselineMerged, crossEntries);

  const enrichedConfirmedLetters = buildConfirmedLettersByTarget(
    enrichedMergedHistory,
    args.wordSlots,
    solvedFlags,
    targetWords,
  );

  const finalReconciled = reconcileEvidenceFeedback({
    targetWords,
    historyByTarget: enrichedMergedHistory,
    confirmedLettersByTarget: enrichedConfirmedLetters,
  });

  const finalMerged =
    targetWords.length > 0
      ? applyIntersectionMerge(
          finalReconciled.historyByTarget,
          args.intersectionMap,
          targetWords,
        )
      : finalReconciled.historyByTarget;

  const shadowHistoryByTarget = new Map<number, ProvenancedEntry[]>();
  const combinedHistoryByTarget = new Map<number, ProvenancedEntry[]>();
  const wordSnapshotsByTarget = new Map<number, CanonicalWordSnapshot>();
  const latestNativeRowByTarget: DisplayGuessByTarget<ProvenancedEntry> = {};
  const confirmedGreensByTarget = buildConfirmedLettersByTargetFromCoordMap(
    confirmedBoardLettersByCoord,
    args.wordSlots,
  );
  const targetIndexes = new Set<number>();

  for (const slot of args.wordSlots) {
    targetIndexes.add(slot.targetIndex);
  }
  for (const targetIndex of literalNativeHistoryByTarget.keys()) {
    targetIndexes.add(targetIndex);
  }
  for (const targetIndex of finalMerged.keys()) {
    targetIndexes.add(targetIndex);
  }
  for (const targetIndex of crossEntries.keys()) {
    targetIndexes.add(targetIndex);
  }

  for (const targetIndex of targetIndexes) {
    const literalRows = literalNativeHistoryByTarget.get(targetIndex) ?? [];
    const finalRows = finalMerged.get(targetIndex) ?? [];
    const shadowCount = crossEntries.get(targetIndex)?.length ?? 0;

    if (finalRows.length < shadowCount) {
      throw new Error(`Canonical word snapshot for target ${targetIndex} has fewer final rows than shadow rows.`);
    }

    const mergedShadowRows = finalRows.slice(0, shadowCount);
    const mergedNativeRows = finalRows.slice(shadowCount);
    if (mergedNativeRows.length !== literalRows.length) {
      throw new Error(
        `Canonical word snapshot for target ${targetIndex} has mismatched literal/native row counts (${literalRows.length} vs ${mergedNativeRows.length}).`,
      );
    }

    const nativeHistoryRows = literalRows.map((literalRow, nativeSourceIndex) => {
      const mergedRow = mergedNativeRows[nativeSourceIndex];
      if (!mergedRow) {
        throw new Error(`Missing merged native row ${nativeSourceIndex} for target ${targetIndex}.`);
      }
      if (mergedRow.codes.length !== literalRow.guess.length) {
        throw new Error(
          `Canonical word snapshot for target ${targetIndex} row ${nativeSourceIndex} has mismatched guess/code lengths (${literalRow.guess.length} vs ${mergedRow.codes.length}).`,
        );
      }
      return {
        ...mergedRow,
        guess: literalRow.guess,
        codes: mergedRow.codes.map((code) => normalizeCode(code)),
        rawCodes: (mergedRow.rawCodes ?? literalRow.rawCodes ?? literalRow.codes).map((code) => normalizeCode(code)),
        provenance: 'native' as Provenance,
        rowId: literalRow.rowId,
        nativeSourceIndex,
      };
    });

    const shadowHistoryRows = mergedShadowRows.map((entry, shadowSourceIndex) => ({
      ...entry,
      guess: String(entry.guess ?? '').toUpperCase(),
      codes: (entry.codes ?? []).map((code) => normalizeCode(code)),
      rawCodes: (entry.rawCodes ?? entry.codes ?? []).map((code) => normalizeCode(code)),
      provenance: 'shadow' as Provenance,
      rowId: `shadow:${targetIndex}:${shadowSourceIndex}`,
      nativeSourceIndex: null,
    }));

    shadowHistoryByTarget.set(targetIndex, shadowHistoryRows);
    combinedHistoryByTarget.set(targetIndex, [...shadowHistoryRows, ...nativeHistoryRows]);

    const latestNativeRow = buildLatestNativeRow(nativeHistoryRows);
    latestNativeRowByTarget[targetIndex] = latestNativeRow;

    wordSnapshotsByTarget.set(targetIndex, {
      targetIndex,
      latestLiteralGuess: latestNativeRow?.guess ?? null,
      latestMergedCodes: latestNativeRow?.codes ?? null,
      confirmedGreensByPosition: confirmedGreensByTarget[targetIndex] ?? {},
      nativeHistoryRows,
      shadowHistoryRows,
      latestNativeRow,
    });
  }

  const { boardTilesByCoord, boardDiagnostics } = buildBoardTilesByCoord(
    latestNativeRowByTarget,
    args.wordSlots,
    confirmedBoardLettersByCoord,
  );

  return {
    wordSnapshotsByTarget,
    shadowHistoryByTarget,
    combinedHistoryByTarget,
    confirmedBoardLettersByCoord,
    boardTilesByCoord,
    boardDiagnostics,
  };
}
