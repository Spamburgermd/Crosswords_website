# Task 5: Tutorial script + tests

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/tutorialScript.ts`
- Create: `crosswords_mobile/src/screens/tutorial/tutorialScript.test.ts`

---

- [ ] **Step 1: Write the failing tests**

```typescript
// crosswords_mobile/src/screens/tutorial/tutorialScript.test.ts
import { TUTORIAL_STEPS } from './tutorialScript';
import type { TutorialGameState } from './types';

const empty: TutorialGameState = {
  guessCountByTarget: { 0: 0, 1: 0, 2: 0 },
  activeTargetIndex: 0,
};

const after1stGuess: TutorialGameState = {
  ...empty,
  guessCountByTarget: { 0: 1, 1: 0, 2: 0 },
};

const afterBasicGuess: TutorialGameState = {
  ...empty,
  guessCountByTarget: { 0: 1, 1: 0, 2: 1 },
};

const afterTilesGuess: TutorialGameState = {
  ...empty,
  guessCountByTarget: { 0: 1, 1: 1, 2: 1 },
};

describe('TUTORIAL_STEPS', () => {
  test('has exactly 11 steps', () => {
    expect(TUTORIAL_STEPS).toHaveLength(11);
  });

  test('all steps have unique ids', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(11);
  });

  test('step 0 trigger always true (fires on open)', () => {
    expect(TUTORIAL_STEPS[0].trigger(empty)).toBe(true);
  });

  test('step 3 trigger fires after first BATON guess', () => {
    expect(TUTORIAL_STEPS[3].trigger(empty)).toBe(false);
    expect(TUTORIAL_STEPS[3].trigger(after1stGuess)).toBe(true);
  });

  test('step 7 trigger fires after BASIC guess', () => {
    expect(TUTORIAL_STEPS[7].trigger(after1stGuess)).toBe(false);
    expect(TUTORIAL_STEPS[7].trigger(afterBasicGuess)).toBe(true);
  });

  test('step 9 trigger fires after TILES guess', () => {
    expect(TUTORIAL_STEPS[9].trigger(afterBasicGuess)).toBe(false);
    expect(TUTORIAL_STEPS[9].trigger(afterTilesGuess)).toBe(true);
  });

  test('steps 2, 6, 8 are action steps (isAction=true)', () => {
    expect(TUTORIAL_STEPS[2].hint.isAction).toBe(true);
    expect(TUTORIAL_STEPS[6].hint.isAction).toBe(true);
    expect(TUTORIAL_STEPS[8].hint.isAction).toBe(true);
  });

  test('steps 0,1,3,4,5,7,9,10 are explanatory (isAction=false)', () => {
    [0,1,3,4,5,7,9,10].forEach((i) => {
      expect(TUTORIAL_STEPS[i].hint.isAction).toBe(false);
    });
  });

  test('step 2 expectedAction fires when BATON guess count increases', () => {
    const fn = TUTORIAL_STEPS[2].expectedAction!;
    expect(fn(after1stGuess, empty)).toBe(true);
    expect(fn(empty, empty)).toBe(false);
  });

  test('step 6 expectedAction fires when BASIC guess count increases', () => {
    const fn = TUTORIAL_STEPS[6].expectedAction!;
    expect(fn(afterBasicGuess, after1stGuess)).toBe(true);
    expect(fn(after1stGuess, after1stGuess)).toBe(false);
  });

  test('step 8 expectedAction fires when TILES guess count increases', () => {
    const fn = TUTORIAL_STEPS[8].expectedAction!;
    expect(fn(afterTilesGuess, afterBasicGuess)).toBe(true);
    expect(fn(afterBasicGuess, afterBasicGuess)).toBe(false);
  });

  test('step 2 has preFill CANDY for targetIndex 0', () => {
    expect(TUTORIAL_STEPS[2].preFill).toBe('CANDY');
    expect(TUTORIAL_STEPS[2].preFillTargetIndex).toBe(0);
  });

  test('step 6 has preFill TOPIC for targetIndex 2', () => {
    expect(TUTORIAL_STEPS[6].preFill).toBe('TOPIC');
    expect(TUTORIAL_STEPS[6].preFillTargetIndex).toBe(2);
  });

  test('step 8 has preFill AMINO for targetIndex 1', () => {
    expect(TUTORIAL_STEPS[8].preFill).toBe('AMINO');
    expect(TUTORIAL_STEPS[8].preFillTargetIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=tutorialScript
```

Expected: FAIL (TUTORIAL_STEPS not found)

- [ ] **Step 3: Write `tutorialScript.ts`**

```typescript
// crosswords_mobile/src/screens/tutorial/tutorialScript.ts
import type { TutorialStep } from './types';

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── 0: Welcome ────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    trigger: () => true,
    hint: {
      title: 'Welcome',
      body: "This is a crossword puzzle where every word shares letters with crossing words. Your guesses reveal clues that apply across the whole board.",
      isAction: false,
    },
  },

  // ── 1: Word cards ─────────────────────────────────────────────────────────
  {
    id: 'word-cards',
    trigger: () => true,
    hint: {
      title: 'Word Cards',
      body: "The numbered badges on the left are your words. Tap one to select it. The stage panel shows your guess history for that word.",
      isAction: false,
    },
  },

  // ── 2: Keyboard + first guess (action) ────────────────────────────────────
  {
    id: 'first-guess',
    trigger: () => true,
    hint: {
      title: 'Make Your First Guess',
      body: "We've pre-filled a guess for you. Tap ↵ to submit — or type your own and submit when ready.",
      isAction: true,
    },
    preFill: 'CANDY',
    preFillTargetIndex: 0,
    highlightTarget: 'submit-button',
    expectedAction: (s, p) =>
      (s.guessCountByTarget[0] ?? 0) > (p.guessCountByTarget[0] ?? 0),
  },

  // ── 3: Feedback colors ────────────────────────────────────────────────────
  {
    id: 'feedback-colors',
    trigger: (s) => (s.guessCountByTarget[0] ?? 0) >= 1,
    hint: {
      title: 'Reading the Colors',
      body: "Green = correct letter, correct spot.\nYellow = in this word, wrong spot.\nBlue = not in this word, but somewhere in the puzzle.\nRed = not in the puzzle at all.",
      isAction: false,
    },
  },

  // ── 4: Blue ticker ────────────────────────────────────────────────────────
  {
    id: 'blue-ticker',
    trigger: () => true,
    hint: {
      title: 'Blue Ticker',
      body: "The blue rail above the board tracks letters you've found in the puzzle but haven't placed yet. It counts how many unsolved words still need each letter.",
      isAction: false,
    },
  },

  // ── 5: Keyboard tracking ─────────────────────────────────────────────────
  {
    id: 'keyboard-tracking',
    trigger: () => true,
    hint: {
      title: 'Keyboard Tracking',
      body: "Keys turn red when a letter is fully accounted for — confirmed in every word that needs it. White keys are still in play.",
      isAction: false,
    },
  },

  // ── 6: Switch to BASIC via tabs + submit (action) ─────────────────────────
  {
    id: 'switch-to-basic',
    trigger: () => true,
    hint: {
      title: 'Switch Words',
      body: "Tap the Word 2 tab to switch to a different word, then submit the pre-filled guess.",
      isAction: true,
    },
    preFill: 'TOPIC',
    preFillTargetIndex: 2,
    highlightTarget: 'word-tabs',
    highlightTargetIndex: 2,   // targetIndex of BASIC
    expectedAction: (s, p) =>
      (s.guessCountByTarget[2] ?? 0) > (p.guessCountByTarget[2] ?? 0),
  },

  // ── 7: Color state of truth ───────────────────────────────────────────────
  {
    id: 'color-truth',
    trigger: (s) => (s.guessCountByTarget[2] ?? 0) >= 1,
    hint: {
      title: 'Colors Show the Current Truth',
      body: "A letter that was blue (in the puzzle) just turned green here — it belongs to this word. Since it only appears once in the puzzle, every blue tile for that letter just turned red. Colors always reflect what you know right now, across all words.",
      isAction: false,
    },
  },

  // ── 8: Tap intersection → submit TILES (action) ───────────────────────────
  {
    id: 'intersection-guess',
    trigger: () => true,
    hint: {
      title: 'Crossing Words',
      body: "Tap an intersection tile (a cell shared by two words) to switch to the crossing word. Then submit the pre-filled guess.",
      isAction: true,
    },
    preFill: 'AMINO',
    preFillTargetIndex: 1,
    highlightTarget: 'intersection-tile',
    expectedAction: (s, p) =>
      (s.guessCountByTarget[1] ?? 0) > (p.guessCountByTarget[1] ?? 0),
  },

  // ── 9: Intersection colors ───────────────────────────────────────────────
  {
    id: 'intersection-colors',
    trigger: (s) => (s.guessCountByTarget[1] ?? 0) >= 1,
    hint: {
      title: 'Intersection Colors',
      body: "At a crossing tile, yellow means the letter is in at least one of the two words that share that cell. Blue means it's in the puzzle but not in either of those words.",
      isAction: false,
    },
  },

  // ── 10: Guess locking ─────────────────────────────────────────────────────
  {
    id: 'guess-locking',
    trigger: () => true,
    hint: {
      title: 'Guess Locking',
      body: "Tap a history row to preview that guess on the board. Long-press to lock it — the board stays on that guess until you unlock it or submit a new one.",
      isAction: false,
    },
  },
];
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=tutorialScript
```

Expected: all 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/tutorialScript.ts crosswords_mobile/src/screens/tutorial/tutorialScript.test.ts
git commit -m "feat(tutorial): add tutorial script with 11 steps and tests"
```

- [ ] **Step 6: Mark task complete in index**

Edit `docs/superpowers/plans/2026-03-29-tutorial-redesign/index.md`:

Change:
```
- [ ] [Task 5: Tutorial script + tests](task-05-tutorial-script.md)
```
To:
```
- [x] [Task 5: Tutorial script + tests](task-05-tutorial-script.md)
```
