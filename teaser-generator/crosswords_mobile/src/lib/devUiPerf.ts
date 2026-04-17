export type DevUiPerfRenderCounts = {
  boardScreen: number;
  boardView: number;
  detailStage: number;
};

export type DevUiPerfMetrics = {
  pendingActionLabel?: string | null;
  lastActionLabel?: string | null;
  lastActionToCommitMs?: number | null;
  lastAfterPaintMs?: number | null;
  lastRevealCompleteMs?: number | null;
  lastExpectedRevealMs?: number | null;
  lastRevealOverrunMs?: number | null;
  splitHistoryMs?: number | null;
  cardDisplayMs?: number | null;
  boardTileCount: number;
  boardDiagnosticsCount: number;
  detailRowCount: number;
  combinedRowCount: number;
  selectedTargetIndex?: number | null;
  revealTargetIndex?: number | null;
  renderCounts: DevUiPerfRenderCounts;
};

export type DevUiPerfLine = {
  label: string;
  value: string;
};

export function getPerfNow(): number {
  const perf = globalThis.performance;
  return typeof perf?.now === 'function' ? perf.now() : Date.now();
}

export function formatPerfMs(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ms`;
}

export function buildDevUiPerfLines(metrics: DevUiPerfMetrics): DevUiPerfLine[] {
  const lines: DevUiPerfLine[] = [];

  if (metrics.pendingActionLabel) {
    lines.push({ label: 'Pending', value: metrics.pendingActionLabel });
  }

  lines.push({
    label: 'Last action',
    value: metrics.lastActionLabel ?? '-',
  });
  lines.push({
    label: 'Commit',
    value: formatPerfMs(metrics.lastActionToCommitMs),
  });
  lines.push({
    label: 'Paint',
    value: formatPerfMs(metrics.lastAfterPaintMs),
  });
  lines.push({
    label: 'Reveal done',
    value: formatPerfMs(metrics.lastRevealCompleteMs),
  });
  lines.push({
    label: 'Reveal expected',
    value: formatPerfMs(metrics.lastExpectedRevealMs),
  });
  lines.push({
    label: 'Reveal overrun',
    value: formatPerfMs(metrics.lastRevealOverrunMs),
  });
  lines.push({
    label: 'Split history',
    value: formatPerfMs(metrics.splitHistoryMs),
  });
  lines.push({
    label: 'Card state',
    value: formatPerfMs(metrics.cardDisplayMs),
  });
  lines.push({
    label: 'Board tiles',
    value: String(metrics.boardTileCount),
  });
  lines.push({
    label: 'Detail rows',
    value: String(metrics.detailRowCount),
  });
  lines.push({
    label: 'Combined rows',
    value: String(metrics.combinedRowCount),
  });
  lines.push({
    label: 'Diagnostics',
    value: String(metrics.boardDiagnosticsCount),
  });
  lines.push({
    label: 'Selected',
    value: metrics.selectedTargetIndex == null ? '-' : String(metrics.selectedTargetIndex),
  });
  lines.push({
    label: 'Reveal',
    value: metrics.revealTargetIndex == null ? '-' : String(metrics.revealTargetIndex),
  });
  lines.push({
    label: 'Renders',
    value: `B:${metrics.renderCounts.boardScreen} BV:${metrics.renderCounts.boardView} DS:${metrics.renderCounts.detailStage}`,
  });

  return lines;
}
