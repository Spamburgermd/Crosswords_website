import {
  clearGuessView,
  getDetailHistory,
  lockGuess,
  lockGuessByRowId,
  previewGuess,
  previewGuessByRowId,
  resolveDisplayGuessByTarget,
  resolveDisplayGuessForTarget,
  resolveLatestGuessByTarget,
  unlockGuess,
  type GuessHistoryByTarget,
  type GuessLike,
  type GuessViewStateByTarget,
} from './guessDisplayState';

function buildHistory(
  entries: Record<number, GuessLike[]>,
): GuessHistoryByTarget {
  return new Map<number, GuessLike[]>(
    Object.entries(entries).map(([targetIndex, guesses]) => [Number(targetIndex), guesses]),
  );
}

describe('guessDisplayState', () => {
  it('returns the latest guess when no preview or lock exists', () => {
    const history = buildHistory({
      0: [
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'] },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'] },
      ],
    });

    expect(resolveDisplayGuessForTarget(0, history, {})).toMatchObject({
      guess: 'BOLD',
      sourceIndex: 1,
      locked: false,
    });
  });

  it('previews an older guess without marking it locked', () => {
    const history = buildHistory({
      0: [
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'] },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'] },
      ],
    });

    const state = previewGuess({}, 0, 0);

    expect(resolveDisplayGuessForTarget(0, history, state)).toMatchObject({
      guess: 'COLD',
      sourceIndex: 0,
      locked: false,
    });
  });

  it('locking a guess pins that same preview', () => {
    const history = buildHistory({
      0: [
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'] },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'] },
      ],
    });

    const state = lockGuess({}, 0, 0);

    expect(resolveDisplayGuessForTarget(0, history, state)).toMatchObject({
      guess: 'COLD',
      sourceIndex: 0,
      locked: true,
    });
  });

  it('unlock keeps the previewed guess surfaced', () => {
    const history = buildHistory({
      0: [
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'] },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'] },
      ],
    });

    const lockedState = lockGuess({}, 0, 0);
    const unlockedState = unlockGuess(lockedState, 0);

    expect(resolveDisplayGuessForTarget(0, history, unlockedState)).toMatchObject({
      guess: 'COLD',
      sourceIndex: 0,
      locked: false,
    });
  });

  it('clearing the view after a new guess falls back to the newest history row', () => {
    const history = buildHistory({
      0: [
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'] },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'] },
        { guess: 'GOLD', codes: ['R', 'G', 'G', 'G'] },
      ],
    });

    const lockedState = lockGuess({}, 0, 0);
    const clearedState = clearGuessView(lockedState, 0);

    expect(resolveDisplayGuessForTarget(0, history, clearedState)).toMatchObject({
      guess: 'GOLD',
      sourceIndex: 2,
      locked: false,
    });
  });

  it('preserves different preview and lock state per target', () => {
    const history = buildHistory({
      0: [
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'] },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'] },
      ],
      1: [
        { guess: 'SAND', codes: ['G', 'R', 'R', 'R'] },
        { guess: 'BAND', codes: ['R', 'G', 'G', 'G'] },
      ],
    });

    let state: GuessViewStateByTarget = {};
    state = previewGuess(state, 0, 0);
    state = lockGuess(state, 1, 0);

    const displayGuessByTarget = resolveDisplayGuessByTarget(history, state);

    expect(displayGuessByTarget[0]).toMatchObject({ guess: 'COLD', locked: false });
    expect(displayGuessByTarget[1]).toMatchObject({ guess: 'SAND', locked: true });
  });

  it('resolves latest guesses without consulting preview or lock state', () => {
    const history = buildHistory({
      0: [
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'] },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'] },
      ],
      1: [
        { guess: 'SAND', codes: ['G', 'R', 'R', 'R'] },
        { guess: 'BAND', codes: ['R', 'G', 'G', 'G'] },
      ],
    });

    let state: GuessViewStateByTarget = {};
    state = previewGuess(state, 0, 0);
    state = lockGuess(state, 1, 0);

    const latestGuessByTarget = resolveLatestGuessByTarget(history);

    expect(latestGuessByTarget[0]).toMatchObject({ guess: 'BOLD', locked: false });
    expect(latestGuessByTarget[1]).toMatchObject({ guess: 'BAND', locked: false });
  });

  it('returns detail rows with source indexes and lock flags intact', () => {
    const history = buildHistory({
      0: [
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'] },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'] },
      ],
    });

    const state = lockGuess({}, 0, 0);
    const detailHistory = getDetailHistory(0, history, state);

    expect(detailHistory).toEqual([
      {
        guess: 'COLD',
        codes: ['R', 'R', 'G', 'G'],
        sourceIndex: 0,
        isPreviewed: true,
        isLocked: true,
      },
      {
        guess: 'BOLD',
        codes: ['G', 'R', 'G', 'G'],
        sourceIndex: 1,
        isPreviewed: false,
        isLocked: false,
      },
    ]);
  });

  it('resolves preview and lock by stable rowId when history order changes', () => {
    const originalHistory = buildHistory({
      0: [
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'], rowId: 'native:0:0' },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'], rowId: 'native:0:1' },
      ],
    });
    const reorderedHistory = buildHistory({
      0: [
        { guess: 'SHDW', codes: ['Y', '_', '_', '_'], rowId: 'shadow:0:0' },
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'], rowId: 'native:0:0' },
        { guess: 'BOLD', codes: ['G', 'R', 'G', 'G'], rowId: 'native:0:1' },
      ],
    });

    const previewState = previewGuessByRowId({}, 0, 'native:0:0');
    const lockState = lockGuessByRowId({}, 0, 'native:0:1');

    expect(resolveDisplayGuessForTarget(0, originalHistory, previewState)).toMatchObject({
      guess: 'COLD',
      sourceIndex: 0,
      locked: false,
    });
    expect(resolveDisplayGuessForTarget(0, reorderedHistory, previewState)).toMatchObject({
      guess: 'COLD',
      sourceIndex: 1,
      locked: false,
    });
    expect(resolveDisplayGuessForTarget(0, reorderedHistory, lockState)).toMatchObject({
      guess: 'BOLD',
      sourceIndex: 2,
      locked: true,
    });
  });

  it('marks detail rows by rowId-based preview and lock state', () => {
    const history = buildHistory({
      0: [
        { guess: 'SHDW', codes: ['Y', '_', '_', '_'], rowId: 'shadow:0:0' },
        { guess: 'COLD', codes: ['R', 'R', 'G', 'G'], rowId: 'native:0:0' },
      ],
    });

    const state = lockGuessByRowId({}, 0, 'shadow:0:0');
    const detailHistory = getDetailHistory(0, history, state);

    expect(detailHistory[0]).toMatchObject({ rowId: 'shadow:0:0', isPreviewed: true, isLocked: true });
    expect(detailHistory[1]).toMatchObject({ rowId: 'native:0:0', isPreviewed: false, isLocked: false });
  });
});
