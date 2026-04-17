# Task 2: Hardcoded tutorial puzzle

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/tutorialPuzzle.ts`

The puzzle data must conform to `MaskedSegment` and `TargetMeta` from `crosswords_mobile/src/types/api.ts`:
```typescript
// For reference — do not re-declare these:
type MaskedSegment = { coords: number[][]; orient: string }
type TargetMeta    = { target_index: number; length: number; start: [number, number]; dir: string; coords: [number, number][] }
```

---

- [ ] **Step 1: Write `tutorialPuzzle.ts`**

```typescript
// crosswords_mobile/src/screens/tutorial/tutorialPuzzle.ts
import type { MaskedSegment, TargetMeta } from '@src/types/api';
import { buildCanonicalWordSlots } from '@src/utils/wordSlots';
import type { CanonicalWordSlot } from '@src/utils/wordSlots';

/**
 * Tutorial puzzle: BATON (Across) × TILES (Down) × BASIC (Across)
 *
 * Grid (5×5):
 *   B A T O N   row 0  targetIndex 0  displayIndex 1
 *   . . I . .
 *   . . L . .
 *   . . E . .
 *   B A S I C   row 4  targetIndex 2  displayIndex 2
 *       ↑col2
 *     TILES     col 2  targetIndex 1  displayIndex 3
 *
 * Intersections:
 *   [0,2]  BATON[2]=T  ×  TILES[0]=T
 *   [4,2]  TILES[4]=S  ×  BASIC[2]=S
 */

export const TUTORIAL_WORDS: string[] = [
  'BATON',   // targetIndex 0
  'TILES',   // targetIndex 1
  'BASIC',   // targetIndex 2
];

export const TUTORIAL_MASKED_SEGMENTS: MaskedSegment[] = [
  { coords: [[0,0],[0,1],[0,2],[0,3],[0,4]], orient: 'A' },  // BATON
  { coords: [[0,2],[1,2],[2,2],[3,2],[4,2]], orient: 'D' },  // TILES
  { coords: [[4,0],[4,1],[4,2],[4,3],[4,4]], orient: 'A' },  // BASIC
];

export const TUTORIAL_TARGETS_META: TargetMeta[] = [
  { target_index: 0, length: 5, start: [0,0], dir: 'A', coords: [[0,0],[0,1],[0,2],[0,3],[0,4]] },
  { target_index: 1, length: 5, start: [0,2], dir: 'D', coords: [[0,2],[1,2],[2,2],[3,2],[4,2]] },
  { target_index: 2, length: 5, start: [4,0], dir: 'A', coords: [[4,0],[4,1],[4,2],[4,3],[4,4]] },
];

/** No pre-revealed coordinates — player starts with a blank board. */
export const TUTORIAL_REVEALED_COORDS: number[][] = [];

/** Memoized word slots derived from the tutorial puzzle layout. */
let _cachedSlots: CanonicalWordSlot[] | null = null;
export function getTutorialWordSlots(): CanonicalWordSlot[] {
  if (!_cachedSlots) {
    _cachedSlots = buildCanonicalWordSlots(
      TUTORIAL_MASKED_SEGMENTS,
      TUTORIAL_TARGETS_META,
    );
  }
  return _cachedSlots;
}

/**
 * Scripted pre-fills for each action step.
 * Codes are pre-computed and injected directly — no server call needed.
 */
export const TUTORIAL_PREFILLS: Record<number, { guess: string; codes: string[] }> = {
  0: { guess: 'CANDY', codes: ['B','G','Y','R','R'] },  // on BATON
  1: { guess: 'AMINO', codes: ['B','R','Y','B','B'] },  // on TILES
  2: { guess: 'TOPIC', codes: ['B','B','R','G','G'] },  // on BASIC
};
```

- [ ] **Step 2: Verify puzzle constraints manually**

Before committing, verify these constraints hold in `TUTORIAL_PREFILLS` and the word list:

1. **Word 0 (BATON) / pre-fill CANDY codes `['B','G','Y','R','R']`:**
   - C (pos 0): not in BATON, C is in BASIC → B ✓
   - A (pos 1): BATON[1]=A → G ✓
   - N (pos 2): BATON has N at pos 4 (not pos 2) → Y ✓
   - D (pos 3): not in BATON, TILES, or BASIC → R ✓
   - Y (pos 4): not in BATON, TILES, or BASIC → R ✓

2. **Word 2 (BASIC) / pre-fill TOPIC codes `['B','B','R','G','G']`:**
   - I (pos 3): BASIC[3]=I → G ✓
   - C (pos 4): BASIC[4]=C → G ✓
   - C was B in CANDY (it appeared in BASIC — confirmed now as green)
   - C appears only once in the full puzzle (only in BASIC) → all blues collapse to red ✓

3. **Word 1 (TILES) / pre-fill AMINO codes `['B','R','Y','B','B']`:**
   - A at pos 0 is in BATON (crossing word at [0,2]) → yellow crossing ✓
   - O at pos 4 is in BATON (BATON[3]=O) but not in BASIC or TILES → blue crossing ✓

- [ ] **Step 3: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/tutorialPuzzle.ts
git commit -m "feat(tutorial): add hardcoded tutorial puzzle (BATON/TILES/BASIC)"
```

- [ ] **Step 4: Mark task complete in index**

Edit `docs/superpowers/plans/2026-03-29-tutorial-redesign/index.md`:

Change:
```
- [ ] [Task 2: Hardcoded tutorial puzzle](task-02-puzzle.md)
```
To:
```
- [x] [Task 2: Hardcoded tutorial puzzle](task-02-puzzle.md)
```
