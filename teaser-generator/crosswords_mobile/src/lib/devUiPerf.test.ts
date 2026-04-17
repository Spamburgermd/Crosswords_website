import {
  buildDevUiPerfLines,
  formatPerfMs,
} from './devUiPerf';

describe('devUiPerf', () => {
  it('formats durations with stable precision', () => {
    expect(formatPerfMs(1.234)).toBe('1.23 ms');
    expect(formatPerfMs(12.34)).toBe('12.3 ms');
    expect(formatPerfMs(null)).toBe('-');
  });

  it('builds readable dev perf lines', () => {
    expect(
      buildDevUiPerfLines({
        pendingActionLabel: 'history-preview',
        lastActionLabel: 'submit',
        lastActionToCommitMs: 4.321,
        lastAfterPaintMs: 16.789,
        lastRevealCompleteMs: 1800.123,
        lastExpectedRevealMs: 1600,
        lastRevealOverrunMs: 200.123,
        splitHistoryMs: 0.08,
        cardDisplayMs: 0.01,
        boardTileCount: 17,
        boardDiagnosticsCount: 2,
        detailRowCount: 5,
        combinedRowCount: 12,
        selectedTargetIndex: 3,
        revealTargetIndex: null,
        renderCounts: {
          boardScreen: 10,
          boardView: 4,
          detailStage: 7,
        },
      }),
    ).toEqual([
      { label: 'Pending', value: 'history-preview' },
      { label: 'Last action', value: 'submit' },
      { label: 'Commit', value: '4.32 ms' },
      { label: 'Paint', value: '16.8 ms' },
      { label: 'Reveal done', value: '1800.1 ms' },
      { label: 'Reveal expected', value: '1600.0 ms' },
      { label: 'Reveal overrun', value: '200.1 ms' },
      { label: 'Split history', value: '0.08 ms' },
      { label: 'Card state', value: '0.01 ms' },
      { label: 'Board tiles', value: '17' },
      { label: 'Detail rows', value: '5' },
      { label: 'Combined rows', value: '12' },
      { label: 'Diagnostics', value: '2' },
      { label: 'Selected', value: '3' },
      { label: 'Reveal', value: '-' },
      { label: 'Renders', value: 'B:10 BV:4 DS:7' },
    ]);
  });
});
