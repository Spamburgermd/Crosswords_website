import { buildCardDisplayState } from './cardDisplayState';
import type { GuessViewStateByTarget } from './guessDisplayState';
import type { CanonicalWordSnapshot } from './boardHistoryPipeline';

type Entry = {
  guess: string;
  codes: string[];
  rowId: string;
  provenance: 'native' | 'shadow';
  rawCodes?: string[];
  nativeSourceIndex: number | null;
};

function buildMap(entries: Record<number, Entry[]>): Map<number, Entry[]> {
  return new Map<number, Entry[]>(
    Object.entries(entries).map(([targetIndex, guesses]) => [Number(targetIndex), guesses]),
  );
}

function buildWordSnapshots(
  nativeHistoryByTarget: Map<number, Entry[]>,
  shadowHistoryByTarget: Map<number, Entry[]>,
): Map<number, CanonicalWordSnapshot & { nativeHistoryRows: Entry[]; shadowHistoryRows: Entry[] }> {
  const targetIndexes = new Set<number>([
    ...nativeHistoryByTarget.keys(),
    ...shadowHistoryByTarget.keys(),
  ]);

  const snapshots = new Map<number, CanonicalWordSnapshot & { nativeHistoryRows: Entry[]; shadowHistoryRows: Entry[] }>();
  for (const targetIndex of targetIndexes) {
    const nativeHistoryRows = nativeHistoryByTarget.get(targetIndex) ?? [];
    const shadowHistoryRows = shadowHistoryByTarget.get(targetIndex) ?? [];
    const latestNativeRow =
      nativeHistoryRows.length > 0
        ? {
            ...nativeHistoryRows[nativeHistoryRows.length - 1],
            sourceIndex: nativeHistoryRows.length - 1,
            locked: false,
          }
        : null;
    snapshots.set(targetIndex, {
      targetIndex,
      latestLiteralGuess: latestNativeRow?.guess ?? null,
      latestMergedCodes: latestNativeRow?.codes ?? null,
      confirmedGreensByPosition: {},
      nativeHistoryRows,
      shadowHistoryRows,
      latestNativeRow,
    });
  }

  return snapshots;
}

