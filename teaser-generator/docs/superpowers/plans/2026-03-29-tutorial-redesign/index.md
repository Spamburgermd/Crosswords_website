# Tutorial Redesign — Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chapter-based tutorial with a fully playable scripted puzzle that surfaces 11 contextual hint overlays triggered by fixed game-state milestones.

**Architecture:** A step machine hook (`useTutorialStepMachine`) watches live game state and advances through an ordered `tutorialScript` array, transitioning between PLAYING / HINT / DONE. The orchestrator (`TutorialScreen`) mounts the game pipeline, the step machine, and a modal overlay, then derives `GameBoardPanel` emphasis props from the active step.

**Tech Stack:** React Native (Expo), TypeScript, `Animated` API with `useNativeDriver: true`, existing `GameBoardPanel` / `GameKeyboard` / `BoardView` components.

---

## Highlight Mechanism Note

The spec described a `TutorialHighlightContext` with animated pulse rings. This plan uses a simpler approach that requires **no changes outside `src/screens/tutorial/`**: `GameBoardPanel` already has `emphasizeKeyboard`, `emphasizedRailTargetIndex`, and `emphasizeBoard` props. The orchestrator passes these based on `activeStep.highlightTarget`. Effect is static emphasis — consistent with existing patterns and safe on older devices.

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
| 3 | BATON (0) | `CANDY` | `['B','G','Y','R','R']` | G(A pos1), Y(N wrong pos), B(C in BASIC), R(D), R(Y) |
| 7 | BASIC (2) | `TOPIC` | `['B','B','R','G','G']` | C(pos4)=G; C was B in step 3; C once in puzzle → blues→red |
| 9 | TILES (1) | `AMINO` | `['B','R','Y','B','B']` | A at [0,2]=yellow crossing; O at [4,2]=blue crossing |

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

## Task Checklist

- [ ] [Task 1: Define shared types](task-01-types.md)
- [ ] [Task 2: Hardcoded tutorial puzzle](task-02-puzzle.md)
- [ ] [Task 3: Game pipeline hook](task-03-game-state.md)
- [ ] [Task 4: Step machine hook + tests](task-04-step-machine.md)
- [ ] [Task 5: Tutorial script + tests](task-05-tutorial-script.md)
- [ ] [Task 6: Tutorial overlay component](task-06-overlay.md)
- [ ] [Task 7: TutorialScreen orchestrator](task-07-tutorial-screen.md)
- [ ] [Task 8: Delete legacy files + final typecheck](task-08-cleanup.md)

---

## Self-Review Checklist

After all tasks complete, verify:

- [ ] `AppNavigator.tsx` still imports from `@screens/tutorial/TutorialScreen` — no change needed
- [ ] `TutorialScreen` is typed as `NativeStackScreenProps<RootStackParamList, 'Tutorial'>` — matches `Tutorial: { firstLaunch?: boolean } | undefined` route
- [ ] `firstLaunch` param accepted but ignored — intentional in new design
- [ ] `computeFallbackCodes` comment documents the G/Y/R-only limitation
- [ ] `TutorialOverlay` has `pointerEvents="box-none"` on the backdrop — required for action steps
