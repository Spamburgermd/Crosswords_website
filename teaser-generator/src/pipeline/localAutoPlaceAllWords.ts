/**
 * Copied from crosswords_mobile/src/lib/localAutoPlaceAllWords.ts
 * No modifications needed — no imports.
 */

export type PlacedWord = { text: string; orient: 'H' | 'V'; coords: Array<[number, number]> };

const GRID_SIZE = 10;

export function localAutoPlaceAllWords(words: string[]): PlacedWord[] | null {
  const clean = words.map((w) => (w || '').replace(/[^A-Z]/g, '').toUpperCase());
  if (clean.some((w) => w.length === 0 || w.length > GRID_SIZE)) return null;

  type LettersMap = Map<string, string>; // key "r,c" -> letter
  const letters: LettersMap = new Map();
  const placed: Array<{ text: string; orient: 'H' | 'V'; coords: Array<[number, number]>; original: number }> = [];
  const coordOwners: Map<string, Set<number>> = new Map();

  const wordSpecs = clean
    .map((w, idx) => ({ w, idx }))
    .sort((a, b) => b.w.length - a.w.length || a.idx - b.idx); // longest first, then original order

  const key = (r: number, c: number) => `${r},${c}`;
  const inBounds = (r: number, c: number) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
  const cellsFor = (word: string, r: number, c: number, orient: 'H' | 'V') =>
    orient === 'H' ? word.split('').map((_, i) => [r, c + i] as [number, number]) : word.split('').map((_, i) => [r + i, c] as [number, number]);

  const addOwner = (idx: number, coord: [number, number]) => {
    const k = key(coord[0], coord[1]);
    const set = coordOwners.get(k) ?? new Set<number>();
    set.add(idx);
    coordOwners.set(k, set);
  };

  const canPlace = (word: string, r: number, c: number, orient: 'H' | 'V'): [boolean, number] => {
    const coords = cellsFor(word, r, c, orient);
    const intersectionsPerWord: Record<number, number> = {};
    let totalIntersections = 0;

    for (let pos = 0; pos < coords.length; pos++) {
      const [rr, cc] = coords[pos]!;
      if (!inBounds(rr, cc)) return [false, 0];

      const existing = letters.get(key(rr, cc));
      if (existing !== undefined) {
        if (existing !== word[pos]) return [false, 0];
        const owners = coordOwners.get(key(rr, cc)) ?? new Set();
        for (const ow of owners) {
          intersectionsPerWord[ow] = (intersectionsPerWord[ow] ?? 0) + 1;
          if (intersectionsPerWord[ow] > 1) return [false, 0];
        }
        totalIntersections += 1;
        continue;
      }

      const neighbors =
        orient === 'H'
          ? [
              [rr - 1, cc],
              [rr + 1, cc],
            ]
          : [
              [rr, cc - 1],
              [rr, cc + 1],
            ];
      for (const [nr, nc] of neighbors) {
        if (inBounds(nr, nc) && letters.has(key(nr, nc))) return [false, 0];
      }
    }

    // Clear end-caps
    if (coords.length) {
      const edge =
        orient === 'H'
          ? [
              [coords[0]![0], coords[0]![1] - 1],
              [coords.at(-1)![0], coords.at(-1)![1] + 1],
            ]
          : [
              [coords[0]![0] - 1, coords[0]![1]],
              [coords.at(-1)![0] + 1, coords.at(-1)![1]],
            ];
      for (const [er, ec] of edge) {
        if (inBounds(er, ec) && letters.has(key(er, ec))) return [false, 0];
      }
    }

    if (placed.length && totalIntersections === 0) return [false, 0];
    return [true, totalIntersections];
  };

  const commit = (word: string, r: number, c: number, orient: 'H' | 'V', original: number) => {
    const coords = cellsFor(word, r, c, orient);
    const idx = placed.length;
    coords.forEach(([rr, cc], pos) => {
      letters.set(key(rr, cc), word[pos]!);
      addOwner(idx, [rr, cc]);
    });
    placed.push({ text: word, orient, coords, original });
  };

  // First word: center horizontally (or first fit)
  const first = wordSpecs[0]!;
  const startR = Math.floor(GRID_SIZE / 2);
  const startC = Math.max(0, Math.floor((GRID_SIZE - first.w.length) / 2));
  let ok = false;
  if (canPlace(first.w, startR, startC, 'H')[0]) {
    commit(first.w, startR, startC, 'H', first.idx);
    ok = true;
  } else {
    outer: for (let rr = 0; rr < GRID_SIZE; rr++) {
      for (let cc = 0; cc <= GRID_SIZE - first.w.length; cc++) {
        if (canPlace(first.w, rr, cc, 'H')[0]) {
          commit(first.w, rr, cc, 'H', first.idx);
          ok = true;
          break outer;
        }
      }
    }
  }
  if (!ok) return null;

  // Place remaining words
  for (const spec of wordSpecs.slice(1)) {
    const word = spec.w;
    let placedWord = false;

    // Map letters to existing coords
    const letterCells: Record<string, Array<[number, number]>> = {};
    for (const [k, ch] of letters.entries()) {
      const [r, c] = k.split(',').map(Number);
      letterCells[ch] = letterCells[ch] ?? [];
      letterCells[ch]!.push([r, c]);
    }

    // Prefer intersection placements
    for (let offset = 0; offset < word.length && !placedWord; offset++) {
      const ch = word[offset]!;
      const cells = letterCells[ch] ?? [];
      for (const [er, ec] of cells) {
        const tryAcross = () => {
          const r = er;
          const c = ec - offset;
          if (c < 0 || c + word.length > GRID_SIZE) return false;
          const [fits] = canPlace(word, r, c, 'H');
          if (fits) commit(word, r, c, 'H', spec.idx);
          return fits;
        };
        const tryDown = () => {
          const r = er - offset;
          const c = ec;
          if (r < 0 || r + word.length > GRID_SIZE) return false;
          const [fits] = canPlace(word, r, c, 'V');
          if (fits) commit(word, r, c, 'V', spec.idx);
          return fits;
        };
        if (tryAcross() || tryDown()) {
          placedWord = true;
          break;
        }
      }
    }

    // Fallback: any legal placement with at least one intersection
    if (!placedWord) {
      outer2: for (let rr = 0; rr < GRID_SIZE; rr++) {
        for (let cc = 0; cc < GRID_SIZE; cc++) {
          for (const orient of ['H', 'V'] as const) {
            const [fits, inter] = canPlace(word, rr, cc, orient);
            if (fits && inter >= 1) {
              commit(word, rr, cc, orient, spec.idx);
              placedWord = true;
              break outer2;
            }
          }
        }
      }
    }

    if (!placedWord) return null;
  }

  // Sort back to original input order
  return placed
    .sort((a, b) => a.original - b.original)
    .map((p) => ({
      text: p.text,
      orient: p.orient,
      coords: p.coords,
    }));
}
