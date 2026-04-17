describe('devUiPerfLog', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('builds a stable filename', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildDevUiPerfLogFilename } = require('./devUiPerfLog');
    const localDate = new Date(2026, 3, 16, 21, 34, 56);
    expect(buildDevUiPerfLogFilename(localDate)).toBe(
      'ui-perf-log-20260416-213456.json',
    );
  });

  it('formats entries as readable json', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { formatDevUiPerfLog } = require('./devUiPerfLog');
    const text = formatDevUiPerfLog([
      {
        timestampIso: '2026-04-16T21:34:56.000Z',
        actionLabel: 'history-preview',
        commitMs: 3.2,
        paintMs: 10.1,
        revealDoneMs: null,
        expectedRevealMs: null,
        revealOverrunMs: null,
        splitHistoryMs: 0.08,
        cardDisplayMs: 0.01,
        boardTileCount: 17,
        detailRowCount: 5,
        combinedRowCount: 12,
        boardDiagnosticsCount: 0,
        selectedTargetIndex: 2,
        revealTargetIndex: null,
        renderCounts: {
          boardScreen: 5,
          boardView: 3,
          detailStage: 4,
        },
      },
    ]);
    expect(text).toContain('"entryCount": 1');
    expect(text).toContain('"actionLabel": "history-preview"');
    expect(text).toContain('"renderCounts"');
  });

  it('writes the log file to documentDirectory when available', async () => {
    const writeAsStringAsync = jest.fn(async () => undefined);
    jest.doMock('expo-file-system/legacy', () => ({
      documentDirectory: 'file:///mock-docs/',
      writeAsStringAsync,
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { saveDevUiPerfLogFile } = require('./devUiPerfLog');
    const localDate = new Date(2026, 3, 16, 21, 34, 56);
    const uri = await saveDevUiPerfLogFile('{}', localDate);
    expect(uri).toBe('file:///mock-docs/ui-perf-log-20260416-213456.json');
    expect(writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-docs/ui-perf-log-20260416-213456.json',
      '{}',
    );
  });
});
