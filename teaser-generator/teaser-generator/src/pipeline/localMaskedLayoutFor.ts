/**
 * Copied from crosswords_mobile/src/lib/localMaskedLayoutFor.ts
 * Changes:
 *   - Removed import from '@schemas/api' — MaskedSegment defined inline.
 */

export type MaskedSegment = {
  coords: Array<[number, number]>;
  orient: 'A' | 'D';
};

type LayoutEntry = { coords: Array<[number, number]>; orient: 'H' | 'V' };

export function localMaskedLayoutFor(layout: LayoutEntry[]): MaskedSegment[] {
  return layout.map((seg) => ({
    coords: seg.coords.map(([r, c]) => [Number(r), Number(c)] as [number, number]),
    orient: seg.orient === 'H' ? 'A' : 'D',
  }));
}
