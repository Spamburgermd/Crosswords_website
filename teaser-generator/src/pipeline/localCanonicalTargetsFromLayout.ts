/**
 * Copied from crosswords_mobile/src/lib/localCanonicalTargetsFromLayout.ts
 * Changes:
 *   - Removed import from '@schemas/api' — TargetMeta defined inline.
 *   - Removed import from '@src/utils/wordSlots' — normalizeDirection,
 *     normalizeCoords, and buildPathSignature inlined here.
 */

export type TargetMeta = {
  target_index: number;
  length: number;
  start: [number, number];
  dir: 'A' | 'D';
  coords: Array<[number, number]>;
  signature: string;
};

type LayoutEntry = { coords: Array<[number, number]>; orient: 'H' | 'V'; text: string };

function normalizeDirection(value?: string): 'A' | 'D' {
  if (!value) return 'D';
  const normalized = value.slice(0, 1).toUpperCase();
  return normalized === 'A' || normalized === 'H' ? 'A' : 'D';
}

const normalizeCoords = (coords: number[][], dir: 'A' | 'D'): number[][] => {
  const normalized = coords.map((coord) => [coord[0], coord[1]]);
  normalized.sort((a, b) => {
    if (dir === 'A') {
      if (a[1] !== b[1]) return a[1]! - b[1]!;
      return a[0]! - b[0]!;
    }
    if (a[0] !== b[0]) return a[0]! - b[0]!;
    return a[1]! - b[1]!;
  });
  return normalized;
};

function buildPathSignature(dir: 'A' | 'D', coords: number[][]): string {
  const normalized = normalizeCoords(coords, dir);
  return `${dir}|${normalized.map(([r, c]) => `${r},${c}`).join(';')}`;
}

export function localCanonicalTargetsFromLayout(layout: LayoutEntry[]): TargetMeta[] {
  return layout.map((entry, idx) => {
    const dir = normalizeDirection(entry.orient);
    const coords: Array<[number, number]> = entry.coords.map(([r, c]) => [Number(r), Number(c)]);
    const startRow = coords[0]?.[0] ?? 0;
    const startCol = coords[0]?.[1] ?? 0;
    return {
      target_index: idx,
      length: entry.text.length,
      start: [startRow, startCol],
      dir,
      coords,
      signature: buildPathSignature(dir, coords),
    };
  });
}
