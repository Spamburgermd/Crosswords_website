/**
 * src/lib/localMaskedLayoutFor.ts
 * -----------------------------------------------------------
 * Mirror of server _masked_layout_for: coords-only segments with orient.
 */
import type { MaskedSegment } from '@schemas/api';

type LayoutEntry = { coords: Array<[number, number]>; orient: 'H' | 'V' };

export function localMaskedLayoutFor(layout: LayoutEntry[]): MaskedSegment[] {
  return layout.map((seg) => ({
    coords: seg.coords.map(([r, c]) => [Number(r), Number(c)]),
    orient: seg.orient === 'H' ? 'A' : 'D',
  })) as MaskedSegment[];
}
