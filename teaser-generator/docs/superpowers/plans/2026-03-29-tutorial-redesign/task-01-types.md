# Task 1: Define shared types

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/types.ts`

---

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

- [ ] **Step 3: Mark task complete in index**

Edit `docs/superpowers/plans/2026-03-29-tutorial-redesign/index.md`:

Change:
```
- [ ] [Task 1: Define shared types](task-01-types.md)
```
To:
```
- [x] [Task 1: Define shared types](task-01-types.md)
```
