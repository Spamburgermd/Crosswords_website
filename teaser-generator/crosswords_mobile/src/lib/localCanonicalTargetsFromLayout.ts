/**
 * src/lib/localCanonicalTargetsFromLayout.ts
 * -----------------------------------------------------------
 * Mirror of server _canonical_targets_from_layout.
 * Builds TargetMeta-like objects from placed layout.
 */

import type { TargetMeta } from '@schemas/api';
import { buildPathSignature, normalizeDirection } from '@src/utils/wordSlots';

type LayoutEntry = { coords: Array<[number, number]>; orient: 'H' | 'V'; text: string };

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
