# Tutorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chapter-based tutorial with a fully playable scripted puzzle that surfaces 11 contextual hint overlays triggered by fixed game-state milestones.

**Architecture:** A step machine hook (`useTutorialStepMachine`) watches live game state and advances through an ordered `tutorialScript` array, transitioning between PLAYING / HINT / DONE. The orchestrator (`TutorialScreen`) mounts the game pipeline, the step machine, and a modal overlay, then derives `GameBoardPanel` emphasis props from the active step.

**Tech Stack:** React Native (Expo), TypeScript, `Animated` API with `useNativeDriver: true`, existing `GameBoardPanel` / `GameKeyboard` / `BoardView` components.

---

## Highlight Mechanism Note

The spec described a `TutorialHighlightContext` with animated pulse rings. This plan uses a simpler approach that requires **no changes outside `src/screens/tutorial/`**: `GameBoardPanel` already has `emphasizeKeyboard`, `emphasizedRailTargetIndex`, and `emphasizeBoard` props. The orchestrator passes these based on `activeStep.highlightTarget`. Effect is static emphasis (no pulse animation) — consistent with existing patterns and safe on older devices.

---

## Puzzle Design

**Words:**
- `targetIndex: 0` — **BATON** (Across, row 0, cols 0–4)
- `targetIndex: 1` — **TILES** (Down, col 2, rows 0–4)
- `targetIndex: 2` — **BASIC** (Across, row 4, cols 0–4)

**Grid (5×5):**
```
B A T O N   ← BATON (targetIndex 0, displayIndex 1)
. . I . .
. . L . .
. . E . .
B A S I C   ← BASIC (targetIndex 2, displayIndex 2)
    ↑
  TILES (targetIndex 1, displayIndex 3)
```

**Intersections:**
- `[0,2]` — BATON[2]=T shared with TILES[0]=T
- `[4,2]` — TILES[4]=S shared with BASIC[2]=S

**Pre-fills and their codes:**

| Step | Word | Pre-fill | Codes | Constraint satisfied |
|------|------|----------|-------|---------------------|
| 3 | BATON (0) | `CANDY` | `['B','G','Y','R','R']` | G(A pos1), Y(N wrong pos), B(C in BASIC), R(D not in puzzle), R(Y not in puzzle) |
| 7 | BASIC (2) | `TOPIC` | `['B','B','R','G','G']` | I(pos3)=G, C(pos4)=G; C was B in step 3; C appears once in puzzle → all C blues→red |
| 9 | TILES (1) | `AMINO` | `['B','R','Y','B','B']` | A at [0,2] = yellow crossing (A in BATON); O at [4,2] = blue crossing (O not in BASIC/TILES) |

---

## File Map

All files in `crosswords_mobile/src/screens/tutorial/` — **full replacement**.

| File | Responsibility |
|------|---------------|
| `types.ts` | `TutorialPhase`, `TutorialStep`, `TutorialGameState` |
| `tutorialPuzzle.ts` | Hardcoded `MaskedSegment[]`, `TargetMeta[]`, word strings |
| `useTutorialGameState.ts` | Game pipeline hook: reconciler → merge → ticker |
| `useTutorialStepMachine.ts` | PLAYING/HINT/DONE state machine |
| `tutorialScript.ts` | Static `TutorialStep[]` array (11 entries) |
| `TutorialOverlay.tsx` | Modal backdrop + hint card + Got it!/× buttons |
| `TutorialScreen.tsx` | Orchestrator: wires all of the above + `GameBoardPanel` |

Test files: `useTutorialStepMachine.test.ts`, `tutorialScript.test.ts`

---

## Task 1: Define shared types

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/types.ts`

- [ ] **Step 1: Write `types.ts`**

```typescript
// crosswords_mobile/src/screens/tutorial/types.ts

export type TutorialHighlightTarget =
  | 'submit-button'      // → emphasizeKeyboard=true on GameBoardPanel
  | 'word-tabs'          // → emphasizedRailTargetIndex=highlightTargetIndex
  | 'intersection-tile'  // → emphasizeBoard=true

export type TutorialPhase =
  | { kind: 'PLAYING'; nextStepIndex: number }
  | { kind: 'HINT';    stepIndex: number }
  | { kind: 'DONE' }

/**
 * Minimal game state snapshot passed to trigger / expectedAction functions.
 * Derived inside TutorialScreen from rawHistoryByTarget + activeTargetIndex.
 */
