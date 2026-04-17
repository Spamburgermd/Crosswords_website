import type { DevUiPerfRenderCounts } from './devUiPerf';

export type DevUiPerfLogEntry = {
  timestampIso: string;
  actionLabel: string;
  commitMs?: number | null;
  paintMs?: number | null;
  revealDoneMs?: number | null;
  expectedRevealMs?: number | null;
  revealOverrunMs?: number | null;
  splitHistoryMs?: number | null;
  cardDisplayMs?: number | null;
  boardTileCount: number;
  detailRowCount: number;
  combinedRowCount: number;
  boardDiagnosticsCount: number;
  selectedTargetIndex?: number | null;
  revealTargetIndex?: number | null;
  renderCounts: DevUiPerfRenderCounts;
};

type ExpoFileSystemLike = {
  documentDirectory?: string | null;
  writeAsStringAsync: (uri: string, contents: string) => Promise<void>;
};

function getFS(): ExpoFileSystemLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-file-system/legacy') as ExpoFileSystemLike;
  } catch {
    return null;
  }
}

function formatTimestampForFilename(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

export function buildDevUiPerfLogFilename(now = new Date()): string {
  return `ui-perf-log-${formatTimestampForFilename(now)}.json`;
}

export function formatDevUiPerfLog(entries: DevUiPerfLogEntry[]): string {
  return JSON.stringify(
    {
      generatedAtIso: new Date().toISOString(),
      entryCount: entries.length,
      entries,
    },
    null,
    2,
  );
}

export async function saveDevUiPerfLogFile(
  contents: string,
  now = new Date(),
): Promise<string | null> {
  const fs = getFS();
  if (!fs?.documentDirectory) return null;
  const uri = `${fs.documentDirectory}${buildDevUiPerfLogFilename(now)}`;
  await fs.writeAsStringAsync(uri, contents);
  return uri;
}