describe('buildCardDisplayState', () => {
  const wordSlots = [
    { targetIndex: 0, coords: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] as number[][] },
    { targetIndex: 1, coords: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] as number[][] },
  ];

  beforeEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  });

  it('keeps the latest native row selected when a shadow row conflicts with it', () => {
    const nativeHistoryByTarget = buildMap({
      0: [{ guess: 'HORNS', codes: ['G', 'R', 'R', 'G', 'R'], rowId: 'native:0:0', provenance: 'native', nativeSourceIndex: 0 }],
    });
    const shadowHistoryByTarget = buildMap({
      0: [{ guess: 'N    ', codes: ['Y', '_', '_', '_', '_'], rowId: 'shadow:0:0', provenance: 'shadow', nativeSourceIndex: null }],
    });

    const result = buildCardDisplayState({
      wordSnapshotsByTarget: buildWordSnapshots(nativeHistoryByTarget, shadowHistoryByTarget),
      guessViewStateByTarget: {
        0: {
          previewIndex: null,
          lockedIndex: null,
          previewRowId: 'shadow:0:0',
          lockedRowId: 'shadow:0:0',
        },
      },
      selectedTargetIndex: 0,
      confirmedBoardLettersByCoord: new Map([['0:0', 'H']]),
      wordSlots,
      strictInvalidViewState: false,
    });

    expect(result.selectedNativeGuessByTarget[0]).toMatchObject({
      guess: 'HORNS',
      locked: false,
    });
    expect(result.detailRowsForSelectedTarget).toEqual([
      expect.objectContaining({
        rowId: 'shadow:0:0',
        kind: 'shadow',
        interactive: false,
        isPreviewed: false,
        isLocked: false,
      }),
      expect.objectContaining({
        rowId: 'native:0:0',
        kind: 'native',
        interactive: true,
        isPreviewed: false,
        isLocked: false,
      }),
    ]);
    expect(result.greenPlaceholdersByTarget[0]).toEqual({ 0: 'H' });
    expect(result.diagnostics).toEqual([
      'Card detail rows cannot mark shadow row "shadow:0:0" as previewed for target 0.',
      'Card detail rows cannot mark shadow row "shadow:0:0" as locked for target 0.',
      'Card display state cannot preview shadow row "shadow:0:0" for target 0.',
      'Card display state cannot lock shadow row "shadow:0:0" for target 0.',
    ]);
  });

  it('allows preview and lock only for native rows', () => {
    const nativeHistoryByTarget = buildMap({
      0: [
        { guess: 'SHARP', codes: ['R', 'R', 'R', 'R', 'R'], rowId: 'native:0:0', provenance: 'native', nativeSourceIndex: 0 },
        { guess: 'HEART', codes: ['G', 'R', 'R', 'R', 'R'], rowId: 'native:0:1', provenance: 'native', nativeSourceIndex: 1 },
      ],
    });
    const shadowHistoryByTarget = buildMap({
      0: [{ guess: 'N    ', codes: ['Y', '_', '_', '_', '_'], rowId: 'shadow:0:0', provenance: 'shadow', nativeSourceIndex: null }],
    });
    const guessViewStateByTarget: GuessViewStateByTarget = {
      0: {
        previewIndex: null,
        lockedIndex: null,
        previewRowId: 'native:0:0',
        lockedRowId: 'native:0:1',
      },
    };

    const result = buildCardDisplayState({
      wordSnapshotsByTarget: buildWordSnapshots(nativeHistoryByTarget, shadowHistoryByTarget),
      guessViewStateByTarget,
      selectedTargetIndex: 0,
      confirmedBoardLettersByCoord: new Map(),
      wordSlots,
      strictInvalidViewState: true,
    });

    expect(result.selectedNativeGuessByTarget[0]).toMatchObject({
      guess: 'HEART',
      locked: true,
    });
    expect(result.detailRowsForSelectedTarget).toEqual([
      expect.objectContaining({ rowId: 'shadow:0:0', interactive: false, isPreviewed: false, isLocked: false }),
      expect.objectContaining({ rowId: 'native:0:0', interactive: true, isPreviewed: true, isLocked: false }),
      expect.objectContaining({ rowId: 'native:0:1', interactive: true, isPreviewed: false, isLocked: true }),
    ]);
  });

  it('surfaces the latest literal native guess for the selected word without borrowing crossing letters', () => {
    const result = buildCardDisplayState({
      wordSnapshotsByTarget: buildWordSnapshots(
        buildMap({
          0: [{ guess: 'HOPE', codes: ['R', 'R', 'R', 'R'], rowId: 'native:0:0', provenance: 'native', nativeSourceIndex: 0 }],
          1: [{ guess: 'HOUSE', codes: ['R', 'R', 'R', 'R', 'R'], rowId: 'native:1:0', provenance: 'native', nativeSourceIndex: 0 }],
        }),
        buildMap({
          0: [{ guess: ' U  ', codes: ['_', 'Y', '_', '_'], rowId: 'shadow:0:0', provenance: 'shadow', nativeSourceIndex: null }],
        }),
      ),
      guessViewStateByTarget: {},
      selectedTargetIndex: 0,
      confirmedBoardLettersByCoord: new Map(),
      wordSlots,
      strictInvalidViewState: true,
    });

    expect(result.selectedNativeGuessByTarget[0]).toMatchObject({
      guess: 'HOPE',
      codes: ['R', 'R', 'R', 'R'],
    });
    expect(result.detailRowsForSelectedTarget).toEqual([
      expect.objectContaining({ rowId: 'shadow:0:0', interactive: false }),
      expect.objectContaining({ rowId: 'native:0:0', guess: 'HOPE', interactive: true }),
    ]);
  });

  it('returns null selected state when a target has only shadow rows', () => {
    const result = buildCardDisplayState({
      wordSnapshotsByTarget: buildWordSnapshots(
        buildMap({}),
        buildMap({
          0: [{ guess: 'N    ', codes: ['Y', '_', '_', '_', '_'], rowId: 'shadow:0:0', provenance: 'shadow', nativeSourceIndex: null }],
        }),
      ),
      guessViewStateByTarget: {},
      selectedTargetIndex: 0,
      confirmedBoardLettersByCoord: new Map(),
      wordSlots,
      strictInvalidViewState: true,
    });

    expect(result.selectedNativeGuessByTarget[0]).toBeNull();
    expect(result.detailRowsForSelectedTarget).toEqual([
      expect.objectContaining({
        rowId: 'shadow:0:0',
        kind: 'shadow',
        interactive: false,
      }),
    ]);
  });

  it('fails fast in strict mode when a stored card view references a shadow row', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(() =>
      buildCardDisplayState({
        wordSnapshotsByTarget: buildWordSnapshots(
          buildMap({
            0: [{ guess: 'HORNS', codes: ['G', 'R', 'R', 'G', 'R'], rowId: 'native:0:0', provenance: 'native', nativeSourceIndex: 0 }],
          }),
          buildMap({
            0: [{ guess: 'N    ', codes: ['Y', '_', '_', '_', '_'], rowId: 'shadow:0:0', provenance: 'shadow', nativeSourceIndex: null }],
          }),
        ),
        guessViewStateByTarget: {
          0: {
            previewIndex: null,
            lockedIndex: null,
            previewRowId: 'shadow:0:0',
            lockedRowId: null,
          },
        },
        selectedTargetIndex: 0,
        confirmedBoardLettersByCoord: new Map(),
        wordSlots,
      }),
    ).toThrow('Card detail rows cannot mark shadow row "shadow:0:0" as previewed for target 0.');
  });

  it('builds detail rows only for the selected target', () => {
    const result = buildCardDisplayState({
      wordSnapshotsByTarget: buildWordSnapshots(
        buildMap({
          0: [{ guess: 'HORNS', codes: ['G', 'R', 'R', 'G', 'R'], rowId: 'native:0:0', provenance: 'native', nativeSourceIndex: 0 }],
          1: [{ guess: 'HEART', codes: ['R', 'R', 'R', 'R', 'R'], rowId: 'native:1:0', provenance: 'native', nativeSourceIndex: 0 }],
        }),
        buildMap({
          1: [{ guess: 'A    ', codes: ['Y', '_', '_', '_', '_'], rowId: 'shadow:1:0', provenance: 'shadow', nativeSourceIndex: null }],
        }),
      ),
      guessViewStateByTarget: {
        1: {
          previewIndex: null,
          lockedIndex: null,
          previewRowId: 'shadow:1:0',
          lockedRowId: null,
        },
      },
      selectedTargetIndex: 0,
      confirmedBoardLettersByCoord: new Map(),
      wordSlots,
      strictInvalidViewState: false,
    });

    expect(result.detailRowsForSelectedTarget).toEqual([
      expect.objectContaining({ rowId: 'native:0:0', interactive: true }),
    ]);
    expect(result.diagnostics).toEqual([
      'Card display state cannot preview shadow row "shadow:1:0" for target 1.',
    ]);
    expect(result.selectedNativeGuessByTarget[1]).toMatchObject({
      guess: 'HEART',
      locked: false,
    });
  });
});