export type TutorialGameState = {
  guessCountByTarget: Record<number, number>  // guesses submitted per targetIndex
  activeTargetIndex: number
}

export type TutorialStep = {
  id: string
  trigger:          (state: TutorialGameState) => boolean
  hint: {
    title?:   string
    body:     string
    isAction: boolean   // true → show × only; false → show Got it! + ×
  }
  preFill?:             string   // guess text to load when this step activates
  preFillTargetIndex?:  number   // which word the preFill applies to
  highlightTarget?:     TutorialHighlightTarget
  highlightTargetIndex?: number  // for 'word-tabs': which tab to emphasize
  expectedAction?:      (state: TutorialGameState, prev: TutorialGameState) => boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/types.ts
git commit -m "feat(tutorial): add shared types for step machine redesign"
```

---

## Task 2: Hardcoded tutorial puzzle

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/tutorialPuzzle.ts`

The puzzle data must conform to `MaskedSegment` and `TargetMeta` from `crosswords_mobile/src/types/api.ts`:
```typescript
// For reference — do not re-declare these:
type MaskedSegment = { coords: number[][]; orient: string }
type TargetMeta    = { target_index: number; length: number; start: [number, number]; dir: string; coords: [number, number][] }
```

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
   - C (pos 4): BASIC[4]=C → G ✓
   - C was B in CANDY (it appeared in BASIC — confirmed now as green)
   - C appears only once in the full puzzle (only in BASIC) → all blues collapse to red ✓

3. **Word 1 (TILES) / pre-fill AMINO codes `['B','R','Y','B','B']`:**
   - A at pos 0 is in BATON (crossing word at [0,2]) → yellow crossing ✓
   - O at pos 4 is in BATON but not in BASIC or TILES → blue crossing ✓

- [ ] **Step 3: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/tutorialPuzzle.ts
git commit -m "feat(tutorial): add hardcoded tutorial puzzle (BATON/TILES/BASIC)"
```

---

## Task 3: Game pipeline hook

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/useTutorialGameState.ts`
- Update: `crosswords_mobile/src/screens/tutorial/useTutorialGameState.test.ts` (existing test file)

The existing `useTutorialGameState.ts` has a working pipeline with correct function call signatures (`buildTutorialPipeline`, `injectScriptedGuess`, etc.). **Port it rather than reimplementing it.** The only change needed is to add `rawHistoryByTarget` to the return value so the step machine can count guesses per word.

> **CRITICAL:** Do NOT attempt to rewrite the pipeline calls from scratch. The function signatures for `reconcileEvidenceFeedback`, `applyIntersectionMerge`, and `computeBlueTickerEntries` take object arguments — the existing code already calls them correctly. Copy it.

- [ ] **Step 1: Read existing `useTutorialGameState.ts` in full**

Read: `crosswords_mobile/src/screens/tutorial/useTutorialGameState.ts`

Note the existing exported type (e.g. `TutorialGameOutput` or `TutorialPipelineResult`), the `buildTutorialPipeline` pure function, and the `injectScriptedGuess` callback.

- [ ] **Step 2: Read the existing `useTutorialGameState.test.ts`**

Read: `crosswords_mobile/src/screens/tutorial/useTutorialGameState.test.ts`

Note which exports are imported. The test file imports `buildTutorialPipeline` — this export **must be preserved** in the new file.

- [ ] **Step 3: Write the new `useTutorialGameState.ts`**

Copy the existing file verbatim, then apply these three changes only:

**Change A** — Add `rawHistoryByTarget` to the return type. Find the existing output type (e.g. `TutorialGameOutput`) and add:
```typescript
rawHistoryByTarget: Map<number, FeedbackGuessEntry[]>
```

**Change B** — Return `rawHistoryByTarget` from the hook. Find the return statement and add:
```typescript
rawHistoryByTarget,
```

**Change C** — Ensure `buildTutorialPipeline` is still exported (it must be — the test file imports it). Do not remove it.

Do not change any pipeline function calls, import paths, or logic. Only add the new field.

- [ ] **Step 4: Run the existing tests — verify they still pass**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=useTutorialGameState
```

Expected: all existing tests PASS (nothing was removed or changed in logic)

- [ ] **Step 5: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/useTutorialGameState.ts
git commit -m "feat(tutorial): expose rawHistoryByTarget from useTutorialGameState"
```

---

## Task 4: Step machine hook + tests

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.ts`
- Create: `crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.test.ts
import { act, renderHook } from '@testing-library/react-hooks';
import { useTutorialStepMachine } from './useTutorialStepMachine';
import type { TutorialGameState, TutorialStep } from './types';

const baseState: TutorialGameState = {
  guessCountByTarget: { 0: 0, 1: 0, 2: 0 },
  activeTargetIndex: 0,
};

const makeStep = (overrides: Partial<TutorialStep> = {}): TutorialStep => ({
  id: 'test',
  trigger: () => true,
  hint: { body: 'Hello', isAction: false },
  ...overrides,
});

describe('useTutorialStepMachine', () => {
  test('fires first step immediately when trigger returns true', () => {
    const steps = [makeStep({ id: 'step0' })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    expect(result.current.phase.kind).toBe('HINT');
    expect((result.current.phase as any).stepIndex).toBe(0);
  });

  test('stays PLAYING when trigger returns false', () => {
    const steps = [makeStep({ trigger: () => false })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    expect(result.current.phase.kind).toBe('PLAYING');
  });

  test('dismiss advances to next step', () => {
    const steps = [
      makeStep({ id: 'step0' }),
      makeStep({ id: 'step1' }),
    ];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    act(() => result.current.dismiss());
    expect(result.current.phase.kind).toBe('HINT');
    expect((result.current.phase as any).stepIndex).toBe(1);
  });

  test('dismiss on last step transitions to DONE', () => {
    const steps = [makeStep({ id: 'step0' })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    act(() => result.current.dismiss());
    expect(result.current.phase.kind).toBe('DONE');
  });

  test('expectedAction auto-dismisses while in HINT', () => {
    const steps = [
      makeStep({
        id: 'action',
        hint: { body: 'Submit', isAction: true },
        expectedAction: (s, p) =>
          (s.guessCountByTarget[0] ?? 0) > (p.guessCountByTarget[0] ?? 0),
      }),
      makeStep({ id: 'next' }),
    ];
    const { result, rerender } = renderHook(
      (state: TutorialGameState) => useTutorialStepMachine(steps, state),
      { initialProps: baseState },
    );
    // Simulate a guess being submitted
    rerender({ ...baseState, guessCountByTarget: { 0: 1, 1: 0, 2: 0 } });
    expect(result.current.phase.kind).toBe('HINT');
    expect((result.current.phase as any).stepIndex).toBe(1);
  });

  test('activeStep returns the current hint step', () => {
    const steps = [makeStep({ id: 'step0', hint: { body: 'Learn!', isAction: false } })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    expect(result.current.activeStep?.id).toBe('step0');
    expect(result.current.activeStep?.hint.body).toBe('Learn!');
  });

  test('activeStep is null when PLAYING or DONE', () => {
    const steps = [makeStep({ trigger: () => false })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    expect(result.current.activeStep).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=useTutorialStepMachine
```

Expected: FAIL (useTutorialStepMachine not found)

- [ ] **Step 3: Write `useTutorialStepMachine.ts`**

```typescript
// crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.ts
import { useEffect, useRef, useState } from 'react';
import type { TutorialGameState, TutorialPhase, TutorialStep } from './types';

export type StepMachineOutput = {
  phase:      TutorialPhase
  activeStep: TutorialStep | null   // non-null only when phase.kind === 'HINT'
  dismiss:    () => void
}

export function useTutorialStepMachine(
  steps: TutorialStep[],
  gameState: TutorialGameState,
): StepMachineOutput {
  const [phase, setPhase] = useState<TutorialPhase>({ kind: 'PLAYING', nextStepIndex: 0 });
  const prevGameStateRef = useRef<TutorialGameState>(gameState);

  // ── Trigger check (PLAYING → HINT) ────────────────────────────────────────
  useEffect(() => {
    if (phase.kind !== 'PLAYING') return;
    const { nextStepIndex } = phase;
    if (nextStepIndex >= steps.length) {
      setPhase({ kind: 'DONE' });
      return;
    }
    if (steps[nextStepIndex].trigger(gameState)) {
      setPhase({ kind: 'HINT', stepIndex: nextStepIndex });
    }
  }, [phase, gameState, steps]);

  // ── Expected action check (auto-dismiss while HINT) ───────────────────────
  useEffect(() => {
    if (phase.kind !== 'HINT') return;
    const step = steps[phase.stepIndex];
    if (!step?.expectedAction) return;
    const prev = prevGameStateRef.current;
    prevGameStateRef.current = gameState;   // update ref BEFORE advance to avoid stale prev on next render
    if (step.expectedAction(gameState, prev)) {
      advance(phase.stepIndex + 1);
    }
  }, [gameState, phase, steps]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function advance(nextIndex: number) {
    if (nextIndex >= steps.length) {
      setPhase({ kind: 'DONE' });
    } else {
      setPhase({ kind: 'PLAYING', nextStepIndex: nextIndex });
    }
  }

  const dismiss = () => {
    if (phase.kind !== 'HINT') return;
    advance(phase.stepIndex + 1);
  };

  const activeStep =
    phase.kind === 'HINT' ? (steps[phase.stepIndex] ?? null) : null;

  return { phase, activeStep, dismiss };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=useTutorialStepMachine
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.ts crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.test.ts
git commit -m "feat(tutorial): add step machine hook with tests"
```

---

## Task 5: Tutorial script + tests

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/tutorialScript.ts`
- Create: `crosswords_mobile/src/screens/tutorial/tutorialScript.test.ts`

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
import type { TutorialStep, TutorialGameState } from './types';

const seq = (prev: TutorialGameState, cur: TutorialGameState) => {
  // For sequential explanatory steps — trigger is always true when reached
  return true;
};

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
    highlightTargetIndex: 2,   // displayIndex of BASIC
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

---

## Task 6: Tutorial overlay component

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/TutorialOverlay.tsx`

- [ ] **Step 1: Write `TutorialOverlay.tsx`**

```typescript
// crosswords_mobile/src/screens/tutorial/TutorialOverlay.tsx
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { TutorialStep } from './types';

interface Props {
  step: TutorialStep
  onDismiss: () => void
}

export default function TutorialOverlay({ step, onDismiss }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [step.id]);   // re-run when step changes so each hint fades in

  return (
    <Animated.View style={[styles.backdrop, { opacity }]} pointerEvents="box-none">
      <View style={styles.card}>
        {step.hint.title ? (
          <Text style={styles.title}>{step.hint.title}</Text>
        ) : null}
        <Text style={styles.body}>{step.hint.body}</Text>
        <View style={styles.buttonRow}>
          {!step.hint.isAction && (
            <Pressable
              style={styles.primaryButton}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Got it"
            >
              <Text style={styles.primaryButtonText}>Got it!</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.closeButton}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss hint"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    paddingBottom: 180,   // float above keyboard
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1b21',
  },
  body: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#E7131A',
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#888',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/TutorialOverlay.tsx
git commit -m "feat(tutorial): add TutorialOverlay modal component"
```

---

## Task 7: TutorialScreen orchestrator

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/TutorialScreen.tsx`

This is the most complex file. Read `crosswords_mobile/src/screens/BoardScreen.tsx` before writing to understand how `GameBoardPanel` is mounted (activeTargetIndex, scrollRef, boardRef, etc.), then adapt that pattern.

- [ ] **Step 1: Read `GameBoardPanel.tsx` props and `BoardScreen.tsx` usage**

Read both:
- `crosswords_mobile/src/components/GameBoardPanel.tsx` — check `GameBoardPanelProps` for exact prop names, especially `emphasizeKeyboard`, `emphasizeBoard`, and `emphasizedRailTargetIndex`
- `crosswords_mobile/src/screens/BoardScreen.tsx` — understand how the panel is mounted and what state wires into it

- [ ] **Step 2: Write `TutorialScreen.tsx`**

```typescript
// crosswords_mobile/src/screens/tutorial/TutorialScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@src/navigation/AppNavigator';
import GameBoardPanel from '@src/components/GameBoardPanel';
import TutorialOverlay from './TutorialOverlay';
import { useTutorialGameState } from './useTutorialGameState';
import { useTutorialStepMachine } from './useTutorialStepMachine';
import { TUTORIAL_STEPS } from './tutorialScript';
import {
  TUTORIAL_WORDS,
  TUTORIAL_MASKED_SEGMENTS,
  TUTORIAL_TARGETS_META,
  TUTORIAL_REVEALED_COORDS,
  TUTORIAL_PREFILLS,
  getTutorialWordSlots,
} from './tutorialPuzzle';
import type { TutorialGameState } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tutorial'>;

const WORD_SLOTS = getTutorialWordSlots();

export default function TutorialScreen({ navigation }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [activeTargetIndex, setActiveTargetIndex] = useState(0);
  const [guessText, setGuessText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const boardRef = useRef<View>(null);
  const [boardWidth, setBoardWidth] = useState<number | null>(null);

  // ── Game state ─────────────────────────────────────────────────────────────
  const game = useTutorialGameState(WORD_SLOTS, TUTORIAL_WORDS);

  // ── Step machine ───────────────────────────────────────────────────────────
  const tutorialGameState: TutorialGameState = {
    guessCountByTarget: Object.fromEntries(
      Array.from(game.rawHistoryByTarget.entries()).map(([k, v]) => [k, v.length]),
    ),
    activeTargetIndex,
  };
  const { activeStep, dismiss } = useTutorialStepMachine(TUTORIAL_STEPS, tutorialGameState);

  // ── Pre-fill: apply when switching to a word that has a pending pre-fill ───
  useEffect(() => {
    if (activeStep?.preFillTargetIndex === undefined) return;
    if (activeStep.preFillTargetIndex === activeTargetIndex && activeStep.preFill) {
      setGuessText((prev) => (prev === '' ? activeStep.preFill! : prev));
    }
  }, [activeTargetIndex, activeStep]);

  // ── Emphasis props derived from active step ────────────────────────────────
  const emphasizeKeyboard     = activeStep?.highlightTarget === 'submit-button';
  const emphasizeBoard        = activeStep?.highlightTarget === 'intersection-tile';
  const emphasizedRailTarget  =
    activeStep?.highlightTarget === 'word-tabs'
      ? (activeStep.highlightTargetIndex ?? null)
      : null;

  // ── Guess submission ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const trimmed = guessText.trim().toUpperCase();
    if (trimmed.length === 0) return;
    const prefillData = TUTORIAL_PREFILLS[activeTargetIndex];
    const codes =
      prefillData && trimmed === prefillData.guess
        ? prefillData.codes
        : computeFallbackCodes(trimmed, TUTORIAL_WORDS[activeTargetIndex] ?? '');
    game.injectScriptedGuess(activeTargetIndex, trimmed, codes);
    setGuessText('');
  }, [guessText, activeTargetIndex, game]);

  // ── Tile press (word switching) ────────────────────────────────────────────
  const handleTilePress = useCallback((targetIndex: number) => {
    setActiveTargetIndex(targetIndex);
    setGuessText('');
  }, []);

  const handleRailPress = useCallback((targetIndex: number) => {
    setActiveTargetIndex(targetIndex);
    setGuessText('');
  }, []);

  // ── History for active word ────────────────────────────────────────────────
  const historyItems = (game.mergedHistoryByTarget.get(activeTargetIndex) ?? []).map(
    (entry, i) => ({
      codes: entry.codes,
      guess: entry.guess,
      isLocked: game.guessViewStateByTarget[activeTargetIndex]?.lockedIndex === i,
    }),
  );

  const wordLength = TUTORIAL_WORDS[activeTargetIndex]?.length ?? 5;
  const greenLetters = game.greenLettersByTarget[activeTargetIndex] ?? {};

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
      >
        <GameBoardPanel
          // Board
          maskedSegments={TUTORIAL_MASKED_SEGMENTS}
          revealedCoords={TUTORIAL_REVEALED_COORDS}
          activeTargetIndex={activeTargetIndex}
          displayGuessByTarget={game.displayGuessByTarget}
          targetsMeta={TUTORIAL_TARGETS_META}
          solvedWordsByTarget={game.solvedWordsByTarget}
          greenLettersByTarget={game.greenLettersByTarget}
          onTilePress={handleTilePress}
          boardRef={boardRef}
          boardWidth={boardWidth}
          onBoardWidthChange={setBoardWidth}
          compact={false}
          windowHeight={windowHeight}
          // Status rail
          blueLetters={game.blueTickerLetters}
          // Word cards
          wordSlots={WORD_SLOTS}
          solvedFlags={game.solvedFlags}
          selectedTargetIndex={activeTargetIndex}
          onRailPress={handleRailPress}
          // Stage
          historyItems={historyItems}
          onHistoryPress={(i) => game.handleHistoryPress(activeTargetIndex, i)}
          onHistoryLongPress={(i) => game.handleHistoryLongPress(activeTargetIndex, i)}
          // Input
          showGuessInput
          guessText={guessText}
          wordLength={wordLength}
          greenLetters={greenLetters}
          // Keyboard
          onKey={(k) => setGuessText((t) => (t.length < wordLength ? t + k : t))}
          onBackspace={() => setGuessText((t) => t.slice(0, -1))}
          onSubmit={handleSubmit}
          letterStates={game.letterStates}
          safeAreaBottom={insets.bottom}
          // Emphasis from active step
          emphasizeKeyboard={emphasizeKeyboard}
          emphasizeBoard={emphasizeBoard}
          emphasizedRailTargetIndex={emphasizedRailTarget}
        />
      </ScrollView>

      {/* Overlay sits above the game, pointerEvents let touches through to game */}
      {activeStep && (
        <TutorialOverlay step={activeStep} onDismiss={dismiss} />
      )}
    </View>
  );
}

/**
 * Fallback scorer for when player overrides the pre-fill.
 * Produces simple G/Y/R codes against the target word (no cross-word B detection).
 * Only scores up to target.length letters; caller should validate length before calling.
 */
function computeFallbackCodes(guess: string, target: string): string[] {
  return Array.from({ length: target.length }, (_, i) => {
    const letter = guess[i] ?? '';
    if (!letter) return 'R';
    if (target[i] === letter) return 'G';
    if (target.includes(letter)) return 'Y';
    return 'R';
  });
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
});
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd crosswords_mobile && npm run typecheck
```

Expected: no errors in `src/screens/tutorial/`

If there are errors, fix imports (check that `@navigation/AppNavigator` alias matches `tsconfig.json` paths — it may need to be `../navigation/AppNavigator` or `@src/navigation/AppNavigator`). Similarly verify `@components/GameBoardPanel` alias.

- [ ] **Step 4: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/TutorialScreen.tsx
git commit -m "feat(tutorial): add TutorialScreen orchestrator"
```

---

## Task 8: Delete legacy tutorial files + final typecheck

**Files to delete** (all replaced by new files above):
- `crosswords_mobile/src/screens/tutorial/chapters/` (entire directory)
- Any other files in `src/screens/tutorial/` that were NOT created in Tasks 1–7

- [ ] **Step 1: List current tutorial directory contents**

```bash
ls crosswords_mobile/src/screens/tutorial/
ls crosswords_mobile/src/screens/tutorial/chapters/
```

- [ ] **Step 2: Delete legacy files**

Delete any files in `src/screens/tutorial/` that are NOT:
- `types.ts`
- `tutorialPuzzle.ts`
- `useTutorialGameState.ts`
- `useTutorialStepMachine.ts`
- `useTutorialStepMachine.test.ts`
- `tutorialScript.ts`
- `tutorialScript.test.ts`
- `TutorialOverlay.tsx`
- `TutorialScreen.tsx`

```bash
rm -rf crosswords_mobile/src/screens/tutorial/chapters
# Delete any other legacy .ts/.tsx files individually (check ls output first)
```

- [ ] **Step 3: Run full typecheck**

```bash
cd crosswords_mobile && npm run typecheck:all
```

Expected: no errors. Fix any import path issues found.

- [ ] **Step 4: Run all tutorial tests**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=tutorial
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A crosswords_mobile/src/screens/tutorial/
git commit -m "chore(tutorial): remove legacy chapter files"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `AppNavigator.tsx` still imports from `@screens/tutorial/TutorialScreen` — no change needed (confirmed: the import path is unchanged)
- [ ] `TutorialScreen` is typed as `NativeStackScreenProps<RootStackParamList, 'Tutorial'>` — matches the `Tutorial: { firstLaunch?: boolean } | undefined` route in `AppNavigator`
- [ ] The `firstLaunch` param is accepted but does not need to change behaviour in the new design — it can be ignored in this implementation
- [ ] Fallback codes in `computeFallbackCodes` are simplified (G/Y/R only, no cross-word B detection) — this is intentional for free-play guesses outside the script; document this limitation with a comment
- [ ] `TutorialOverlay` sets `pointerEvents="box-none"` on the `Animated.View` backdrop so touches pass through to the game board — **important for action steps where the player must interact with the game while the hint is showing**
