import type { MaskedSegment, TargetMeta } from '@schemas/api';
export type { TargetMeta } from '@schemas/api';

/** Shared representation of a crossword slot built from masked segments. */
export type CanonicalWordSlot = {
  segmentIndex: number;
  /** Backend target_index (0..4) so guesses hit the right word even if display order changes. */
  targetIndex: number;
  /** Stable signature combining start cell, direction, and length for mapping. */
  signature: string;
  key: string;
  clueNumber: number;
  displayIndex: number;
  direction: 'A' | 'D';
  coords: number[][];
  startRow: number;
  startCol: number;
  length: number;
};

export function normalizeDirection(value?: string): 'A' | 'D' {
  if (!value) return 'D';
  const normalized = value.slice(0, 1).toUpperCase();
  return normalized === 'A' || normalized === 'H' ? 'A' : 'D';
}

export function makeWordKey({
  id,
  word_id,
  targetIndex,
  clueNumber,
  clue,
  number,
  direction,
  dir,
  orientation,
}: {
  id?: number;
  word_id?: number;
  targetIndex?: number;
  clueNumber?: number;
  clue?: number;
  number?: number;
  direction?: string;
  dir?: string;
  orientation?: string;
}): string {
  if (id != null || word_id != null) {
    return String(id ?? word_id);
  }
  const clueNumeric = clueNumber ?? clue ?? number;
  const dirValue = direction ?? dir ?? orientation;
  const dirKey = normalizeDirection(dirValue);
  if (clueNumeric != null) {
    return `${clueNumeric}:${dirKey}`;
  }
  if (typeof targetIndex === 'number') {
    return `target-${targetIndex}`;
  }
  return `slot-${dirKey}`;
}

const normalizeCoords = (coords: number[][], dir: 'A' | 'D'): number[][] => {
  const normalized = coords.map((coord) => [coord[0], coord[1]]);
  normalized.sort((a, b) => {
    if (dir === 'A') {
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0] - b[0];
    }
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
  return normalized;
};

export function buildPathSignature(dir: 'A' | 'D', coords: number[][]): string {
  const normalized = normalizeCoords(coords, dir);
  return `${dir}|${normalized.map(([r, c]) => `${r},${c}`).join(';')}`;
}

export function buildCanonicalWordSlots(
  maskedSegments: MaskedSegment[] | null | undefined,
  targetsMeta?: TargetMeta[] | null,
): CanonicalWordSlot[] {
  if (!maskedSegments || maskedSegments.length === 0) {
    return [];
  }

  const slots = maskedSegments.map((segment, segmentIndex) => {
    const segmentWithTarget = segment as MaskedSegment & {
      target_index?: number;
      targetIndex?: number;
      index?: number;
    };
    const coords = segment.coords ?? [];
    const startRow = Number.isFinite(coords[0]?.[0] as number) ? coords[0][0] : 0;
    const startCol = Number.isFinite(coords[0]?.[1] as number) ? coords[0][1] : 0;
    const direction = normalizeDirection(segment.orient);
    const explicitIndex =
      segmentWithTarget.target_index ?? segmentWithTarget.targetIndex ?? segmentWithTarget.index;
    const candidateIndex =
      explicitIndex != null ? Number(explicitIndex) : segmentIndex;
    const backendTargetIndex = Number.isFinite(candidateIndex)
      ? candidateIndex
      : segmentIndex;
    if (!Number.isFinite(backendTargetIndex)) {
      console.warn(
        'Invalid target index on masked segment; falling back to raw order',
        { segment, rawIndex: segmentIndex },
      );
    }
    return {
      segmentIndex,
      targetIndex: backendTargetIndex,
      coords,
      startRow,
      startCol,
      direction,
      signature: '',
      length: coords.length,
      clueNumber: 0,
      displayIndex: 0,
      key: '',
    };
  });

  const cellKey = (row: number, col: number) => `${row}:${col}`;
  const uniqueCells = Array.from(
    new Set(slots.map((slot) => cellKey(slot.startRow, slot.startCol))),
  )
    .map((key) => {
      const [row, col] = key.split(':').map((part) => Number(part));
      return { key, row, col };
    })
    .sort((a, b) => {
      if (a.row !== b.row) {
        return a.row - b.row;
      }
      return a.col - b.col;
    });

  const clueNumberByCell = new Map<string, number>();
  uniqueCells.forEach((cell, idx) => {
    clueNumberByCell.set(cell.key, idx + 1);
  });

  const enhanced = slots.map((slot) => {
    const clueNumber = clueNumberByCell.get(cellKey(slot.startRow, slot.startCol)) ?? 0;
    return {
      ...slot,
      clueNumber,
    };
  });

  enhanced.sort((a, b) => {
    if (a.clueNumber !== b.clueNumber) {
      return a.clueNumber - b.clueNumber;
    }
    if (a.direction !== b.direction) {
      return a.direction === 'A' ? -1 : 1;
    }
    if (a.startRow !== b.startRow) {
      return a.startRow - b.startRow;
    }
    return a.startCol - b.startCol;
  });

  const signatureToTargetIndex = new Map<string, number>();
  const metaList = targetsMeta ?? [];
  metaList.forEach((meta) => {
    const dir = normalizeDirection(meta.dir);
    const normalizedMetaCoords = normalizeCoords(meta.coords ?? [], dir);
    if (normalizedMetaCoords.length === 0) {
      return;
    }
    const sig = buildPathSignature(dir, normalizedMetaCoords);
    if (signatureToTargetIndex.has(sig)) {
      console.warn('TARGET_META_DUPLICATE', { sig, meta });
      return;
    }
    signatureToTargetIndex.set(sig, meta.target_index);
  });

  const hasMeta = metaList.length > 0;
  const mappedSlots = enhanced.map((slot, idx) => {
    const normalizedSlotCoords = normalizeCoords(slot.coords, slot.direction);
    const sig = buildPathSignature(slot.direction, normalizedSlotCoords);
    const mappedTarget = signatureToTargetIndex.get(sig);
    const assignedTargetIndex =
      typeof mappedTarget === 'number' ? mappedTarget : slot.targetIndex;
    if (mappedTarget == null && hasMeta) {
      console.warn('TARGET_INDEX_UNMAPPED', { signature: sig, slot });
    }
    if (__DEV__) {
      console.log('MAP_SLOT_TO_TARGET', {
        slotKey: slot.key,
        slotSig: sig,
        assignedTargetIndex,
      });
    }
    const updatedSlot = {
      ...slot,
      signature: sig,
      displayIndex: idx + 1,
      targetIndex: assignedTargetIndex,
      key: makeWordKey({
        targetIndex: assignedTargetIndex,
        clueNumber: slot.clueNumber,
        direction: slot.direction,
      }),
    };
    if (__DEV__) {
      console.log('MAP_SLOT_TO_TARGET', {
        slotKey: updatedSlot.key,
        slotSig: sig,
        assignedTargetIndex,
      });
    }
    return updatedSlot;
  });

  if (__DEV__) {
    console.log('=== CANONICAL SLOT SIGNATURES ===');
    mappedSlots.forEach((slot, index) => {
      console.log({
        displayWord: index + 1,
        key: slot.key,
        clue: slot.clueNumber,
        dir: slot.direction,
        len: slot.length,
        targetIndex: slot.targetIndex,
        signature: slot.signature,
        coords: slot.coords,
      });
    });
  }

  return mappedSlots;
}
